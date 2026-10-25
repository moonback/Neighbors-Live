/** "300 m" / "1,2 km" from a 100 m bucketed distance. */
export function formatDistance(
  meters: number,
  locale: string,
): { unit: 'm' | 'km'; value: string } {
  if (meters < 1000) return { unit: 'm', value: String(meters) };
  return {
    unit: 'km',
    value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000),
  };
}
