/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** White or near-black initials, whichever reaches the better contrast on `bg`. */
export function initialsColor(bg: string): string {
  const l = luminance(bg);
  return 1.05 / (l + 0.05) >= (l + 0.05) / (luminance('#0b0d10') + 0.05) ? '#ffffff' : '#0b0d10';
}

/** Generated avatar: initials on the colour derived from the account id (no uploaded photo). */
export function Avatar({
  username,
  color,
  size = 40,
  src,
}: {
  username: string | null;
  color: string;
  size?: number;
  src?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- public profile images use Supabase URLs
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="inline-flex shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = (username ?? '?').replace(/_/g, '').slice(0, 2).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: initialsColor(color),
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </span>
  );
}
