"use client";

// Sticky jump-link nav for the home library section. Same pattern as
// the profile page's section nav: all underlying sections render
// eagerly in the DOM, this just helps the user jump between them as
// they scroll.
//
// Active section is highlighted via IntersectionObserver — no
// conditional rendering, no fetches gated.

import { useEffect, useState } from "react";

interface Section {
  id: string;
  label: string;
  count: number;
}

interface Props {
  sections: Section[];
}

export default function LibraryNav({ sections }: Props) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-30% 0px -50% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Library sections"
      className="sticky top-0 z-20 mt-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-[color:var(--bg)]/85 backdrop-blur-xl border-y border-[color:var(--border)]"
    >
      <ul className="flex gap-1 overflow-x-auto -mx-1 px-1 [scrollbar-width:none]">
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`relative flex items-center gap-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.22em] px-3 py-2 transition ${
                  isActive
                    ? "text-[color:var(--neon-cyan)]"
                    : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                }`}
              >
                <span>{s.label}</span>
                <span
                  className={`font-mono text-[9px] tabular-nums ${
                    isActive
                      ? "text-[color:var(--neon-cyan)]/70"
                      : "text-[color:var(--fg-muted)]"
                  }`}
                >
                  {s.count}
                </span>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-2 right-2 -bottom-px h-0.5 bg-[color:var(--neon-cyan)]"
                  />
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
