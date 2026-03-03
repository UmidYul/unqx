import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { env } from "@/lib/env";

function authLog(message: string, meta?: Record<string, unknown>) {
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[auth] ${message}${payload}`);
}

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
        authLog("authorize:start", {
          hasCredentials: Boolean(credentials),
          keys: credentials ? Object.keys(credentials) : [],
          processEnvHashLen: (process.env.ADMIN_PASSWORD_HASH || "").length,
          processEnvHashPrefix: (process.env.ADMIN_PASSWORD_HASH || "").slice(0, 12),
          envHashLen: env.ADMIN_PASSWORD_HASH.length,
          envHashPrefix: env.ADMIN_PASSWORD_HASH.slice(0, 12),
        });

        const loginRaw = credentials?.login;
        const passwordRaw = credentials?.password;

        const login = typeof loginRaw === "string" ? loginRaw.trim() : "";
        const password = typeof passwordRaw === "string" ? passwordRaw : "";

        if (!login || !password) {
          authLog("authorize:missing-fields", {
            hasLogin: Boolean(login),
            hasPassword: Boolean(password),
          });
          return null;
        }

        const expectedLogin = env.ADMIN_LOGIN.trim();
        if (login !== expectedLogin) {
          authLog("authorize:login-mismatch", {
            login,
            expectedLogin,
          });
          return null;
        }

        try {
          const ok = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
          if (!ok) {
            authLog("authorize:password-mismatch", {
              login,
              hashPrefix: env.ADMIN_PASSWORD_HASH.slice(0, 7),
              hashLength: env.ADMIN_PASSWORD_HASH.length,
            });
            return null;
          }
        } catch (error) {
          authLog("authorize:bcrypt-error", {
            login,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }

        authLog("authorize:success", { login });
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
