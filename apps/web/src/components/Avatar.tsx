/** Generated avatar: initials on the colour derived from the account id (no uploaded photo). */
export function Avatar({
  username,
  color,
  size = 40,
}: {
  username: string | null;
  color: string;
  size?: number;
}) {
  const initials = (username ?? '?').replace(/_/g, '').slice(0, 2).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}
