"use client";

// AdSense loader, injected client-side after React hydrates.
//
// Why not put <script async src="..."> directly in the SSR'd <head>?
// Because the AdSense loader, once it executes, asynchronously appends
// MORE <script> tags to <head> (the show_ads… helpers). Those tags
// appear in the DOM before React 19 finishes hydrating, and React's
// head reconciler then sees extra children that weren't in the server
// tree — hydration mismatch.
//
// Injecting via useEffect runs strictly AFTER hydration, so React never
// "sees" the AdSense scripts in its tree at all. Ads still load and
// Auto Ads still work; they just appear a tick later.

import { useEffect } from "react";

const SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3368130627100785";

export default function AdSenseLoader() {
  useEffect(() => {
    // Guard against double-injection on client-side route changes /
    // React strict-mode double-invoke.
    if (document.querySelector(`script[src^="${SRC.split("?")[0]}"]`)) return;

    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = SRC;
    document.head.appendChild(s);
  }, []);

  return null;
}
