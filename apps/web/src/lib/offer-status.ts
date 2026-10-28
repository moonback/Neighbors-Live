export type OfferStatus = 'valid' | 'expired' | 'invalid' | 'unavailable' | null;

export function getOfferStatus(
  category: string | null,
  isMerchant: boolean,
  expiresAt: string | null,
  videoStatus: string | null,
  now: Date,
): OfferStatus {
  if (category !== 'shop') return null;
  if (videoStatus === 'expired') return 'expired';
  if (videoStatus !== 'active') return 'unavailable';

  const expiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (!Number.isFinite(expiry)) return 'invalid';
  if (expiry <= now.getTime()) return 'expired';
  if (!isMerchant) return 'invalid';
  return 'valid';
}
