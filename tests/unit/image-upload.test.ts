import { describe, expect, it, vi } from "vitest";
import { MAX_IMAGE_SIZE, validateImageUpload, type AllowedImageType } from "@/lib/image-upload";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const JPEG_HEADER = [0xff, 0xd8, 0xff];

const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

function createTestFile(bytes: readonly number[], type: string, name = "imagem.bin"): File {
  return new File([Uint8Array.from(bytes)], name, { type });
}

function createPngFile(): File {
  return createTestFile(PNG_HEADER, "image/png", "imagem.png");
}

describe("validateImageUpload", () => {
  describe("formatos permitidos", () => {
    const formats: {
      type: AllowedImageType;
      header: number[];
      extension: string;
    }[] = [
      {
        type: "image/png",
        header: PNG_HEADER,
        extension: "png",
      },
      {
        type: "image/jpeg",
        header: JPEG_HEADER,
        extension: "jpg",
      },
      {
        type: "image/webp",
        header: WEBP_HEADER,
        extension: "webp",
      },
    ];

    it.each(formats)("aceita assinatura $type", async ({ type, header, extension }) => {
      const file = createTestFile(header, type, `imagem.${extension}`);

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        throw new Error(result.error);
      }

      expect(result.data.contentType).toBe(type);
      expect(result.data.extension).toBe(extension);
      expect(result.data.storagePath).toBe(`haruka/season-1.${extension}`);
      expect(result.data.data).toEqual(Buffer.from(header));
      expect(result.data.size).toBe(header.length);
    });
  });

  describe("validação do arquivo", () => {
    it("rejeita arquivo ausente", async () => {
      const result = await validateImageUpload({
        file: undefined,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_FILE",
      });
    });

    it("rejeita objeto que não é File", async () => {
      const result = await validateImageUpload({
        file: {
          name: "fake.png",
          type: "image/png",
          size: 100,
        },
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_FILE",
      });
    });

    it("rejeita arquivo vazio", async () => {
      const file = new File([], "vazio.png", { type: "image/png" });

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "EMPTY_FILE",
      });
    });

    it("aceita exatamente 2 MiB", async () => {
      const bytes = new Uint8Array(MAX_IMAGE_SIZE);
      bytes.set(PNG_HEADER, 0);

      const file = new File([bytes], "limite.png", { type: "image/png" });

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.size).toBe(MAX_IMAGE_SIZE);
      }
    });

    it("rejeita arquivo maior que 2 MiB", async () => {
      const bytes = new Uint8Array(MAX_IMAGE_SIZE + 1);
      bytes.set(PNG_HEADER, 0);

      const file = new File([bytes], "grande.png", { type: "image/png" });

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "FILE_TOO_LARGE",
      });
    });

    it.each(["application/pdf", "image/svg+xml", "text/html", "application/octet-stream"])(
      "rejeita MIME %s",
      async (type) => {
        const file = createTestFile(PNG_HEADER, type);

        const result = await validateImageUpload({
          file,
          prisonerSlug: "haruka",
          season: 1,
        });

        expect(result).toMatchObject({
          success: false,
          code: "INVALID_TYPE",
        });
      },
    );

    it("rejeita assinatura PNG falsificada", async () => {
      const file = createTestFile([0x00, 0x00, 0x00, 0x00], "image/png");

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_SIGNATURE",
      });
    });

    it("rejeita JPEG com conteúdo PNG", async () => {
      const file = createTestFile(PNG_HEADER, "image/jpeg");

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_SIGNATURE",
      });
    });

    it("rejeita WebP sem cabeçalho RIFF", async () => {
      const file = createTestFile(
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
        "image/webp",
      );

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_SIGNATURE",
      });
    });

    it("trata falha de leitura do arquivo", async () => {
      const file = createPngFile();

      vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("Falha simulada de leitura"));

      const result = await validateImageUpload({
        file,
        prisonerSlug: "haruka",
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "READ_ERROR",
      });

      vi.restoreAllMocks();
    });
  });

  describe("validação dos prisioneiros", () => {
    const validSlugs = [
      "haruka",
      "yuno",
      "futa",
      "mu",
      "shidou",
      "mahiru",
      "kazui",
      "amane",
      "mikoto",
      "kotoko",
    ];

    it.each(validSlugs)("aceita o prisioneiro %s", async (prisonerSlug) => {
      const result = await validateImageUpload({
        file: createPngFile(),
        prisonerSlug,
        season: 1,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.prisonerSlug).toBe(prisonerSlug);
      }
    });

    it.each(["unknown", "Haruka", "../haruka", "../../admin", "haruka/../../admin", ""])(
      "rejeita slug inválido: %s",
      async (prisonerSlug) => {
        const result = await validateImageUpload({
          file: createPngFile(),
          prisonerSlug,
          season: 1,
        });

        expect(result).toMatchObject({
          success: false,
          code: "INVALID_PRISONER",
        });
      },
    );

    it("rejeita slug que não é texto", async () => {
      const result = await validateImageUpload({
        file: createPngFile(),
        prisonerSlug: 123,
        season: 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_PRISONER",
      });
    });
  });

  describe("validação das temporadas", () => {
    it.each([1, 2, 3])("aceita a temporada %i", async (season) => {
      const result = await validateImageUpload({
        file: createPngFile(),
        prisonerSlug: "haruka",
        season,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.season).toBe(season);
        expect(result.data.storagePath).toBe(`haruka/season-${season}.png`);
      }
    });

    it("aceita temporada como string numérica", async () => {
      const result = await validateImageUpload({
        file: createPngFile(),
        prisonerSlug: "haruka",
        season: "2",
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.season).toBe(2);
      }
    });

    it.each([0, 4, -1, 1.5, "abc", "01", "1.0", "", null, undefined])(
      "rejeita temporada inválida: %s",
      async (season) => {
        const result = await validateImageUpload({
          file: createPngFile(),
          prisonerSlug: "haruka",
          season,
        });

        expect(result).toMatchObject({
          success: false,
          code: "INVALID_SEASON",
        });
      },
    );
  });

  describe("segurança do caminho de armazenamento", () => {
    it("ignora o nome original do arquivo", async () => {
      const file = createTestFile(PNG_HEADER, "image/png", "../../arquivo-malicioso.png");

      const result = await validateImageUpload({
        file,
        prisonerSlug: "mikoto",
        season: 3,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.storagePath).toBe("mikoto/season-3.png");

        expect(result.data.storagePath).not.toContain("..");
      }
    });

    it("gera caminhos diferentes por temporada", async () => {
      const paths: string[] = [];

      for (const season of [1, 2, 3]) {
        const result = await validateImageUpload({
          file: createPngFile(),
          prisonerSlug: "kotoko",
          season,
        });

        expect(result.success).toBe(true);

        if (result.success) {
          paths.push(result.data.storagePath);
        }
      }

      expect(paths).toEqual(["kotoko/season-1.png", "kotoko/season-2.png", "kotoko/season-3.png"]);

      expect(new Set(paths).size).toBe(3);
    });
  });
});
