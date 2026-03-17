'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrganizationService } from '@/lib/services/organizationService';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { initiateMpesaStkPush } from '@/lib/services/mpesaStkService';
import { mpesaSessionService } from '@/lib/services/mpesaSessionService';
import { getOrganizationMpesaCredentialsDecrypted } from '@/app/actions/mpesa-org-actions';
import { ObjectId } from 'mongodb';

interface SendWaiterStkInput {
  phoneNumber: string;
  amount: number;
  tableRef?: string;
}

interface SendAdminStkInput {
  organizationId: string;
  phoneNumber: string;
  amount: number;
}

function normalizeKenyanPhoneServer(input: string): string | null {
  const raw = input.replace(/[^\d+]/g, '');
  const trimmed = raw.startsWith('+') ? raw.slice(1) : raw;

  // 07XXXXXXXXX -> 2547XXXXXXXX
  if (/^07\d{8}$/.test(trimmed)) {
    return `254${trimmed.slice(1)}`;
  }

  // 2547XXXXXXXX -> already correct
  if (/^2547\d{8}$/.test(trimmed)) {
    return trimmed;
  }

  // +2547XXXXXXXX handled by the 2547 case after removing +
  return null;
}

export async function sendWaiterStkPush(
  input: SendWaiterStkInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  console.log('[M-Pesa STK] sendWaiterStkPush called – input:', { phoneNumber: input.phoneNumber, amount: input.amount, tableRef: input.tableRef });
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.organizationId) {
      console.log('[M-Pesa STK] Early exit: Unauthorized (no session or org)');
      return { success: false, error: 'Unauthorized' };
    }

    const userId = session.user.id;
    const organizationId = session.user.organizationId;
    console.log('[M-Pesa STK] Session ok – userId:', userId, 'organizationId:', organizationId);

    // 1. Check organization has M-Pesa enabled
    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org) {
      console.log('[M-Pesa STK] Early exit: Organization not found for id', organizationId);
      return { success: false, error: 'Organization not found' };
    }
    console.log('[M-Pesa STK] Organization found. mpesa.enabled:', org.settings?.mpesa?.enabled);

    if (!org.settings?.mpesa?.enabled) {
      console.log('[M-Pesa STK] Early exit: M-Pesa not enabled for org');
      return {
        success: false,
        error:
          'M-Pesa is not enabled for this organization. Contact an admin to enable it.',
      };
    }

    // 2. Ensure user belongs to this organization (any role can send prompts; we log who initiated)
    const member = org.members.find((m) => m.userId.toString() === userId);
    const role = member?.role ?? 'none';
    if (!member) {
      console.log('[M-Pesa STK] Early exit: User is not a member of this organization. role:', role);
      return {
        success: false,
        error: 'You are not a member of this organization.',
      };
    }
    console.log('[M-Pesa STK] User is org member (role:', role, '). Resolving M-Pesa config...');

    // 3. Business shortcode: prefer org-level (Admin UI); else payment method
    const orgMpesa = org.settings?.mpesa;
    let businessShortCode: string | undefined = orgMpesa?.businessShortCode?.trim();
    let accountReference: string = orgMpesa?.accountReference?.trim() || 'Payment';
    let transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline' =
      orgMpesa?.transactionType || 'CustomerPayBillOnline';
    let fiatCustomFields: Record<string, string> | undefined;

    if (!businessShortCode) {
      const methods = await paymentMethodService.getPaymentMethods(
        new ObjectId(organizationId),
        undefined,
        'fiat'
      );
      console.log('[M-Pesa STK] Fiat methods count:', methods.length);
      const mpesaMethod = methods.find(
        (m) =>
          m.fiatDetails?.subtype === 'mpesa_paybill' ||
          m.fiatDetails?.subtype === 'mpesa_till'
      );
      if (!mpesaMethod?.fiatDetails) {
        console.log('[M-Pesa STK] Early exit: No M-Pesa Paybill/Till. Set Business Shortcode in Admin or add Payment Method.');
        return {
          success: false,
          error:
            'No M-Pesa config. In Admin set Business Shortcode (e.g. 174379 for sandbox) or add a Paybill/Till in Payment Methods.',
        };
      }
      const fiat = mpesaMethod.fiatDetails;
      businessShortCode = fiat.subtype === 'mpesa_paybill' ? fiat.paybillNumber : fiat.tillNumber;
      if (!businessShortCode) {
        console.log('[M-Pesa STK] Early exit: Missing paybill/till number');
        return { success: false, error: 'M-Pesa configuration is incomplete (missing paybill or till number).' };
      }
      accountReference = fiat.mpesaAccountNumber || fiat.businessName || 'Payment';
      transactionType = fiat.subtype === 'mpesa_till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
      fiatCustomFields = fiat.customFields;
    } else {
      console.log('[M-Pesa STK] Using org-level Business Shortcode:', businessShortCode);
    }

    // Merge org-level encrypted credentials (if any) with payment method customFields + env
    const orgCredentials = await getOrganizationMpesaCredentialsDecrypted(organizationId);
    const passkey =
      orgCredentials?.passkey ||
      fiatCustomFields?.MPESA_PASSKEY ||
      process.env.NEXT_PUBLIC_DARAJA_PASSKEY ||
      '';
    const callbackUrl =
      orgCredentials?.callbackUrl ||
      fiatCustomFields?.MPESA_CALLBACK_URL ||
      process.env.NEXT_PUBLIC_DARAJA_CALLBACK_URL ||
      '';
    const rawEnv =
      orgCredentials?.environment ||
      (fiatCustomFields?.MPESA_ENV as 'sandbox' | 'production') ||
      (process.env.NEXT_PUBLIC_DARAJA_ENV as 'sandbox' | 'production') ||
      undefined;

    if (rawEnv !== 'production') {
      console.log('[M-Pesa STK] Early exit: M-Pesa not configured for production environment. rawEnv =', rawEnv);
      return {
        success: false,
        error:
          'M-Pesa is not configured for production. Please set environment=production in org M-Pesa credentials.',
      };
    }

    const environment = 'production' as const;
    const consumerKey = orgCredentials?.consumerKey;
    const consumerSecret = orgCredentials?.consumerSecret;
    const partyBShortCode = orgCredentials?.partyBShortCode?.trim() || undefined;
    if (orgCredentials && Object.keys(orgCredentials).length > 0) {
      console.log('[M-Pesa STK] Using org-level Daraja credentials (encrypted) where set');
    }

    if (!passkey) {
      console.log('[M-Pesa STK] Early exit: Daraja passkey not set');
      return {
        success: false,
        error:
          'Daraja passkey is not configured. Set org M-Pesa credentials in Admin or MPESA_PASSKEY in customFields/environment.',
      };
    }

    if (!callbackUrl) {
      console.log('[M-Pesa STK] Early exit: Daraja callback URL not set');
      return {
        success: false,
        error:
          'Daraja callback URL is not configured. Set org M-Pesa credentials in Admin or MPESA_CALLBACK_URL in customFields/environment.',
      };
    }

    console.log('[M-Pesa STK] Config resolved – businessShortCode:', businessShortCode, 'partyBShortCode:', partyBShortCode, 'callbackUrl:', callbackUrl, 'environment:', environment, 'credentialsSource:', orgCredentials ? 'org' : 'paymentMethod/env');

    // 4. Call Daraja STK
    const stkPayload = {
      phoneNumber: input.phoneNumber,
      amount: input.amount,
      organizationId,
      waiterId: userId,
      tableRef: input.tableRef || undefined,
    };
    console.log('[M-Pesa STK] Initiate prompt – payload:', JSON.stringify(stkPayload, null, 2));

    let stkResult = await initiateMpesaStkPush(
      {
        businessShortCode,
        passkey,
        callbackUrl,
        transactionType,
        accountReference,
        transactionDesc: 'POS Payment',
        environment,
        ...(consumerKey && consumerSecret ? { consumerKey, consumerSecret } : {}),
        ...(partyBShortCode ? { partyBShortCode } : {}),
      },
      stkPayload
    );

    // Retry once on connection/timeout errors (Daraja or proxy can be slow or flaky)
    const isConnectionError =
      !stkResult.ok &&
      stkResult.error &&
      /timeout|connection|upstream|reset|disconnect/i.test(stkResult.error);
    if (isConnectionError) {
      console.log('[M-Pesa STK] Connection/timeout error, retrying once in 2s...');
      await new Promise((r) => setTimeout(r, 2000));
      stkResult = await initiateMpesaStkPush(
        {
          businessShortCode,
          passkey,
          callbackUrl,
          transactionType,
          accountReference,
          transactionDesc: 'POS Payment',
          environment,
          ...(consumerKey && consumerSecret ? { consumerKey, consumerSecret } : {}),
        },
        stkPayload
      );
    }

    console.log('[M-Pesa STK] Daraja response:', JSON.stringify(stkResult, null, 2));

    if (!stkResult.ok) {
      console.log('[M-Pesa STK] Daraja returned error:', stkResult.error, 'raw:', stkResult.raw);
      const userMessage =
        isConnectionError && stkResult.error
          ? 'M-Pesa is temporarily unreachable. Please try again in a moment.'
          : (stkResult.error || 'Failed to initiate STK push.');
      return {
        success: false,
        error: userMessage,
      };
    }

    // 5. Record session
    console.log('[M-Pesa STK] Recording session – MerchantRequestID:', stkResult.data.MerchantRequestID, 'CheckoutRequestID:', stkResult.data.CheckoutRequestID);
    await mpesaSessionService.createSession({
      organizationId,
      waiterUserId: userId,
      phoneNumber: input.phoneNumber,
      amount: input.amount,
      tableRef: input.tableRef || undefined,
      merchantRequestId: stkResult.data.MerchantRequestID,
      checkoutRequestId: stkResult.data.CheckoutRequestID,
    });

    console.log('[M-Pesa STK] Success – message:', stkResult.data.CustomerMessage || 'STK push sent.');
    return {
      success: true,
      message: stkResult.data.CustomerMessage || 'STK push sent.',
    };
  } catch (error) {
    console.error('[M-Pesa STK] sendWaiterStkPush threw:', error);
    if (error instanceof Error) console.error('[M-Pesa STK] stack:', error.stack);
    return {
      success: false,
      error: 'Unexpected error while sending M-Pesa STK push.',
    };
  }
}

export async function sendAdminMpesaStkPush(
  input: SendAdminStkInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  console.log('[M-Pesa STK] sendAdminMpesaStkPush called – input:', {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    amount: input.amount,
  });
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.adminTag) {
      return { success: false, error: 'Unauthorized' };
    }

    const organizationId = input.organizationId;
    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org) {
      return { success: false, error: 'Organization not found' };
    }
    if (!org.settings?.mpesa?.enabled) {
      return {
        success: false,
        error: 'M-Pesa is not enabled for this organization.',
      };
    }

    const normalizedPhone = normalizeKenyanPhoneServer(input.phoneNumber);
    if (!normalizedPhone) {
      return {
        success: false,
        error:
          'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX format for Kenyan numbers.',
      };
    }

    const orgMpesa = org.settings?.mpesa;
    let businessShortCode: string | undefined = orgMpesa?.businessShortCode?.trim();
    let accountReference: string = orgMpesa?.accountReference?.trim() || 'Payment';
    let transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline' =
      orgMpesa?.transactionType || 'CustomerPayBillOnline';
    let fiatCustomFields: Record<string, string> | undefined;

    if (!businessShortCode) {
      const methods = await paymentMethodService.getPaymentMethods(
        new ObjectId(organizationId),
        undefined,
        'fiat'
      );
      const mpesaMethod = methods.find(
        (m) =>
          m.fiatDetails?.subtype === 'mpesa_paybill' ||
          m.fiatDetails?.subtype === 'mpesa_till'
      );
      if (!mpesaMethod?.fiatDetails) {
        return {
          success: false,
          error:
            'No M-Pesa config for this organization. Set Business Shortcode in Admin or add a Paybill/Till in Payment Methods.',
        };
      }
      const fiat = mpesaMethod.fiatDetails;
      businessShortCode =
        fiat.subtype === 'mpesa_paybill' ? fiat.paybillNumber : fiat.tillNumber;
      if (!businessShortCode) {
        return {
          success: false,
          error: 'M-Pesa configuration is incomplete (missing paybill or till number).',
        };
      }
      accountReference = fiat.mpesaAccountNumber || fiat.businessName || 'Payment';
      transactionType =
        fiat.subtype === 'mpesa_till'
          ? 'CustomerBuyGoodsOnline'
          : 'CustomerPayBillOnline';
      fiatCustomFields = fiat.customFields;
    }

    const orgCredentials = await getOrganizationMpesaCredentialsDecrypted(organizationId);
    const passkey =
      orgCredentials?.passkey ||
      fiatCustomFields?.MPESA_PASSKEY ||
      process.env.NEXT_PUBLIC_DARAJA_PASSKEY ||
      '';
    const callbackUrl =
      orgCredentials?.callbackUrl ||
      fiatCustomFields?.MPESA_CALLBACK_URL ||
      process.env.NEXT_PUBLIC_DARAJA_CALLBACK_URL ||
      '';
    const rawEnv =
      orgCredentials?.environment ||
      (fiatCustomFields?.MPESA_ENV as 'sandbox' | 'production') ||
      (process.env.NEXT_PUBLIC_DARAJA_ENV as 'sandbox' | 'production') ||
      undefined;

    if (rawEnv !== 'production') {
      return {
        success: false,
        error:
          'M-Pesa is not configured for production for this organization. Please set environment=production in org M-Pesa credentials.',
      };
    }

    const environment = 'production' as const;
    const consumerKey = orgCredentials?.consumerKey;
    const consumerSecret = orgCredentials?.consumerSecret;
    const partyBShortCode = orgCredentials?.partyBShortCode?.trim() || undefined;

    if (!passkey) {
      return {
        success: false,
        error:
          'Daraja passkey is not configured for this organization. Set org M-Pesa credentials in Admin or MPESA_PASSKEY in customFields/environment.',
      };
    }

    if (!callbackUrl) {
      return {
        success: false,
        error:
          'Daraja callback URL is not configured for this organization. Set org M-Pesa credentials in Admin or MPESA_CALLBACK_URL in customFields/environment.',
      };
    }

    console.log(
      '[M-Pesa STK][Admin] Config resolved – businessShortCode:',
      businessShortCode,
      'partyBShortCode:',
      partyBShortCode,
      'callbackUrl:',
      callbackUrl,
      'environment:',
      environment
    );

    const stkPayload = {
      phoneNumber: normalizedPhone,
      amount: input.amount,
      organizationId,
    };

    const stkResult = await initiateMpesaStkPush(
      {
        businessShortCode,
        passkey,
        callbackUrl,
        transactionType,
        accountReference,
        transactionDesc: 'POS Payment',
        environment,
        ...(consumerKey && consumerSecret ? { consumerKey, consumerSecret } : {}),
        ...(partyBShortCode ? { partyBShortCode } : {}),
      },
      stkPayload
    );

    if (!stkResult.ok) {
      return {
        success: false,
        error: stkResult.error || 'Failed to initiate STK push.',
      };
    }

    return {
      success: true,
      message: stkResult.data.CustomerMessage || 'STK push sent.',
    };
  } catch (error) {
    console.error('[M-Pesa STK] sendAdminMpesaStkPush threw:', error);
    return {
      success: false,
      error: 'Unexpected error while sending M-Pesa STK push.',
    };
  }
}

