function isLikelyUrlWithProtocol(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeCandidateUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const withProtocol = isLikelyUrlWithProtocol(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.origin.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function isLocalhostUrl(value: string | null | undefined): boolean {
  const normalized = normalizeCandidateUrl(value);
  if (!normalized) return false;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  } catch {
    return false;
  }
}

export function resolvePublicBaseUrl(options?: { requestOrigin?: string | null }): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    options?.requestOrigin ?? null,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCandidateUrl(candidate);
    if (!normalized) continue;
    if (process.env.NODE_ENV === 'production' && isLocalhostUrl(normalized)) {
      continue;
    }
    return normalized;
  }

  return null;
}
