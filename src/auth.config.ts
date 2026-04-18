import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Simple in-memory user store for demo purposes
const users: Array<{
  id: string;
  email: string;
  name?: string;
  password: string;
}> = [];


// store in a separate storage each users favourite game ids
let userFavorites: Record<string, number[]> = {};


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

        const user = users.find(u => u.email === credentials.email);

        if (!user) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).favorites = userFavorites[token.id as string] ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

// Export the users array for registration
export { users, userFavorites };