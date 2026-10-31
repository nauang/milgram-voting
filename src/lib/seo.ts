import type { Metadata, MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

interface PageMetadataInput {
  title: string;
  description: string;
  /** Caminho a partir da raiz, ex.: "/character/haruka". Vira o canonical e a og:url. */
  path: string;
  /** URL ABSOLUTA da imagem de compartilhamento. */
  imageUrl?: string | null;
}

/**
 * Metadados de uma página. O Next NÃO mescla `openGraph` entre layout e página (a página
 * substitui o objeto inteiro), então cada página precisa repassar siteName e locale.
 * Este helper existe para isso nunca ser esquecido.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  imageUrl,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "pt_BR",
      title,
      description,
      url: path,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

/** "/" é só um redirect e /admin é privado: nenhum dos dois entra no sitemap. */
export function buildSitemapEntries(
  baseUrl: string,
  prisonerSlugs: readonly string[],
  closedSeasonNumbers: readonly number[],
): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/judge`, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/character`, changeFrequency: "weekly", priority: 0.8 },
    ...prisonerSlugs.map((slug) => ({
      url: `${baseUrl}/character/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // O resultado só existe depois que a temporada é encerrada
    ...closedSeasonNumbers.map((number) => ({
      url: `${baseUrl}/judge/result/${number}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
