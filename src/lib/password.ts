import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export interface ScryptParams {
  /** N = 2^log2N (custo de CPU/memória). */
  log2N: number;
  r: number;
  p: number;
}

// OWASP: scrypt com N=2^16, r=8, p=2 (cerca de 64 MiB por verificação).
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { log2N: 16, r: 8, p: 2 };

const FORMAT_PREFIX = "scrypt";
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// Limites defensivos ao LER um hash guardado (evita custo absurdo vindo de uma env corrompida)
const MAX_LOG2N = 17;
const MAX_R_OR_P = 16;

interface ParsedHash extends ScryptParams {
  salt: Buffer;
  key: Buffer;
}

function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const N = 2 ** params.log2N;
  const options: ScryptOptions = { N, r: params.r, p: params.p, maxmem: 256 * N * params.r };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Formato: scrypt.<log2N>.<r>.<p>.<salt>.<hash>. Só usa [A-Za-z0-9._-], seguro em .env
 * (o Next expande "$") e nas variáveis de ambiente da Vercel. Os parâmetros ficam DENTRO
 * do hash, para poder aumentar o custo no futuro sem invalidar senhas antigas.
 */
export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, params);
  return [
    FORMAT_PREFIX,
    params.log2N,
    params.r,
    params.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join(".");
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split(".");
  if (parts.length !== 6 || parts[0] !== FORMAT_PREFIX) {
    return null;
  }
  const log2N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const key = Buffer.from(parts[5] ?? "", "base64url");

  const isValid =
    Number.isInteger(log2N) &&
    log2N >= 10 &&
    log2N <= MAX_LOG2N &&
    Number.isInteger(r) &&
    r >= 1 &&
    r <= MAX_R_OR_P &&
    Number.isInteger(p) &&
    p >= 1 &&
    p <= MAX_R_OR_P &&
    salt.length >= 8 &&
    key.length === KEY_LENGTH;

  return isValid ? { log2N, r, p, salt, key } : null;
}

/** Nunca lança por causa de um hash inválido: devolve false (e gasta um custo parecido). */
export async function verifyPassword(
  password: string,
  storedHash: string | undefined,
): Promise<boolean> {
  const parsed = storedHash ? parseHash(storedHash) : null;
  if (!parsed) {
    await deriveKey(password, Buffer.alloc(SALT_LENGTH), DEFAULT_SCRYPT_PARAMS);
    return false;
  }
  const candidate = await deriveKey(password, parsed.salt, parsed);
  return timingSafeEqual(candidate, parsed.key);
}
