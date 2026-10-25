import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { isValidVisitorId } from "@/lib/voter-key";

export const VISITOR_COOKIE_NAME = "milgram_vid";
export const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 ano

/**
 * Gera o voterKey a partir do cookie + IP + salt.
 * Nunca armazena IP puro (PROMPT §8).
 */
export function buildVoterKey(cookieId: string, ip: string): string {
  const salt = process.env.VOTER_SALT ?? "dev-salt-change-me";
  return createHash("sha256").update(`${cookieId}:${ip}:${salt}`).digest("hex");
}

/**
 * Extrai o IP do request. Prioriza x-forwarded-for (Vercel/Cloudflare).
 */
export function extractIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

/**
 * Lê o cookie do visitante em um Server Component.
 * Retorna null se não existir (primeira visita).
 */
export async function getVisitorCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? null;
}

/**
 * Garante que o cookie do visitante exista. Se não existir (ou for inválido), cria um.
 * Usado no POST /api/vote.
 */
export function ensureVisitorCookie(request: NextRequest, response: NextResponse): string {
  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (existing && isValidVisitorId(existing)) return existing;

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
