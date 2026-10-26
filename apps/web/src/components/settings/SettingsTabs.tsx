'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

interface Tab {
  id: 'profile' | 'preferences' | 'account';
  label: string;
  content: ReactNode;
}

export function SettingsTabs({ tabs, ariaLabel }: { tabs: Tab[]; ariaLabel: string }) {
  const [active, setActive] = useState<Tab['id']>('profile');
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    setActive(next.id);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.07] bg-panel/60 p-1.5"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={`settings-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors ${active === tab.id ? 'glow bg-accent text-white' : 'text-fog hover:bg-white/5 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`settings-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab.id}`}
          tabIndex={0}
          hidden={active !== tab.id}
          className="flex flex-col gap-4 focus-visible:rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
