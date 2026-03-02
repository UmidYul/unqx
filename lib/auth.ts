import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { env } from "@/lib/env";
import { LoginSchema } from "@/lib/validation";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/admin",
  },
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        if (parsed.data.login !== env.ADMIN_LOGIN) {
          return null;
        }

        const ok = await bcrypt.compare(parsed.data.password, env.ADMIN_PASSWORD_HASH);
        if (!ok) {
          return null;
        }

        return {
          id: "admin",
          name: "Администратор",
          email: "admin@unqx.local",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = "admin";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "admin";
      }

      return session;
    },
  },
  secret: env.NEXTAUTH_SECRET,
};
