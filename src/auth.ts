import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyAdminCredentials } from "@/lib/admin-credentials";
import { checkRateLimit, getClientIp, hashIdentifier } from "@/lib/rate-limit";

/** A tela de login pode ler ?code=rate_limited para mostrar a mensagem certa. */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

/**
 * Auth do painel /admin (credenciais). A senha fica guardada só como hash scrypt
 * (ADMIN_PASSWORD_HASH): gere com scripts/hash-password.ts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials, request) => {
        // 1. Limite ANTES do scrypt: ele é caro de propósito, e sem limite cada tentativa
        //    errada gastaria CPU e memória do servidor (negação de serviço).
        const attempt = await checkRateLimit(
          "adminLogin",
          hashIdentifier(getClientIp(request.headers)),
        );
        if (!attempt.allowed) {
          throw new RateLimitedSignin();
        }

        // 2. Credenciais
        const isValid = await verifyAdminCredentials(
          { email: credentials?.email, password: credentials?.password },
          { email: process.env.ADMIN_EMAIL, passwordHash: process.env.ADMIN_PASSWORD_HASH },
        );
        if (!isValid) {
          return null;
        }
        return { id: "admin", email: process.env.ADMIN_EMAIL, name: "Admin" };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8h
  },
});
