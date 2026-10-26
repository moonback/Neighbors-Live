import { useId } from 'react';

/** Brand mark: gradient map pin with a play button. */
export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId();
  return (
    <svg aria-hidden="true" viewBox="0 0 48 56" width={size} height={size * (56 / 48)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5ec8" />
          <stop offset="0.5" stopColor="#8b5cff" />
          <stop offset="1" stopColor="#3d8bff" />
        </linearGradient>
      </defs>
      <path
        d="M24 2C12.4 2 3 11.2 3 22.6 3 37.4 24 54 24 54s21-16.6 21-31.4C45 11.2 35.6 2 24 2z"
        fill={`url(#${id})`}
      />
      <circle cx="24" cy="22" r="11" fill="#fff" fillOpacity="0.95" />
      <path d="M21 16.8v10.4l8.4-5.2z" fill="#6a5cff" />
    </svg>
  );
}

/** Mark + wordmark. `tagline` adds a subtitle whose last word is highlighted (“en direct”). */
export function Logo({
  name,
  tagline,
  size = 32,
  className = '',
}: {
  name: string;
  tagline?: string;
  size?: number;
  className?: string;
}) {
  const words = tagline?.split(' ') ?? [];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-extrabold tracking-tight" style={{ fontSize: size * 0.72 }}>
          {name}
        </span>
        {tagline && (
          <span className="mt-1 text-xs font-medium text-fog">
            {words.slice(0, -1).join(' ')}{' '}
            <span className="font-semibold text-blue">{words.at(-1)}</span>
          </span>
        )}
      </span>
    </span>
  );
}
