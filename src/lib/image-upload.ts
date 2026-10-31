import { TOTAL_SEASONS } from "@/lib/constants";

/**
 * Limite máximo permitido por imagem: 2 MiB.
 */
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

/**
 * Tipos de imagem aceitos pelo sistema.
 */
export type AllowedImageType = "image/webp" | "image/png" | "image/jpeg";

/**
 * Extensões correspondentes aos MIME types permitidos.
 */
const IMAGE_EXTENSIONS: Record<AllowedImageType, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * Prisioneiros fixos do MILGRAM.
 *
 * Esta lista impede a utilização de slugs arbitrários
 * na construção dos caminhos do Storage.
 */
const ALLOWED_PRISONERS = new Set<string>([
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
]);

/**
 * Dados recebidos para validação.
 */
export interface ImageUploadInput {
  file: unknown;
  prisonerSlug: unknown;
  season: unknown;
}

/**
 * Dados de uma imagem validada.
 */
export interface ValidatedImageUpload {
  data: Buffer;
  contentType: AllowedImageType;
  extension: string;
  storagePath: string;
  prisonerSlug: string;
  season: number;
  size: number;
}

/**
 * Resultado discriminado da validação.
 */
export type ImageUploadResult =
  | {
      success: true;
      data: ValidatedImageUpload;
    }
  | {
      success: false;
      error: string;
      code:
        | "INVALID_FILE"
        | "EMPTY_FILE"
        | "FILE_TOO_LARGE"
        | "INVALID_TYPE"
        | "INVALID_SIGNATURE"
        | "INVALID_PRISONER"
        | "INVALID_SEASON"
        | "READ_ERROR";
    };

/**
 * Verifica se o MIME type está na lista permitida.
 */
function isAllowedImageType(value: string): value is AllowedImageType {
  return Object.hasOwn(IMAGE_EXTENSIONS, value);
}

/**
 * Verifica a assinatura binária de cada formato.
 *
 * Essa checagem impede que um arquivo qualquer seja
 * aceito apenas por possuir extensão ou MIME falsificado.
 *
 * A assinatura não garante, isoladamente, que a imagem
 * inteira seja válida ou decodificável.
 */
function hasValidSignature(buffer: Buffer, contentType: AllowedImageType): boolean {
  switch (contentType) {
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );

    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
  }
}

/**
 * Converte e valida o número da temporada.
 */
function parseSeason(value: unknown): number | null {
  let season: number;

  if (typeof value === "number") {
    season = value;
  } else if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    season = Number(value);
  } else {
    return null;
  }

  if (!Number.isInteger(season) || season < 1 || season > TOTAL_SEASONS) {
    return null;
  }

  return season;
}

/**
 * Valida os dados de uma imagem antes do upload.
 *
 * Regras:
 * - Arquivo obrigatório;
 * - Tamanho máximo de 2 MiB;
 * - MIME type permitido;
 * - Assinatura binária compatível;
 * - Prisioneiro cadastrado na lista fixa;
 * - Temporada entre 1 e TOTAL_SEASONS.
 *
 * O nome original do arquivo nunca é utilizado
 * para construir o caminho de armazenamento.
 *
 * Esta função não realiza uploads e não acessa
 * o banco de dados.
 */
export async function validateImageUpload(input: ImageUploadInput): Promise<ImageUploadResult> {
  const { file, prisonerSlug, season } = input;

  // 1. Validar o prisioneiro.
  if (typeof prisonerSlug !== "string" || !ALLOWED_PRISONERS.has(prisonerSlug)) {
    return {
      success: false,
      code: "INVALID_PRISONER",
      error: "Prisioneiro inválido.",
    };
  }

  // 2. Validar a temporada.
  const parsedSeason = parseSeason(season);

  if (parsedSeason === null) {
    return {
      success: false,
      code: "INVALID_SEASON",
      error: "Temporada inválida.",
    };
  }

  // 3. Verificar a existência do arquivo.
  if (!(file instanceof File)) {
    return {
      success: false,
      code: "INVALID_FILE",
      error: "Selecione um arquivo de imagem válido.",
    };
  }

  // 4. Impedir arquivos vazios.
  if (file.size === 0) {
    return {
      success: false,
      code: "EMPTY_FILE",
      error: "O arquivo está vazio.",
    };
  }

  // 5. Impedir arquivos maiores que o limite.
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      success: false,
      code: "FILE_TOO_LARGE",
      error: "A imagem deve ter no máximo 2 MB.",
    };
  }

  // 6. Validar o tipo informado.
  const contentType = file.type.toLowerCase();

  if (!isAllowedImageType(contentType)) {
    return {
      success: false,
      code: "INVALID_TYPE",
      error: "Formato não permitido. Use PNG, JPEG ou WebP.",
    };
  }

  // 7. Ler os bytes da imagem.
  let buffer: Buffer;

  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return {
      success: false,
      code: "READ_ERROR",
      error: "Não foi possível ler a imagem.",
    };
  }

  // 8. Conferir a assinatura real do arquivo.
  if (!hasValidSignature(buffer, contentType)) {
    return {
      success: false,
      code: "INVALID_SIGNATURE",
      error: "O conteúdo do arquivo não corresponde ao formato informado.",
    };
  }

  // 9. Definir a extensão a partir do MIME validado.
  const extension = IMAGE_EXTENSIONS[contentType];

  // 10. Construir o caminho seguro no bucket.
  const storagePath = `${prisonerSlug}/season-${parsedSeason}.${extension}`;

  return {
    success: true,
    data: {
      data: buffer,
      contentType,
      extension,
      storagePath,
      prisonerSlug,
      season: parsedSeason,
      size: buffer.length,
    },
  };
}
