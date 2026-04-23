import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/database';
import { OrganizationService } from '@/lib/services/organizationService';
import { getOrganizationMpesaCredentialsDecrypted } from '@/app/actions/mpesa-org-actions';
import type { ReconTransaction } from '@/models/ReconTransaction';

const DARAJA_SANDBOX_BASE = 'sandbox.safaricom.co.ke';
const DARAJA_PRODUCTION_BASE = 'api.safaricom.co.ke';

function fmtDarajaDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Daraja expects: "YYYY-MM-DD HH:mm:ss"
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeMsisdn(msisdn: string): string {
  const raw = (msisdn || '').trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (!raw) return raw;
  if (raw.startsWith('254') && raw.length === 12) return raw;
  if (raw.startsWith('0') && raw.length === 10) return `254${raw.slice(1)}`;
  if (raw.startsWith('7') && raw.length === 9) return `254${raw}`;
  return raw;
}

function normalizeShortCode(shortCode: string): number {
  const raw = (shortCode || '').trim();
  if (!raw) throw new Error('ShortCode is required');
  if (!/^[0-9]+$/.test(raw)) throw new Error('ShortCode must be numeric');
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error('ShortCode must be numeric');
  return n;
}

function parseDarajaEnvironment(value: unknown): 'sandbox' | 'production' {
  return String(value ?? '')
    .toLowerCase()
    .trim() === 'sandbox'
    ? 'sandbox'
    : 'production';
}

async function getDarajaAccessToken(opts: {
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
}) {
  const { environment, consumerKey, consumerSecret } = opts;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const darajaBase = environment === 'production' ? DARAJA_PRODUCTION_BASE : DARAJA_SANDBOX_BASE;

  console.log('[Daraja Pull] OAuth request:', {
    environment,
    url: `https://${darajaBase}/oauth/v1/generate?grant_type=client_credentials`,
    auth: 'Basic ***',
  });

  const tokenRes = await fetch(
    `https://${darajaBase}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const tokenRaw = await tokenRes.text().catch(() => '');
  let tokenData: { access_token?: string } = {};
  try {
    tokenData = JSON.parse(tokenRaw) as { access_token?: string };
  } catch {
    tokenData = {};
  }
  const token = typeof tokenData.access_token === 'string' ? tokenData.access_token.trim() : '';
  console.log('[Daraja Pull] OAuth response:', {
    status: tokenRes.status,
    ok: tokenRes.ok,
    bodySnippet: tokenRaw.slice(0, 500),
    accessTokenMeta: token
      ? { length: token.length, head: `${token.slice(0, 4)}***${token.slice(-4)}` }
      : null,
  });
  if (!tokenRes.ok || !token) {
    throw new Error('Failed to get Daraja access token');
  }
  return { accessToken: token, darajaBase };
}

export type RegisterPullResponse = {
  ResponseRefID?: string;
  ResponseStatus?: string;
  ShortCode?: string;
  ResponseDescription?: string;
  [k: string]: unknown;
};

export async function registerPullTransactions(input: {
  organizationId: string;
  shortCode?: string;
  nominatedNumber: string;
  callbackUrl: string;
}) {
  const org = await OrganizationService.getOrganizationById(input.organizationId);
  if (!org?._id) throw new Error('Organization not found');

  const shortCodeRaw = (input.shortCode ?? org.settings?.mpesa?.businessShortCode ?? '').trim();
  if (!shortCodeRaw) throw new Error('No Business Short Code configured for this org');
  const shortCode = normalizeShortCode(shortCodeRaw);

  const creds = await getOrganizationMpesaCredentialsDecrypted(input.organizationId);
  const consumerKey = creds?.consumerKey ?? process.env.DARAJA_CONSUMER_KEY ?? '';
  const consumerSecret = creds?.consumerSecret ?? process.env.DARAJA_CONSUMER_SECRET ?? '';
  const environment = parseDarajaEnvironment(creds?.environment ?? process.env.DARAJA_ENV ?? 'production');
  if (!consumerKey || !consumerSecret) throw new Error('Consumer key/secret not configured');

  const { accessToken, darajaBase } = await getDarajaAccessToken({ environment, consumerKey, consumerSecret });

  const payload = {
    ShortCode: shortCode,
    RequestType: 'Pull',
    NominatedNumber: normalizeMsisdn(input.nominatedNumber),
    CallBackURL: input.callbackUrl,
  };

  console.log('[Daraja Pull] Register request:', {
    environment,
    url: `https://${darajaBase}/pulltransactions/v1/register`,
    payload,
  });

  const res = await fetch(`https://${darajaBase}/pulltransactions/v1/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const raw = await res.text().catch(() => '');
  let data: RegisterPullResponse = {};
  try {
    data = JSON.parse(raw) as RegisterPullResponse;
  } catch {
    data = { raw };
  }

  console.log('[Daraja Pull] Register response:', {
    status: res.status,
    ok: res.ok,
    body: data,
  });

  if (!res.ok) {
    const desc = data.ResponseDescription;
    throw new Error(typeof desc === 'string' && desc ? desc : 'Pull registration failed');
  }

  const currentSettings = org.settings || {};
  const currentMpesa =
    currentSettings.mpesa && typeof currentSettings.mpesa === 'object'
      ? currentSettings.mpesa
      : { enabled: false };
  await OrganizationService.updateOrganization(input.organizationId, {
    settings: {
      ...currentSettings,
      mpesa: {
        ...currentMpesa,
        pullApiRegistered: true,
        pullApiRegisteredAt: new Date(),
        pullApiNominatedNumber: normalizeMsisdn(input.nominatedNumber),
        pullApiCallbackUrl: input.callbackUrl,
      },
    },
  });

  return { response: data, environment };
}

export type PulledTransaction = {
  transactionId: string;
  trxDate: string;
  msisdn?: number | string;
  sender?: string;
  transactiontype?: string;
  billreference?: string;
  amount?: string | number;
  organizationname?: string;
  [k: string]: unknown;
};

export type QueryPullResponse = {
  ResponseRefID?: string;
  ResponseCode?: string;
  ResponseMessage?: string;
  Response?: Array<Array<PulledTransaction>>;
  CurrentPage?: number;
  PageSize?: number;
  TotalPages?: number;
  HasNext?: boolean;
  HasPrevious?: boolean;
  TotalRecords?: number;
  [k: string]: unknown;
};

type QueryPullPageResult = {
  data: QueryPullResponse;
  rows: PulledTransaction[];
  pageSize?: number;
  hasNext?: boolean;
  totalRecords?: number;
};

export async function queryPullTransactionsAndIngest(input: {
  organizationId: string;
  shortCode?: string;
  startDate?: Date;
  endDate?: Date;
  offsetValue?: string;
}) {
  const org = await OrganizationService.getOrganizationById(input.organizationId);
  if (!org?._id) throw new Error('Organization not found');

  const shortCodeRaw = (input.shortCode ?? org.settings?.mpesa?.businessShortCode ?? '').trim();
  if (!shortCodeRaw) throw new Error('No Business Short Code configured for this org');
  const shortCode = normalizeShortCode(shortCodeRaw);

  const creds = await getOrganizationMpesaCredentialsDecrypted(input.organizationId);
  const consumerKey = creds?.consumerKey ?? process.env.DARAJA_CONSUMER_KEY ?? '';
  const consumerSecret = creds?.consumerSecret ?? process.env.DARAJA_CONSUMER_SECRET ?? '';
  const environment = parseDarajaEnvironment(creds?.environment ?? process.env.DARAJA_ENV ?? 'production');
  if (!consumerKey || !consumerSecret) throw new Error('Consumer key/secret not configured');

  const { accessToken, darajaBase } = await getDarajaAccessToken({ environment, consumerKey, consumerSecret });

  const end = input.endDate ?? new Date();
  const start = input.startDate ?? new Date(end.getTime() - 48 * 60 * 60 * 1000);

  const queryPullPage = async (rangeStart: Date, rangeEnd: Date, offset: number): Promise<QueryPullPageResult> => {
    const payload = {
      ShortCode: shortCode,
      StartDate: fmtDarajaDate(rangeStart),
      EndDate: fmtDarajaDate(rangeEnd),
      OffSetValue: String(offset),
    };

    console.log('[Daraja Pull] Query request:', {
      environment,
      url: `https://${darajaBase}/pulltransactions/v1/query`,
      payload,
    });

    const res = await fetch(`https://${darajaBase}/pulltransactions/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const raw = await res.text().catch(() => '');
    let data: QueryPullResponse = {};
    try {
      data = JSON.parse(raw) as QueryPullResponse;
    } catch {
      data = { raw };
    }

    const rows = (data.Response ?? []).flat().filter(Boolean) as PulledTransaction[];

    console.log('[Daraja Pull] Query response:', {
      status: res.status,
      ok: res.ok,
      offset,
      fetchedRows: rows.length,
      responseCode: data.ResponseCode,
      responseMessage: data.ResponseMessage,
      bodySnippet: raw.slice(0, 1500),
    });

    if (!res.ok) {
      const errMsg = data.ResponseMessage;
      throw new Error(typeof errMsg === 'string' && errMsg ? errMsg : 'Failed to query pull transactions');
    }

    return {
      data,
      rows,
      pageSize: typeof data.PageSize === 'number' ? data.PageSize : undefined,
      hasNext: typeof data.HasNext === 'boolean' ? data.HasNext : undefined,
      totalRecords: typeof data.TotalRecords === 'number' ? data.TotalRecords : undefined,
    };
  };

  const fetchRangeWithPagination = async (rangeStart: Date, rangeEnd: Date): Promise<{ rows: PulledTransaction[]; last: QueryPullResponse }> => {
    let offset = Number(input.offsetValue ?? '0');
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const rows: PulledTransaction[] = [];
    let last: QueryPullResponse = {};
    const MAX_PAGES = 40;

    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await queryPullPage(rangeStart, rangeEnd, offset);
      last = page.data;
      const pageRows = page.rows;

      if (pageRows.length === 0) break;
      rows.push(...pageRows);

      // Explicit pagination flags from Safaricom response (when provided)
      if (page.hasNext === false) break;

      // If total records is known and we have all of them, stop.
      if (typeof page.totalRecords === 'number' && rows.length >= page.totalRecords) break;

      // Otherwise, continue with offset progression.
      const nextStep = page.pageSize && page.pageSize > 0 ? page.pageSize : pageRows.length;
      if (!nextStep) break;
      offset += nextStep;
    }

    return { rows, last };
  };

  // Some pull responses are incomplete on broad windows; segment long periods and merge.
  const durationMs = Math.max(0, end.getTime() - start.getTime());
  const segmentMs = 60 * 60 * 1000; // 1-hour windows for better completeness
  const useSegments = durationMs > 2 * segmentMs;

  let combinedRows: PulledTransaction[] = [];
  let lastData: QueryPullResponse = {};

  if (!useSegments) {
    const single = await fetchRangeWithPagination(start, end);
    combinedRows = single.rows;
    lastData = single.last;
  } else {
    let cursor = new Date(start);
    while (cursor < end) {
      const windowStart = new Date(cursor);
      const windowEnd = new Date(Math.min(end.getTime(), windowStart.getTime() + segmentMs));
      const seg = await fetchRangeWithPagination(windowStart, windowEnd);
      combinedRows.push(...seg.rows);
      lastData = seg.last;
      cursor = windowEnd;
    }
  }

  // Deduplicate by transactionId across pages/windows.
  const byId = new Map<string, PulledTransaction>();
  for (const row of combinedRows) {
    const id = String(row.transactionId || '').trim();
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, row);
      continue;
    }
    const prevTime = prev.trxDate ? new Date(prev.trxDate).getTime() : 0;
    const nextTime = row.trxDate ? new Date(row.trxDate).getTime() : 0;
    if (nextTime >= prevTime) byId.set(id, row);
  }
  const rows = [...byId.values()];

  console.log('[Daraja Pull] Aggregation summary:', {
    segmented: useSegments,
    totalRawRows: combinedRows.length,
    uniqueRows: rows.length,
    range: { start: fmtDarajaDate(start), end: fmtDarajaDate(end) },
  });
  const db = await connectToDatabase();
  const sessionsCol = db.collection('mpesa_stk_sessions');
  const reconCol = db.collection<ReconTransaction>('recon_transactions');

  const orgObjectId = new ObjectId(input.organizationId);

  let updatedSessions = 0;
  let createdRecon = 0;

  for (const tx of rows) {
    const receipt = String(tx.transactionId || '').trim();
    if (!receipt) continue;

    const amountNum = tx.amount != null ? Number(tx.amount) : undefined;
    const trxDate = tx.trxDate ? new Date(tx.trxDate) : undefined;
    const msisdn = tx.msisdn != null ? normalizeMsisdn(String(tx.msisdn)) : '';

    // 1) If we already have an STK session with this receipt, update confirmed fields (idempotent).
    const setDoc: Record<string, unknown> = {
      status: 'success',
      updatedAt: new Date(),
    };
    if (Number.isFinite(amountNum)) setDoc.confirmedAmount = amountNum;
    if (trxDate && !Number.isNaN(trxDate.getTime())) setDoc.transactionDate = trxDate;

    const upd = await sessionsCol.updateMany(
      { organizationId: orgObjectId, mpesaReceiptNumber: receipt },
      {
        $set: setDoc,
      }
    );
    if (upd.modifiedCount > 0) updatedSessions += upd.modifiedCount;

    // 2) If no STK session exists for this receipt, create a recon entry (missing_internal).
    const hasSession = await sessionsCol.findOne(
      { organizationId: orgObjectId, mpesaReceiptNumber: receipt },
      { projection: { _id: 1 } }
    );
    if (!hasSession) {
      const existingRecon = await reconCol.findOne(
        { organizationId: orgObjectId, mpesaReceiptNumber: receipt },
        { projection: { _id: 1 } }
      );
      if (!existingRecon) {
        await reconCol.insertOne({
          organizationId: orgObjectId,
          expectedAmount: Number.isFinite(amountNum) ? amountNum : undefined,
          currency: 'KES',
          phoneNumber: msisdn || '—',
          tableRef: tx.billreference ? String(tx.billreference) : undefined,
          mpesaReceiptNumber: receipt,
          mpesaAmount: Number.isFinite(amountNum) ? amountNum : undefined,
          mpesaTimestamp: trxDate,
          status: 'success',
          matchStatus: 'missing_internal',
          matchConfidence: 0.8,
          matchNote: 'Pulled from M-Pesa Pull Transactions API (no matching STK session found).',
          settled: false,
          source: 'c2b_manual',
          provider: 'mpesa',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdRecon++;
      }
    }
  }

  return {
    response: lastData,
    environment,
    fetched: rows.length,
    updatedSessions,
    createdRecon,
    range: { start, end },
  };
}

