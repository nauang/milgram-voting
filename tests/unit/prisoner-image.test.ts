import { describe, expect, it } from "vitest";
import { getPrisonerImage } from "@/lib/prisoner-image";

const images = [
  { season: 1, url: "s1.webp" },
  { season: 2, url: "s2.webp" },
];

describe("getPrisonerImage", () => {
  it("retorna a imagem exata da temporada", () => {
    expect(getPrisonerImage(images, 2)?.url).toBe("s2.webp");
  });

  it("cai para a mais recente disponível se a temporada não existir", () => {
    expect(getPrisonerImage(images, 3)?.url).toBe("s2.webp");
  });

  it("cai para a mais antiga se todas forem futuras", () => {
    expect(getPrisonerImage([{ season: 3, url: "s3.webp" }], 1)?.url).toBe("s3.webp");
  });

  it("retorna undefined se o array estiver vazio", () => {
    expect(getPrisonerImage([], 1)).toBeUndefined();
  });
});
