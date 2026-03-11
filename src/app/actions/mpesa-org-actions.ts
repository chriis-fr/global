'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrganizationService } from '@/lib/services/organizationService';
import { encrypt, decrypt } from '@/lib/utils/encryption';

export interface MpesaCredentialsInput {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  callbackUrl: string;
  environment: 'sandbox' | 'production';
}

/** Partial credentials for saving only what the admin has entered; rest stay from existing or env. */
export type MpesaCredentialsInputPartial = Partial<MpesaCredentialsInput>;

/**
 * Admin-only toggle to enable/disable M-Pesa services for a specific organization.
 * This is intended for the global admin panel where you select an organization
 * and decide whether it can use the M-Pesa waiter/STK features.
 */
export async function setOrganizationMpesaEnabled(
  organizationId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.adminTag) {
      return { success: false, error: 'Unauthorized' };
    }

    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    const currentSettings = org.settings || {};
    const currentMpesa = currentSettings.mpesa || { enabled: false };

    await OrganizationService.updateOrganization(organizationId, {
      settings: {
        ...currentSettings,
        mpesa: {
          ...currentMpesa,
          enabled,
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[setOrganizationMpesaEnabled] Error:', error);
    return {
      success: false,
      error: 'Failed to update M-Pesa settings for organization',
    };
  }
}

/**
 * Admin-only: get minimal organization detail for M-Pesa control (including business config).
 */
export async function getOrganizationMpesaStatus(
  organizationId: string
): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    mpesaEnabled: boolean;
    businessShortCode?: string;
    accountReference?: string;
    transactionType?: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.adminTag) {
      return { success: false, error: 'Unauthorized' };
    }

    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org || !org._id) {
      return { success: false, error: 'Organization not found' };
    }

    const mpesa = org.settings?.mpesa;
    const mpesaEnabled = mpesa?.enabled === true;

    return {
      success: true,
      data: {
        id: org._id.toString(),
        name: org.name,
        mpesaEnabled,
        businessShortCode: mpesa?.businessShortCode,
        accountReference: mpesa?.accountReference,
        transactionType: mpesa?.transactionType,
      },
    };
  } catch (error) {
    console.error('[getOrganizationMpesaStatus] Error:', error);
    return {
      success: false,
      error: 'Failed to load organization M-Pesa status',
    };
  }
}

/**
 * Admin-only: set M-Pesa business config (shortcode, account ref, transaction type) for an org.
 * When set, STK uses these instead of the org's payment method.
 */
export async function setOrganizationMpesaBusinessConfig(
  organizationId: string,
  config: {
    businessShortCode?: string;
    accountReference?: string;
    transactionType?: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.adminTag) {
      return { success: false, error: 'Unauthorized' };
    }

    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org) return { success: false, error: 'Organization not found' };

    const currentSettings = org.settings || {};
    const currentMpesa = currentSettings.mpesa || { enabled: currentSettings.mpesa?.enabled ?? false };

    const updatedMpesa = { ...currentMpesa };
    if (config.businessShortCode !== undefined) {
      updatedMpesa.businessShortCode = config.businessShortCode.trim() || undefined;
    }
    if (config.accountReference !== undefined) {
      updatedMpesa.accountReference = config.accountReference.trim() || undefined;
    }
    if (config.transactionType !== undefined) {
      updatedMpesa.transactionType = config.transactionType;
    }

    await OrganizationService.updateOrganization(organizationId, {
      settings: { ...currentSettings, mpesa: updatedMpesa },
    });

    return { success: true };
  } catch (error) {
    console.error('[setOrganizationMpesaBusinessConfig] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save M-Pesa business config',
    };
  }
}

/**
 * Admin-only: set Daraja credentials for an organization. Stored encrypted; never returned to frontend.
 * Saves only the fields you provide; merges with existing. No field is required.
 */
export async function setOrganizationMpesaCredentials(
  organizationId: string,
  credentials: MpesaCredentialsInputPartial
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.adminTag) {
      return { success: false, error: 'Unauthorized' };
    }

    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org) return { success: false, error: 'Organization not found' };

    const trimmed: MpesaCredentialsInputPartial = {};
    if (credentials.consumerKey != null && credentials.consumerKey.trim()) trimmed.consumerKey = credentials.consumerKey.trim();
    if (credentials.consumerSecret != null && credentials.consumerSecret.trim()) trimmed.consumerSecret = credentials.consumerSecret.trim();
    if (credentials.passkey != null && credentials.passkey.trim()) trimmed.passkey = credentials.passkey.trim();
    if (credentials.callbackUrl != null && credentials.callbackUrl.trim()) trimmed.callbackUrl = credentials.callbackUrl.trim();
    if (credentials.environment != null) trimmed.environment = credentials.environment === 'production' ? 'production' : 'sandbox';

    if (Object.keys(trimmed).length === 0) {
      return { success: false, error: 'Enter at least one field to save.' };
    }

    let merged: MpesaCredentialsInputPartial = { ...trimmed };
    const existingEncrypted = org.settings?.mpesa?.credentialsEncrypted;
    if (existingEncrypted) {
      try {
        const existing = JSON.parse(decrypt(existingEncrypted)) as MpesaCredentialsInputPartial;
        merged = { ...existing, ...trimmed };
      } catch {
        /* ignore broken existing; save only new */
      }
    }

    const payload = JSON.stringify(merged);
    const credentialsEncrypted = encrypt(payload);

    const currentSettings = org.settings || {};
    const currentMpesa = currentSettings.mpesa || { enabled: currentSettings.mpesa?.enabled ?? false };

    await OrganizationService.updateOrganization(organizationId, {
      settings: {
        ...currentSettings,
        mpesa: {
          ...currentMpesa,
          enabled: currentMpesa.enabled,
          credentialsEncrypted,
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[setOrganizationMpesaCredentials] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save M-Pesa credentials',
    };
  }
}

/**
 * Admin-only: get whether org has Daraja credentials set. Never returns the actual credentials.
 */
export async function getOrganizationMpesaCredentialsStatus(
  organizationId: string
): Promise<{ success: boolean; configured?: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.adminTag) {
      return { success: false, error: 'Unauthorized' };
    }

    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org) return { success: false, error: 'Organization not found' };

    const encrypted = org.settings?.mpesa?.credentialsEncrypted;
    return {
      success: true,
      configured: !!encrypted && encrypted.length > 0,
    };
  } catch (error) {
    console.error('[getOrganizationMpesaCredentialsStatus] Error:', error);
    return { success: false, error: 'Failed to get credentials status' };
  }
}

/**
 * Server-only: decrypt and return org M-Pesa credentials (may be partial). Do not expose to client.
 */
export async function getOrganizationMpesaCredentialsDecrypted(
  organizationId: string
): Promise<MpesaCredentialsInputPartial | null> {
  const org = await OrganizationService.getOrganizationById(organizationId);
  const encrypted = org?.settings?.mpesa?.credentialsEncrypted;
  if (!encrypted) return null;
  try {
    const json = decrypt(encrypted);
    const parsed = JSON.parse(json) as MpesaCredentialsInputPartial;
    const out: MpesaCredentialsInputPartial = {};
    if (parsed.consumerKey) out.consumerKey = parsed.consumerKey;
    if (parsed.consumerSecret) out.consumerSecret = parsed.consumerSecret;
    if (parsed.passkey) out.passkey = parsed.passkey;
    if (parsed.callbackUrl) out.callbackUrl = parsed.callbackUrl;
    if (parsed.environment) out.environment = parsed.environment === 'production' ? 'production' : 'sandbox';
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}


