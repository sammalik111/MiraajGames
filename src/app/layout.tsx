import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron, JetBrains_Mono, VT323 } from "next/font/google";
import { eq } from "drizzle-orm";
import "./globals.css";
import { Providers } from "@/components/providers";
import AdSenseLoader from "@/components/AdSenseLoader";
import { auth } from "@/auth";
import { db, users } from "@/db";

const VALID_THEMES = new Set([
  "cyberpunk",
  "solarpunk",
  "minimal",
  "city",
  "vaporwave",
  "terminal",
  "pastel",
]);

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme/mode resolution is server-only and the DB is the only source of
  // truth. Every page load gets the user's saved preference baked into the
  // initial HTML — no localStorage, no client-side flip after hydration.
  //   - Authed + has saved theme → that theme
  //   - Anyone else → cyberpunk
  // Same model for mode: saved value wins, else "light".
  let theme = "cyberpunk";
  let mode: "light" | "dark" = "light";
  try {
    const session = await auth();
    const uid = session?.user?.id;
    if (uid) {
      const [row] = await db
        .select({ theme: users.preferredTheme, mode: users.preferredMode })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      if (row?.theme && VALID_THEMES.has(row.theme)) theme = row.theme;
      if (row?.mode === "light" || row?.mode === "dark") mode = row.mode;
    }
  } catch {
    /* auth/db blip — fall through to the cyberpunk/light defaults */
  }

  const htmlClass = `${geistSans.variable} ${geistMono.variable} ${orbitron.variable} ${jetbrains.variable} ${vt323.variable} h-full antialiased${mode === "dark" ? " dark" : ""}`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={htmlClass}
      data-theme={theme}
    >
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
