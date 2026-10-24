import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth simples com Credentials para o painel /admin.
 * Em produção real: usar hash de senha (bcrypt) e email validado.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (
          typeof credentials?.email === "string" &&
          typeof credentials?.password === "string" &&
          credentials.email === adminEmail &&
          credentials.password === adminPassword
        ) {
          return { id: "admin", email: adminEmail, name: "Admin" };
        }
        return null;
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
