import { LIFETIME_MS, MAX_LIFETIME_MS, type Category } from './constants.ts';

export interface LifetimeOptions {
  /** Required for `event`: end of the event. */
  eventEndsAt?: Date | undefined;
  /** Required for `shop`: duration chosen by the merchant. */
  merchantHours?: number | undefined;
}

/** Expiry date of a video; throws if the category-specific option is missing or invalid. */
export function computeExpiresAt(category: Category, now: Date, opts: LifetimeOptions = {}): Date {
  const max = now.getTime() + MAX_LIFETIME_MS;
  if (category === 'event') {
    const end = opts.eventEndsAt?.getTime();
    if (end === undefined || end <= now.getTime() || end > max) {
      throw new RangeError('event_end_invalid');
    }
    return new Date(end);
  }
  if (category === 'shop') {
    const hours = opts.merchantHours;
    if (hours === undefined || hours <= 0 || hours * 3_600_000 > MAX_LIFETIME_MS) {
      throw new RangeError('merchant_duration_invalid');
    }
    return new Date(now.getTime() + hours * 3_600_000);
  }
  return new Date(now.getTime() + LIFETIME_MS[category]);
}
