import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_SIZE,
  validateImageUpload,
  type AllowedImageType,
  type ValidatedImageUpload,
} from "@/lib/image-upload";

import { processImageForStorage } from "@/lib/image-processing";

type ImageFormat = "png" | "jpeg" | "webp";

type AlphaPattern = "opaque" | "partial" | "mixed";

const CONTENT_TYPES: Record<ImageFormat, AllowedImageType> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Cria uma imagem real em memória utilizando Sharp.
 *
 * Não depende de arquivos externos ou do Supabase.
 */
async function createImage(format: ImageFormat, width = 40, height = 60): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: 190,
        g: 40,
        b: 100,
        alpha: 1,
      },
    },
  })
    .toFormat(format)
    .toBuffer();
}

/**
 * Valida um buffer real usando o mesmo fluxo
 * de entrada utilizado pela API administrativa.
 */
async function validateImageBuffer(
  buffer: Buffer,
  format: ImageFormat,
  prisonerSlug = "haruka",
  season = 1,
): Promise<ValidatedImageUpload> {
  const file = new File([Uint8Array.from(buffer)], `imagem.${format}`, {
    type: CONTENT_TYPES[format],
  });

  const result = await validateImageUpload({
    file,
    prisonerSlug,
    season,
  });

  if (!result.success) {
    throw new Error(`Falha ao preparar imagem de teste: ${result.error}`);
  }

  return result.data;
}

/**
 * Passa uma imagem real pelo validador de upload.
 */
async function createValidatedUpload(
  format: ImageFormat = "png",
  width = 40,
  height = 60,
  prisonerSlug = "haruka",
  season = 1,
): Promise<ValidatedImageUpload> {
  const buffer = await createImage(format, width, height);

  return validateImageBuffer(buffer, format, prisonerSlug, season);
}

/**
 * Cria pixels RGBA com cores variadas.
 *
 * Usamos padrões determinísticos para detectar
 * alterações sutis de RGB e transparência.
 *
 * opaque:
 *   Todos os pixels possuem alpha = 255.
 *
 * partial:
 *   Pixels possuem transparência parcial,
 *   mas nunca são totalmente invisíveis.
 *
 * mixed:
 *   Inclui pixels opacos, parcialmente
 *   transparentes e totalmente transparentes.
 */
function createPixelPattern(width: number, height: number, alphaPattern: AlphaPattern): Buffer {
  const pixels = Buffer.alloc(width * height * 4);

  const partialAlpha = [1, 16, 63, 127, 192, 254];
  const mixedAlpha = [0, 1, 64, 127, 255];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const position = y * width + x;

      pixels[index] = (x * 47 + y * 13) % 256;
      pixels[index + 1] = (x * 19 + y * 67) % 256;
      pixels[index + 2] = (x * 83 + y * 29) % 256;

      if (alphaPattern === "opaque") {
        pixels[index + 3] = 255;
      } else if (alphaPattern === "partial") {
        pixels[index + 3] = partialAlpha[position % partialAlpha.length];
      } else {
        pixels[index + 3] = mixedAlpha[position % mixedAlpha.length];
      }
    }
  }

  return pixels;
}

/**
 * Codifica o padrão RGBA em PNG.
 *
 * As dimensões utilizadas nos testes de
 * fidelidade permanecem abaixo dos limites
 * de redimensionamento do processador.
 */
async function createPatternPng(
  width: number,
  height: number,
  alphaPattern: AlphaPattern,
): Promise<Buffer> {
  const pixels = createPixelPattern(width, height, alphaPattern);

  return sharp(pixels, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Decodifica uma imagem em pixels RGBA.
 *
 * O formato RGBA permite comparar imagens
 * originalmente codificadas em PNG, JPEG
 * ou WebP usando o mesmo espaço de dados.
 */
async function decodeRgba(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  expect(info.channels).toBe(4);

  return data;
}

/**
 * Processa um arquivo real e retorna o buffer
 * WebP produzido pelo módulo de produção.
 */
async function processImageBuffer(buffer: Buffer, format: ImageFormat): Promise<Buffer> {
  const upload = await validateImageBuffer(buffer, format);

  const result = await processImageForStorage(upload);

  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.data.contentType).toBe("image/webp");

  return result.data.data;
}

/**
 * Compara pixels RGBA levando em consideração
 * a transparência total.
 *
 * Pixels com alpha > 0 devem manter todos
 * os quatro canais exatamente iguais.
 *
 * Pixels com alpha = 0 precisam continuar
 * totalmente transparentes, mas seus valores
 * RGB invisíveis podem ser normalizados
 * pelo codificador.
 */
function expectVisiblePixelsEqual(original: Buffer, processed: Buffer): void {
  expect(processed.length).toBe(original.length);
  expect(original.length % 4).toBe(0);

  for (let index = 0; index < original.length; index += 4) {
    const originalAlpha = original[index + 3];
    const processedAlpha = processed[index + 3];

    expect(processedAlpha).toBe(originalAlpha);

    if (originalAlpha > 0) {
      expect(processed.subarray(index, index + 3)).toEqual(original.subarray(index, index + 3));
    }
  }
}

/**
 * GIF animado de teste com dois quadros de 4x4 pixels.
 *
 * É convertido para WebP animado antes do teste.
 * Não contém dados externos nem depende da rede.
 */
const ANIMATED_GIF_BASE64 =
  "R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh" +
  "+QQACgAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBCgABACwAAAAABAAE" +
  "AIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7";

describe("processImageForStorage", () => {
  describe("conversão para WebP", () => {
    it.each(["png", "jpeg", "webp"] as const)("processa uma imagem %s válida", async (format) => {
      const upload = await createValidatedUpload(format);

      const result = await processImageForStorage(upload);

      expect(result.success).toBe(true);

      if (!result.success) {
        throw new Error(result.error);
      }

      expect(result.data.contentType).toBe("image/webp");

      expect(result.data.storagePath).toBe("haruka/season-1.webp");

      const metadata = await sharp(result.data.data).metadata();

      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(40);
      expect(metadata.height).toBe(60);
    });

    it("retorna dados consistentes após a conversão", async () => {
      const upload = await createValidatedUpload("jpeg", 100, 150, "mikoto", 3);

      const result = await processImageForStorage(upload);

      expect(result.success).toBe(true);

      if (!result.success) {
        throw new Error(result.error);
      }

      expect(result.data).toMatchObject({
        prisonerSlug: "mikoto",
        season: 3,
        contentType: "image/webp",
        storagePath: "mikoto/season-3.webp",
        width: 100,
        height: 150,
      });

      expect(result.data.size).toBe(result.data.data.length);

      expect(result.data.size).toBeGreaterThan(0);

      expect(result.data.size).toBeLessThanOrEqual(MAX_IMAGE_SIZE);
    });
  });

  describe("fidelidade sem perdas", () => {
    it("preserva exatamente os pixels opacos de um PNG", async () => {
      const source = await createPatternPng(29, 41, "opaque");

      const output = await processImageBuffer(source, "png");

      const originalPixels = await decodeRgba(source);
      const processedPixels = await decodeRgba(output);

      // Todos os pixels são opacos. Portanto,
      // os buffers RGBA devem ser idênticos.
      expect(processedPixels).toEqual(originalPixels);
    });

    it("preserva exatamente cores e alpha parcial", async () => {
      const source = await createPatternPng(31, 43, "partial");

      const output = await processImageBuffer(source, "png");

      const originalPixels = await decodeRgba(source);
      const processedPixels = await decodeRgba(output);

      // Nenhum pixel é totalmente transparente.
      // Todos os canais devem permanecer iguais.
      expect(processedPixels).toEqual(originalPixels);

      const metadata = await sharp(output).metadata();

      expect(metadata.hasAlpha).toBe(true);
    });

    it("preserva pixels visíveis e transparência total", async () => {
      const source = await createPatternPng(37, 47, "mixed");

      const output = await processImageBuffer(source, "png");

      const originalPixels = await decodeRgba(source);
      const processedPixels = await decodeRgba(output);

      expectVisiblePixelsEqual(originalPixels, processedPixels);

      // Confirma que o teste realmente contém
      // pixels completamente transparentes.
      let transparentPixels = 0;
      let partialPixels = 0;

      for (let index = 3; index < originalPixels.length; index += 4) {
        const alpha = originalPixels[index];

        if (alpha === 0) {
          transparentPixels++;
        } else if (alpha < 255) {
          partialPixels++;
        }
      }

      expect(transparentPixels).toBeGreaterThan(0);
      expect(partialPixels).toBeGreaterThan(0);
    });

    it("não introduz novas perdas em um JPEG já decodificado", async () => {
      const width = 39;
      const height = 53;

      const pixels = createPixelPattern(width, height, "opaque");

      // O JPEG de entrada já pode conter perdas.
      // Comparamos os pixels decodificados,
      // não os pixels anteriores à codificação JPEG.
      const source = await sharp(pixels, {
        raw: {
          width,
          height,
          channels: 4,
        },
      })
        .jpeg({ quality: 85 })
        .toBuffer();

      const output = await processImageBuffer(source, "jpeg");

      const originalPixels = await decodeRgba(source);
      const processedPixels = await decodeRgba(output);

      expect(processedPixels).toEqual(originalPixels);
    });

    it("não introduz novas perdas ao converter WebP existente", async () => {
      const width = 41;
      const height = 57;

      const pixels = createPixelPattern(width, height, "opaque");

      // Simula um WebP já comprimido com perdas.
      // A conversão seguinte deve preservar
      // os pixels que ainda existem nesse arquivo.
      const source = await sharp(pixels, {
        raw: {
          width,
          height,
          channels: 4,
        },
      })
        .webp({ quality: 70 })
        .toBuffer();

      const output = await processImageBuffer(source, "webp");

      const originalPixels = await decodeRgba(source);
      const processedPixels = await decodeRgba(output);

      expect(processedPixels).toEqual(originalPixels);
    });
  });

  describe("redimensionamento", () => {
    it("não amplia imagens pequenas", async () => {
      const upload = await createValidatedUpload("png", 200, 300);

      const result = await processImageForStorage(upload);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.width).toBe(200);
        expect(result.data.height).toBe(300);
      }
    });

    it("reduz imagens grandes para os limites definidos", async () => {
      const upload = await createValidatedUpload("png", 2400, 3300);

      const result = await processImageForStorage(upload);

      expect(result.success).toBe(true);

      if (!result.success) {
        throw new Error(result.error);
      }

      expect(result.data.width).toBe(1600);
      expect(result.data.height).toBe(2200);

      expect(result.data.size).toBeLessThanOrEqual(MAX_IMAGE_SIZE);
    });

    it("mantém a proporção original da imagem", async () => {
      const upload = await createValidatedUpload("png", 2000, 1000);

      const result = await processImageForStorage(upload);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.width).toBe(1600);
        expect(result.data.height).toBe(800);

        expect(result.data.width / result.data.height).toBe(2);
      }
    });
  });

  describe("orientação e metadados", () => {
    it("corrige a orientação EXIF antes de salvar", async () => {
      const source = await sharp({
        create: {
          width: 30,
          height: 10,
          channels: 3,
          background: "#E4007F",
        },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();

      const upload = await createValidatedUpload("jpeg");

      const result = await processImageForStorage({
        ...upload,
        data: source,
        size: source.length,
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        throw new Error(result.error);
      }

      const metadata = await sharp(result.data.data).metadata();

      // Orientation 6 corresponde à rotação de 90 graus.
      expect(metadata.width).toBe(10);
      expect(metadata.height).toBe(30);

      // A orientação já foi aplicada aos pixels.
      expect(metadata.orientation).toBeUndefined();
    });

    it("remove metadados EXIF e perfil ICC", async () => {
      const source = await sharp({
        create: {
          width: 32,
          height: 48,
          channels: 3,
          background: "#E4007F",
        },
      })
        .jpeg()
        .withMetadata({ orientation: 1 })
        .toBuffer();

      const upload = await createValidatedUpload("jpeg");

      const result = await processImageForStorage({
        ...upload,
        data: source,
        size: source.length,
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        throw new Error(result.error);
      }

      const metadata = await sharp(result.data.data).metadata();

      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.hasProfile).toBe(false);
    });

    it("preserva transparência em imagens PNG", async () => {
      const source = await sharp({
        create: {
          width: 32,
          height: 48,
          channels: 4,
          background: {
            r: 228,
            g: 0,
            b: 127,
            alpha: 0.5,
          },
        },
      })
        .png()
        .toBuffer();

      const upload = await createValidatedUpload("png");

      const result = await processImageForStorage({
        ...upload,
        data: source,
        size: source.length,
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        throw new Error(result.error);
      }

      const metadata = await sharp(result.data.data).metadata();

      expect(metadata.hasAlpha).toBe(true);
    });
  });

  describe("segurança e arquivos inválidos", () => {
    it("rejeita conteúdo PNG corrompido", async () => {
      const upload = await createValidatedUpload("png");

      // Cabeçalho PNG correto, porém sem dados válidos.
      const corrupted = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const result = await processImageForStorage({
        ...upload,
        data: corrupted,
        size: corrupted.length,
      });

      expect(result).toMatchObject({
        success: false,
        code: "PROCESSING_ERROR",
      });
    });

    it("rejeita formato real diferente do informado", async () => {
      const upload = await createValidatedUpload("jpeg");

      // Simula um objeto adulterado após a validação.
      const result = await processImageForStorage({
        ...upload,
        contentType: "image/png",
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_IMAGE",
      });
    });

    it("rejeita imagens WebP animadas", async () => {
      const gif = Buffer.from(ANIMATED_GIF_BASE64, "base64");

      const animatedWebp = await sharp(gif, {
        animated: true,
      })
        .webp({
          loop: 0,
          delay: [100, 100],
        })
        .toBuffer();

      // Confirma que o arquivo usado no teste tem 2 quadros.
      const metadata = await sharp(animatedWebp).metadata();

      expect(metadata.pages).toBe(2);

      const upload = await createValidatedUpload("webp");

      const result = await processImageForStorage({
        ...upload,
        data: animatedWebp,
        size: animatedWebp.length,
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_IMAGE",
      });
    });

    it("rejeita imagens acima do limite de pixels", async () => {
      // Imagem PNG comprimida, mas com mais de
      // 12 milhões de pixels após a decodificação.
      const source = await createImage("png", 4000, 3001);

      expect(source.length).toBeLessThan(MAX_IMAGE_SIZE);

      const upload = await createValidatedUpload("png");

      const result = await processImageForStorage({
        ...upload,
        data: source,
        size: source.length,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        // O próprio Sharp pode rejeitar a imagem antes
        // da leitura dos metadados.
        expect(["IMAGE_TOO_LARGE", "PROCESSING_ERROR"]).toContain(result.code);
      }
    });

    it("rejeita dados maiores que 2 MiB", async () => {
      const upload = await createValidatedUpload("png");

      const result = await processImageForStorage({
        ...upload,
        data: Buffer.alloc(MAX_IMAGE_SIZE + 1),
        size: MAX_IMAGE_SIZE + 1,
      });

      expect(result).toMatchObject({
        success: false,
        code: "IMAGE_TOO_LARGE",
      });
    });

    it("rejeita buffer vazio", async () => {
      const upload = await createValidatedUpload("png");

      const result = await processImageForStorage({
        ...upload,
        data: Buffer.alloc(0),
        size: 0,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("caminhos de armazenamento", () => {
    it("gera caminho WebP independentemente do formato original", async () => {
      const upload = await createValidatedUpload("jpeg", 40, 60, "kotoko", 2);

      const result = await processImageForStorage(upload);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.storagePath).toBe("kotoko/season-2.webp");

        expect(result.data.storagePath).not.toContain("..");
      }
    });
  });
});
