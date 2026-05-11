import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron, JetBrains_Mono, VT323 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import AdSenseLoader from "@/components/AdSenseLoader";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Cyberpunk display + mono
const orbitron = Orbitron({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700", "900"] });
const jetbrains = JetBrains_Mono({ variable: "--font-mono-tech", subsets: ["latin"], weight: ["400", "500", "700"] });
const vt323 = VT323({ variable: "--font-term", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Miraaj Games",
  description: "A collection of experimental multiplayer web games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Runs before React hydrates — reads BOTH the theme name and the
  // light/dark mode from localStorage and applies them to <html> so
  // the first paint matches the user's preference (no flash).
  //   localStorage 'theme' : "cyberpunk" | "solarpunk" | "minimal" | "city"
  //   localStorage 'mode'  : "light" | "dark"
  // Backward-compat: older deployments stored "light"/"dark" under the
  // 'theme' key. We detect that and migrate it to 'mode'.
  const themeInit = `
    (function () {
      try {
        var THEMES = ['cyberpunk', 'solarpunk', 'minimal', 'city', 'vaporwave', 'terminal', 'pastel'];
        var savedTheme = localStorage.getItem('theme');
        var savedMode = localStorage.getItem('mode');
        // Migrate old format: theme key holding 'light'/'dark'.
        if (savedTheme === 'light' || savedTheme === 'dark') {
          if (!savedMode) savedMode = savedTheme;
          savedTheme = null;
          try {
            localStorage.removeItem('theme');
            localStorage.setItem('mode', savedMode);
          } catch (_) {}
        }
        var theme = THEMES.indexOf(savedTheme) >= 0 ? savedTheme : 'cyberpunk';
        document.documentElement.setAttribute('data-theme', theme);
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var dark = savedMode ? savedMode === 'dark' : prefersDark;
        if (dark) document.documentElement.classList.add('dark');
      } catch (_) {}
    })();
  `;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} ${jetbrains.variable} ${vt323.variable} h-full antialiased`}
    >
      <head>
        {/* Theme-init runs synchronously during HTML parsing, before
            React hydrates. Sets <html data-theme> + .dark so the first
            paint matches the user's saved preference. Safe to keep in
            SSR'd <head> — it only mutates attributes on <html>, never
            adds new <script> children that would confuse hydration. */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        {/* AdSense loader is injected client-side after hydration.
            Keeping it out of the SSR'd <head> dodges the hydration
            mismatch caused by AdSense dynamically adding more <script>
            tags before React mounts. */}
        <AdSenseLoader />
      </body>
    </html>
  );
}
