import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { isValidVisitorId } from "@/lib/voter-key";

export const VISITOR_COOKIE_NAME = "milgram_vid";

// 1 ano. Precisa ser MAIOR que a janela de voto (24h): se o cookie expirasse antes, o
// visitante ganharia uma identidade nova e poderia votar de novo antes da hora.
export const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Lê o cookie do visitante em um Server Component.
 * Retorna null se não existir (primeira visita) ou se o valor for inválido.
 */
export async function getVisitorCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(VISITOR_COOKIE_NAME)?.value;
  return isValidVisitorId(value) ? value : null;
}

/**
 * Garante que o cookie do visitante exista. Se não existir (ou for inválido), cria um.
 * Usado no POST /api/vote. O cookie só vai na resposta que o receber.
 */
export function ensureVisitorCookie(request: NextRequest, response: NextResponse): string {
  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (isValidVisitorId(existing)) {
    return existing;
  }

  const newId = randomUUID();
  response.cookies.set(VISITOR_COOKIE_NAME, newId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return newId;
}
