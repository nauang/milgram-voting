import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { buildSitemapEntries } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

// Consulta o banco: não pode rodar durante o build (o CI usa um DATABASE_URL fictício).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [prisoners, closedSeasons] = await Promise.all([
    prisma.prisoner.findMany({ select: { slug: true }, orderBy: { number: "asc" } }),
    prisma.season.findMany({
      where: { status: "closed" },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  return buildSitemapEntries(
    SITE_URL,
    prisoners.map((prisoner) => prisoner.slug),
    closedSeasons.map((season) => season.number),
  );
}
