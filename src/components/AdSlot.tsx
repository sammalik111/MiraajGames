"use client";

// Manual AdSense ad unit. Drop one wherever you want an ad to appear.
//
// Usage:
//   <AdSlot slot="1234567890" format="auto" />
//
// `slot` is the numeric "ad unit" id from your AdSense dashboard
// (Ad units → Display ads → copy the data-ad-slot value).
//
// `format`:
//   "auto"        — responsive, fills container width; Google picks size
//   "fluid"       — in-feed / matched-content (needs `layoutKey`)
//   "rectangle"   — fixed 336×280 / 300×250
//
// AdSense doesn't serve in dev. On `localhost` this renders a placeholder
// so you can see where the ad will land without breaking the layout.

import { useEffect, useRef } from "react";

interface Props {
  slot: string;
  format?: "auto" | "fluid" | "rectangle";
  layoutKey?: string;
  className?: string;
  // Style overrides; default is `display:block` which Google needs.
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

const PUBLISHER_ID = "ca-pub-3368130627100785";

export default function AdSlot({
  slot,
  format = "auto",
  layoutKey,
  className = "",
  style,
}: Props) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    // Skip in dev — AdSense refuses localhost and React strict-mode would
    // double-push, both of which spam the console.
    if (process.env.NODE_ENV !== "production") return;
    if (pushedRef.current) return;
    if (!insRef.current) return;

    try {
      // Activate this specific <ins>. The push is what tells AdSense
      // "fill the most recent unfilled ad slot on the page."
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      /* swallow — AdSense often throws when an ad-blocker hides the
         script. Leaving this silent so a blocked ad doesn't crash the
         page. */
    }
  }, []);

  // Dev placeholder so you can see ad placement without serving.
  if (process.env.NODE_ENV !== "production") {
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-2)] py-8 ${className}`}
        style={style}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          ▸ AdSense slot {slot} (dev placeholder)
        </span>
      </div>
    );
  }

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={{ display: "block", ...style }}
      data-ad-client={PUBLISHER_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
      {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
    />
  );
}
