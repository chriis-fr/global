import https from 'https';

/**
 * Minimal, reusable Daraja STK Push service.
 *
 * - Does NOT introduce new database models.
 * - Mirrors the style of existing services like `PaystackService`.
 * - Is organization‑aware via the config object you pass in (no hard‑coding).
 *
 * You can call this from server actions / server components / existing flows
 * without adding new API routes, except for the Daraja callback URL which
 * must be an HTTP endpoint.
 */

export interface MpesaStkConfig {
  businessShortCode: string; // e.g. "174379" – can come from org's M-Pesa Paybill/Till
  passkey: string;           // Daraja Lipa Na M-Pesa Online Passkey
  callbackUrl: string;       // Fully qualified URL for Daraja callback
  transactionType?: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  accountReference?: string;
  transactionDesc?: string;
  environment?: 'sandbox' | 'production';
  /**
   * Optional: use these for OAuth instead of env DARAJA_CONSUMER_KEY/SECRET (e.g. per-org credentials).
   */
  consumerKey?: string;
  consumerSecret?: string;
  /**
   * Optional override: by default we use OAuth token from env or consumerKey/consumerSecret,
   * but you can inject one if you're managing tokens elsewhere.
   */
  accessToken?: string;
}

export interface MpesaStkRequestInput {
  phoneNumber: string; // 2547XXXXXXXX
  amount: number;      // in KES
  organizationId?: string; // for logging / attribution (not sent to Daraja)
  waiterId?: string;        // for logging / attribution (not sent to Daraja)
  tableRef?: string;        // optional table/seat reference
}

export interface MpesaStkSuccessResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export type MpesaStkResponse =
  | { ok: true; data: MpesaStkSuccessResponse }
  | { ok: false; error: string; raw?: unknown };

const DARAJA_SANDBOX_BASE = 'sandbox.safaricom.co.ke';
const DARAJA_PRODUCTION_BASE = 'api.safaricom.co.ke';

/**
 * Get OAuth access token from Daraja.
 * Uses consumerKey/consumerSecret when provided (e.g. from org credentials), else env vars.
 */
async function getDarajaAccessToken(
  environment: 'sandbox' | 'production' = 'sandbox',
  overrideConsumerKey?: string,
  overrideConsumerSecret?: string
): Promise<string> {
  const consumerKey = overrideConsumerKey ?? process.env.DARAJA_CONSUMER_KEY ?? '';
  const consumerSecret = overrideConsumerSecret ?? process.env.DARAJA_CONSUMER_SECRET ?? '';

  if (!consumerKey || !consumerSecret) {
    throw new Error(
      'Daraja consumer key/secret are not configured. Set them in org M-Pesa credentials (admin) or env DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET.'
    );
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const hostname =
    environment === 'production' ? DARAJA_PRODUCTION_BASE : DARAJA_SANDBOX_BASE;

  const options: https.RequestOptions = {
    hostname,
    path: '/oauth/v1/generate?grant_type=client_credentials',
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.access_token) {
            return reject(
              new Error(
                `Daraja OAuth error: missing access_token. Raw response: ${body.slice(
                  0,
                  500
                )}`
              )
            );
          }
          resolve(parsed.access_token as string);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Initiate an STK Push to M-Pesa for a specific customer phone and amount.
 *
 * Matches Daraja sandbox spec:
 * - Password = Base64(BusinessShortCode + Passkey + Timestamp) with Timestamp = YYYYMMDDHHMMSS
 * - PartyA & PhoneNumber = customer phone (2547XXXXXXXX)
 * - PartyB & BusinessShortCode = till/paybill number (sandbox: 174379)
 * - TransactionType e.g. CustomerPayBillOnline; CallBackURL must be HTTPS (e.g. https://your-domain.com/api/mpesa/callback)
 *
 * Sandbox test: Business Shortcode 174379, Passkey from Daraja sandbox app; callback = your HTTPS URL + /api/mpesa/callback
 */
export async function initiateMpesaStkPush(
  config: MpesaStkConfig,
  input: MpesaStkRequestInput
): Promise<MpesaStkResponse> {
  const {
    businessShortCode,
    passkey,
    callbackUrl,
    transactionType = 'CustomerPayBillOnline',
    accountReference = 'Payment',
    transactionDesc = 'Payment',
    environment = 'sandbox',
    accessToken,
  } = config;

  if (!businessShortCode || !passkey || !callbackUrl) {
    return {
      ok: false,
      error:
        'Missing M-Pesa STK configuration. Ensure businessShortCode, passkey, and callbackUrl are set.',
    };
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:Z.]/g, '')
    .slice(0, 14); // YYYYMMDDHHMMSS

  const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString(
    'base64'
  );

  const token =
    accessToken ||
    (await getDarajaAccessToken(
      environment,
      config.consumerKey,
      config.consumerSecret
    ).catch((err) => {
      console.error('❌ [MpesaStkService] Failed to obtain Daraja access token:', err);
      return null;
    }));

  if (!token) {
    return {
      ok: false,
      error: 'Failed to obtain Daraja access token.',
    };
  }

  const payload = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: input.amount,
    PartyA: input.phoneNumber,
    PartyB: businessShortCode,
    PhoneNumber: input.phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  const payloadForLog = {
    ...payload,
    Password: '***',
  };
  console.log('[M-Pesa STK] Daraja request payload:', JSON.stringify(payloadForLog, null, 2));

  const hostname =
    environment === 'production' ? DARAJA_PRODUCTION_BASE : DARAJA_SANDBOX_BASE;

  const data = JSON.stringify(payload);

  const options: https.RequestOptions = {
    hostname,
    path: '/mpesa/stkpush/v1/processrequest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(data),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          console.log('[M-Pesa STK] Daraja raw response body:', body);
          const trimmed = (body || '').trim();

          // Non-JSON response (e.g. proxy/load balancer error: "upstream connect error...", "connection timeout")
          if (!trimmed.startsWith('{')) {
            const msg = trimmed || 'Empty response from Daraja';
            console.error('❌ [MpesaStkService] Non-JSON response (often connection timeout or proxy error):', msg);
            return resolve({
              ok: false,
              error: msg.length > 120 ? `Daraja connection or proxy error: ${msg.slice(0, 120)}…` : `Daraja connection or proxy error: ${msg}`,
              raw: { _raw: msg },
            });
          }

          const parsed = JSON.parse(body) as Partial<MpesaStkSuccessResponse> & {
            errorCode?: string;
            errorMessage?: string;
          };

          if (parsed.ResponseCode === '0') {
            return resolve({
              ok: true,
              data: parsed as MpesaStkSuccessResponse,
            });
          }

          const errorMessage =
            parsed.errorMessage ||
            parsed.ResponseDescription ||
            'Unknown M-Pesa STK error';

          resolve({
            ok: false,
            error: errorMessage,
            raw: parsed,
          });
        } catch (err) {
          console.error('❌ [MpesaStkService] Failed to parse STK response:', err);
          const rawSnippet = (body || '').slice(0, 100);
          resolve({
            ok: false,
            error: rawSnippet ? `Invalid response from Daraja: ${rawSnippet}${(body || '').length > 100 ? '…' : ''}` : 'Failed to parse M-Pesa STK response.',
            raw: body || undefined,
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ [MpesaStkService] HTTPS request error:', error);
      resolve({
        ok: false,
        error: 'Error sending M-Pesa STK request.',
      });
    });

    req.write(data);
    req.end();
  });
}

