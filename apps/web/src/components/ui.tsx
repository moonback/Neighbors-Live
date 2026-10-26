import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white glow hover:brightness-110 disabled:opacity-60',
  secondary:
    'bg-white/5 text-white border border-white/10 hover:border-accent/60 hover:bg-white/10 disabled:opacity-60',
  danger: 'bg-alert text-white hover:brightness-110 disabled:opacity-60',
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2 font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-3xl border border-white/[0.07] bg-panel/80 p-5 shadow-xl shadow-black/20 ${className}`}
    >
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
  'min-h-12 w-full rounded-2xl border border-white/10 bg-ink/60 px-4 py-2 text-white placeholder:text-fog/70 transition focus:border-accent focus:bg-ink focus:outline-none focus:ring-4 focus:ring-accent/20';

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
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
        : 'border-white/10 bg-white/5 text-fog';
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl border px-4 py-2.5 text-sm ${kind === 'error' ? 'bg-alert/10' : ''} ${color}`}
    >
      {children}
    </p>
  );
}
