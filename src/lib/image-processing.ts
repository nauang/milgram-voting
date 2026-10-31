import sharp from "sharp";

import {
  MAX_IMAGE_SIZE,
  type AllowedImageType,
  type ValidatedImageUpload,
} from "@/lib/image-upload";

// Limites de segurança para imagens recebidas.
const MAX_INPUT_PIXELS = 12_000_000;
const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 2200;

// Maior esforço de compressão, sem perda de qualidade.
// O esforço afeta o tempo de processamento e o tamanho
// final, mas não modifica os pixels no modo lossless.
const WEBP_EFFORT = 6;

const EXPECTED_FORMATS: Record<AllowedImageType, "png" | "jpeg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

export interface ProcessedImageUpload {
  data: Buffer;
  contentType: "image/webp";
  storagePath: string;
  prisonerSlug: string;
  season: number;
  size: number;
  width: number;
  height: number;
}

export type ImageProcessingResult =
  | {
      success: true;
      data: ProcessedImageUpload;
    }
  | {
      success: false;
      code: "INVALID_IMAGE" | "IMAGE_TOO_LARGE" | "PROCESSING_ERROR";
      error: string;
    };

/**
 * Processa uma imagem validada para armazenamento
 * no Supabase Storage.
 *
 * Regras:
 * - Aceita PNG, JPEG e WebP válidos;
 * - Rejeita imagens animadas;
 * - Limita a resolução de entrada;
 * - Corrige a orientação EXIF;
 * - Não amplia imagens pequenas;
 * - Redimensiona somente quando necessário;
 * - Preserva a transparência;
 * - Converte para WebP sem perdas;
 * - Remove metadados desnecessários;
 * - Mantém o limite final de 2 MiB.
 *
 * O modo lossless evita perdas adicionais
 * introduzidas pela conversão para WebP.
 *
 * JPEGs já comprimidos com perdas não recuperam
 * detalhes removidos anteriormente.
 */
export async function processImageForStorage(
  upload: ValidatedImageUpload,
): Promise<ImageProcessingResult> {
  // 1. Verificar o tamanho do buffer recebido.
  if (upload.data.length === 0 || upload.data.length > MAX_IMAGE_SIZE) {
    return {
      success: false,
      code: "IMAGE_TOO_LARGE",
      error: "A imagem deve ter no máximo 2 MB.",
    };
  }

  try {
    // 2. Abrir a imagem com limites de segurança.
    const image = sharp(upload.data, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      animated: false,
    });

    // 3. Consultar os metadados da imagem.
    const metadata = await image.metadata();

    // O formato real deve corresponder ao MIME
    // previamente validado durante o upload.
    if (metadata.format !== EXPECTED_FORMATS[upload.contentType]) {
      return {
        success: false,
        code: "INVALID_IMAGE",
        error: "O formato real da imagem é inválido.",
      };
    }

    // 4. Validar as dimensões.
    if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
      return {
        success: false,
        code: "INVALID_IMAGE",
        error: "A imagem possui dimensões inválidas.",
      };
    }

    if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
      return {
        success: false,
        code: "IMAGE_TOO_LARGE",
        error: "A imagem possui resolução excessiva.",
      };
    }

    // 5. Rejeitar imagens animadas.
    if ((metadata.pages ?? 1) > 1) {
      return {
        success: false,
        code: "INVALID_IMAGE",
        error: "Imagens animadas não são permitidas.",
      };
    }

    // 6. Processar a ilustração.
    //
    // rotate():
    // Corrige automaticamente a orientação EXIF.
    //
    // resize():
    // Apenas reduz imagens que ultrapassarem os
    // limites. Não amplia imagens menores.
    //
    // webp():
    // lossless preserva os dados dos pixels.
    // exact preserva também os valores RGB dos
    // pixels totalmente transparentes.
    //
    // O Sharp remove os metadados por padrão.
    const { data, info } = await image
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        lossless: true,
        exact: true,
        effort: WEBP_EFFORT,
      })
      .toBuffer({
        resolveWithObject: true,
      });

    // 7. Manter o limite de armazenamento.
    //
    // Não usamos compressão com perdas como
    // alternativa silenciosa caso o arquivo
    // WebP lossless ultrapasse 2 MiB.
    if (data.length > MAX_IMAGE_SIZE) {
      return {
        success: false,
        code: "IMAGE_TOO_LARGE",
        error:
          "A imagem WebP sem perdas excedeu 2 MB. " + "Utilize uma imagem com dimensões menores.",
      };
    }

    // 8. Preservar o contrato de armazenamento.
    //
    // A API administrativa adiciona um UUID a
    // esse caminho antes de enviar ao Supabase.
    const storagePath = `${upload.prisonerSlug}/` + `season-${upload.season}.webp`;

    return {
      success: true,
      data: {
        data,
        contentType: "image/webp",
        storagePath,
        prisonerSlug: upload.prisonerSlug,
        season: upload.season,
        size: data.length,
        width: info.width,
        height: info.height,
      },
    };
  } catch {
    return {
      success: false,
      code: "PROCESSING_ERROR",
      error: "Não foi possível processar a imagem. " + "Verifique se o arquivo está íntegro.",
    };
  }
}
