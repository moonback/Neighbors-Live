'use client';

import { CATEGORIES, CATEGORY_COLORS, RADII_M, type Category } from '@nl/shared';
import { useTranslations } from 'next-intl';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet } from '@/components/feed/Sheet';

export function MapFiltersDialog({
  open,
  category,
  radius,
  onCategoryChange,
  onRadiusChange,
  onClose,
}: {
  open: boolean;
  category: Category | null;
  radius: number;
  onCategoryChange: (category: Category | null) => void;
  onRadiusChange: (radius: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('map.filters');
  const tf = useTranslations('feed.filters');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} title={t('title')} onClose={onClose} closeLabel={tc('actions.close')}>
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">{tf('label')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CategoryButton active={category === null} onClick={() => onCategoryChange(null)}>
              {tf('all')}
            </CategoryButton>
            {CATEGORIES.map((item) => (
              <CategoryButton
                key={item}
                active={category === item}
                onClick={() => onCategoryChange(item)}
              >
                <span style={{ color: category === item ? undefined : CATEGORY_COLORS[item] }}>
                  <CategoryIcon category={item} />
                </span>
                {tc(`categories.${item}`)}
              </CategoryButton>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label htmlFor="map-radius" className="text-sm font-semibold">
            {tf('radius')}
          </label>
          <select
            id="map-radius"
            value={radius}
            onChange={(event) => onRadiusChange(Number(event.target.value))}
            className="glass min-h-12 w-full rounded-xl px-4 text-sm font-semibold"
          >
            {RADII_M.map((value) => (
              <option key={value} value={value}>
                {tc(`radius.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Sheet>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition ${active ? 'glow bg-accent font-semibold text-white' : 'glass text-white/90 hover:text-white'}`}
    >
      {children}
    </button>
  );
}
