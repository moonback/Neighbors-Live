import type { Category } from '@nl/shared';

const ICONS: Record<Category, string> = {
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.01',
  deal: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  event: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  help: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  shop: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M10 20v-5h4v5',
  lost: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
};

export function CategoryIcon({
  category,
  className = 'h-4 w-4',
}: {
  category: Category;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={ICONS[category]} />
    </svg>
  );
}
