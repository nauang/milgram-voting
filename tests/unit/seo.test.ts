import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { buildPageMetadata, buildSitemapEntries } from "@/lib/seo";

describe("buildPageMetadata", () => {
  const base = { title: "MILGRAM | Teste", description: "Descrição", path: "/judge" };

  it("define canonical, Open Graph e Twitter sem imagem", () => {
    const metadata = buildPageMetadata(base);

    expect(metadata.alternates?.canonical).toBe("/judge");
    expect(metadata.openGraph).toMatchObject({
      siteName: "MILGRAM Voting",
      locale: "pt_BR",
      url: "/judge",
      title: "MILGRAM | Teste",
    });
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).toMatchObject({ card: "summary" });
  });

  it("inclui a imagem e usa summary_large_image quando há imagem", () => {
    const metadata = buildPageMetadata({ ...base, imageUrl: "https://img.example/a.png" });

    expect(metadata.openGraph).toMatchObject({ images: [{ url: "https://img.example/a.png" }] });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://img.example/a.png"],
    });
  });

  it("trata imageUrl nula como ausente", () => {
    expect(buildPageMetadata({ ...base, imageUrl: null }).twitter).toMatchObject({
      card: "summary",
    });
  });
});

describe("buildSitemapEntries", () => {
  const entries = buildSitemapEntries("https://site.example", ["haruka", "yuno"], [1]);
  const urls = entries.map((entry) => entry.url);

  it("lista julgamento, personagens e resultados das temporadas encerradas", () => {
    expect(urls).toEqual([
      "https://site.example/judge",
      "https://site.example/character",
      "https://site.example/character/haruka",
      "https://site.example/character/yuno",
      "https://site.example/judge/result/1",
    ]);
  });

  it("nunca inclui o admin, a API nem a raiz (que só redireciona)", () => {
    expect(urls.some((url) => url.includes("/admin") || url.includes("/api"))).toBe(false);
    expect(urls).not.toContain("https://site.example/");
  });

  it("não lista resultado de temporada ainda não encerrada", () => {
    expect(buildSitemapEntries("https://site.example", [], [])).toHaveLength(2);
  });
});

describe("robots", () => {
  it("bloqueia /admin e /api e aponta para o sitemap", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.disallow).toEqual(["/admin", "/api/"]);
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
