import type { NextRequest } from "next/server";

/**
 * Defesa em profundidade contra requisições forjadas por OUTRO site em rotas de escrita.
 * Não usamos token clássico: o voto é anônimo (não há sessão a sequestrar) e os cookies são
 * SameSite=Lax, que o navegador não envia em POST de outro site. Aqui só barramos o que um
 * navegador declara vir de fora.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  // Sec-Fetch-Site é definido pelo navegador; o JavaScript de uma página não consegue alterá-lo
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) {
    return fetchSite === "same-origin";
  }

  // Navegadores mais antigos: cai para o cabeçalho Origin
  const origin = request.headers.get("origin");
  if (origin) {
    const expectedHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
    try {
      return new URL(origin).host === expectedHost;
    } catch {
      return false; // "null" (iframe sandbox) e valores malformados
    }
  }

  // Nenhum dos dois: cliente que não é navegador (curl, testes). CSRF só existe em navegador.
  return true;
}

export function crossOriginResponse(): Response {
  return Response.json(
    { code: "CSRF_INVALID", error: "Origem da requisição não permitida." },
    { status: 403 },
  );
}
