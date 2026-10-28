import { describe, expect, it } from 'vitest';
import { getOfferStatus } from './offer-status';

const now = new Date('2026-10-28T12:00:00.000Z');

describe('getOfferStatus', () => {
  it('does not assign offer status to other video categories', () => {
    expect(getOfferStatus('deal', true, '2026-10-29T12:00:00.000Z', 'active', now)).toBeNull();
  });

  it('marks a merchant shop video with a future expiry as valid', () => {
    expect(getOfferStatus('shop', true, '2026-10-29T12:00:00.000Z', 'active', now)).toBe('valid');
  });

  it('marks expired database status or elapsed expiry as expired', () => {
    expect(getOfferStatus('shop', true, null, 'expired', now)).toBe('expired');
    expect(getOfferStatus('shop', true, '2026-10-28T11:59:59.999Z', 'active', now)).toBe('expired');
  });

  it.each([null, 'not-a-date'])(
    'marks a missing or invalid expiry as invalid (%s)',
    (expiresAt) => {
      expect(getOfferStatus('shop', true, expiresAt, 'active', now)).toBe('invalid');
    },
  );

  it('marks a shop video not published by a merchant as invalid', () => {
    expect(getOfferStatus('shop', false, '2026-10-29T12:00:00.000Z', 'active', now)).toBe(
      'invalid',
    );
  });

  it('does not classify a moderated shop video as an invalid offer', () => {
    expect(getOfferStatus('shop', false, '2026-10-29T12:00:00.000Z', 'hidden', now)).toBe(
      'unavailable',
    );
  });
});
