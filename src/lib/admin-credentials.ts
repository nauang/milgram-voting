import { verifyPassword } from "@/lib/password";

const MAX_PASSWORD_LENGTH = 1024;

export interface AdminCredentialsInput {
  email: unknown;
  password: unknown;
}

export interface AdminCredentialsExpected {
  email: string | undefined;
  passwordHash: string | undefined;
}

/** Decide se as credenciais digitadas são as do admin. Sem efeitos colaterais além do log. */
export async function verifyAdminCredentials(
  input: AdminCredentialsInput,
  expected: AdminCredentialsExpected,
): Promise<boolean> {
  if (!expected.email || !expected.passwordHash) {
    // Falha fechada: sem configuração, ninguém entra
    console.error("Login do admin desativado: defina ADMIN_EMAIL e ADMIN_PASSWORD_HASH.");
    return false;
  }
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return false;
  }
  if (input.password.length === 0 || input.password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  // A senha é verificada SEMPRE, mesmo com e-mail errado: o tempo da resposta não revela
  // qual dos dois falhou.
  const isPasswordValid = await verifyPassword(input.password, expected.passwordHash);
  const isEmailValid = input.email.trim().toLowerCase() === expected.email.trim().toLowerCase();
  return isPasswordValid && isEmailValid;
}
