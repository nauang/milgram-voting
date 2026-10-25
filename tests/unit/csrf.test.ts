import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/csrf";

const SITE_HOST = "milgram.example";

function post(headers: Record<string, string>): NextRequest {
  return new NextRequest(`https://${SITE_HOST}/api/vote`, { method: "POST", headers });
}

describe("isSameOriginRequest", () => {
  it("aceita Sec-Fetch-Site: same-origin", () => {
    expect(isSameOriginRequest(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it.each(["cross-site", "same-site", "none"])("rejeita Sec-Fetch-Site: %s", (value) => {
    expect(isSameOriginRequest(post({ "sec-fetch-site": value }))).toBe(false);
  });

  it("Sec-Fetch-Site tem precedência sobre um Origin 'bom'", () => {
    const request = post({
      "sec-fetch-site": "cross-site",
      origin: `https://${SITE_HOST}`,
      "x-forwarded-host": SITE_HOST,
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("sem Sec-Fetch-Site, aceita Origin igual ao host", () => {
    const request = post({ origin: `https://${SITE_HOST}`, "x-forwarded-host": SITE_HOST });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("sem Sec-Fetch-Site, rejeita Origin de outro site", () => {
    const request = post({
      origin: "https://site-malicioso.example",
      "x-forwarded-host": SITE_HOST,
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("rejeita Origin 'null' e Origin malformado", () => {
    expect(isSameOriginRequest(post({ origin: "null", "x-forwarded-host": SITE_HOST }))).toBe(
      false,
    );
    expect(isSameOriginRequest(post({ origin: "%%%", "x-forwarded-host": SITE_HOST }))).toBe(false);
  });

  it("aceita cliente que não é navegador (sem os dois cabeçalhos)", () => {
    expect(isSameOriginRequest(post({}))).toBe(true);
  });
});
