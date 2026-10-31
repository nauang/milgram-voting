import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureVisitorCookie,
  VISITOR_COOKIE_MAX_AGE_SECONDS,
  VISITOR_COOKIE_NAME,
} from "@/lib/voter";

// voter.ts importa next/headers, que só funciona dentro de uma requisição do Next.
// Estes testes não chamam cookies(); o mock só evita o erro no import.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

function requestWithCookie(cookie?: string): NextRequest {
  return new NextRequest("http://localhost/api/vote", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ensureVisitorCookie", () => {
  it("reutiliza um cookie válido e NÃO define outro", () => {
    const id = randomUUID();
    const response = NextResponse.json({});

    const result = ensureVisitorCookie(requestWithCookie(`${VISITOR_COOKIE_NAME}=${id}`), response);

    expect(result).toBe(id);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sem cookie, gera um UUID e grava com HttpOnly, SameSite=lax, Path=/ e 1 ano", () => {
    const response = NextResponse.json({});

    const id = ensureVisitorCookie(requestWithCookie(), response);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setCookie).toContain(`${VISITOR_COOKIE_NAME}=${id}`);
    expect(setCookie).toMatch(/httponly/i);
    expect(setCookie).toMatch(/samesite=lax/i);
    expect(setCookie).toMatch(/path=\//i);
    expect(setCookie).toContain(`Max-Age=${VISITOR_COOKIE_MAX_AGE_SECONDS}`);
  });

  it("marca Secure em produção e não marca fora dela", () => {
    vi.stubEnv("NODE_ENV", "production");
    const productionResponse = NextResponse.json({});
    ensureVisitorCookie(requestWithCookie(), productionResponse);
    expect(productionResponse.headers.get("set-cookie") ?? "").toMatch(/;\s*secure/i);

    vi.stubEnv("NODE_ENV", "development");
    const developmentResponse = NextResponse.json({});
    ensureVisitorCookie(requestWithCookie(), developmentResponse);
    expect(developmentResponse.headers.get("set-cookie") ?? "").not.toMatch(/;\s*secure/i);
  });

  it("descarta um cookie com valor inválido e emite um novo", () => {
    const response = NextResponse.json({});

    const id = ensureVisitorCookie(requestWithCookie(`${VISITOR_COOKIE_NAME}=lixo`), response);

    expect(id).not.toBe("lixo");
    expect(response.headers.get("set-cookie") ?? "").toContain(`${VISITOR_COOKIE_NAME}=${id}`);
  });

  it("o cookie dura mais que a janela de 24h (senão a regra de 24h reinicia sozinha)", () => {
    expect(VISITOR_COOKIE_MAX_AGE_SECONDS).toBeGreaterThan(24 * 60 * 60);
  });
});
