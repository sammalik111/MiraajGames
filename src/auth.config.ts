import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users, userFavorites } from "@/db";

// All user state now lives in Postgres. The in-memory `users`/`userFavorites`
// /`userFriends` exports are gone — every route imports the corresponding
// table from `@/db` and queries it directly with Drizzle.
export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-here",
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user) throw new Error("Invalid credentials");

        const ok = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!ok) throw new Error("Invalid credentials");

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        // Pre-load favorites onto the session so the GameCard component can
        // render the ★ state without an extra fetch on first paint.
        const favs = await db
          .select({ gameId: userFavorites.gameId })
          .from(userFavorites)
          .where(eq(userFavorites.userId, token.id as string));
        (session.user as any).favorites = favs.map((f) => f.gameId);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
