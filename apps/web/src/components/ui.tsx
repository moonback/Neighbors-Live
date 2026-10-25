import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:bg-yellow-300 disabled:bg-yellow-200/60',
  secondary: 'bg-panel text-white border border-line hover:border-fog disabled:opacity-60',
  danger: 'bg-alert text-ink hover:bg-red-400 disabled:opacity-60',
  ghost: 'text-fog hover:text-white disabled:opacity-60',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-fog">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-ink px-3 py-2 text-white placeholder:text-fog/70 focus:border-accent focus:outline-none';

export function Notice({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'error' | 'success';
  children: ReactNode;
}) {
  const color =
    kind === 'error'
      ? 'border-alert text-alert'
      : kind === 'success'
        ? 'border-green-500 text-green-300'
        : 'border-line text-fog';
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-3 py-2 text-sm ${color}`}
    >
      {children}
    </p>
  );
}
