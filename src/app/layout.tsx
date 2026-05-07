import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron, JetBrains_Mono, VT323 } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

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
  // Runs before React hydrates — reads BOTH the chosen theme and the
  // chosen mode from localStorage and applies them to <html> so the first
  // paint matches the user's preference (no flash). Two keys:
  //   theme : "cyberpunk" | "solarpunk" | "minimal" | "city"  (default cyberpunk)
  //   mode  : "light" | "dark"                                (default OS preference)
  const themeInit = `
    (function () {
      try {
        var THEMES = ['cyberpunk', 'solarpunk', 'minimal', 'city'];
        var savedTheme = localStorage.getItem('theme');
        var theme = THEMES.indexOf(savedTheme) >= 0 ? savedTheme : 'cyberpunk';
        document.documentElement.setAttribute('data-theme', theme);

        var savedMode = localStorage.getItem('mode');
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
        {/* Theme init must run before first paint to avoid a white flash —
            beforeInteractive injects it ahead of hydration. Plain <script>
            tags in JSX are no-ops on client renders in React 19. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        {/* Google AdSense — async, loaded once at the document level. */}
        <Script
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3368130627100785"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
