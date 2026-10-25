import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResultCard } from "@/components/ResultCard";
import { SeasonBadge } from "@/components/SeasonBadge";
import { TOTAL_SEASONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { calculateResultStats } from "@/lib/result";
import { getPrisonerImage } from "@/lib/prisoner-image";
import { verdictSchema } from "@/types/domain";
import { formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ season: string }>;
}

async function getSeasonData(seasonParam: string) {
  const seasonNumber = Number(seasonParam);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1 || seasonNumber > TOTAL_SEASONS) {
    return null;
  }

  const season = await prisma.season.findUnique({ where: { number: seasonNumber } });
  if (!season) return null;

  // Só mostra resultado de temporada encerrada
  if (season.status !== "closed") return { season, notClosed: true as const, results: [] };

  const [prisoners, results] = await Promise.all([
    prisma.prisoner.findMany({
      orderBy: { number: "asc" },
      include: { images: true },
    }),
    prisma.result.findMany({ where: { seasonId: season.id } }),
  ]);

  const resultsByPrisoner = new Map(results.map((r) => [r.prisonerId, r]));

  const data = prisoners.map((p) => {
    const r = resultsByPrisoner.get(p.id);
    const parsedVerdict = verdictSchema.safeParse(r?.verdict);
    const image = getPrisonerImage(p.images, season.number);
    return {
      prisoner: {
        number: p.number,
        slug: p.slug,
        nickname: p.nickname,
        fullName: p.fullName,
        imageUrl: image?.url ?? null,
      },
      stats: calculateResultStats({
        forgiveCount: r?.forgiveCount ?? 0,
        notForgiveCount: r?.notForgiveCount ?? 0,
        verdict: parsedVerdict.success ? parsedVerdict.data : "lost",
      }),
    };
  });

  return { season, notClosed: false as const, results: data };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { season } = await params;
  const data = await getSeasonData(season);
  if (!data) return { title: "MILGRAM | Temporada não encontrada" };
  return {
    title: `MILGRAM | Resultado — Temporada ${data.season.number}`,
    description: `Resultado oficial da temporada ${data.season.number}: vereditos e porcentagens de votos.`,
  };
}

export default async function ResultPage({ params }: PageProps) {
  const { season: seasonParam } = await params;
  const data = await getSeasonData(seasonParam);

  if (!data) notFound();
  if (data.notClosed) redirect("/judge");

  const { season, results } = data;

  return (
    <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <p className="text-xs font-bold tracking-[0.15em] text-white/60 uppercase">Resultado</p>
        <h1 className="text-3xl font-bold tracking-[0.15em] uppercase lg:text-4xl">
          Julgamento · Temporada {season.number}
        </h1>
        <SeasonBadge current={season.number} total={TOTAL_SEASONS} />
        {season.endsAt && (
          <p className="text-sm text-white/70">
            Encerrada em{" "}
            <time dateTime={season.endsAt.toISOString()}>{formatDate(season.endsAt)}</time>
          </p>
        )}
      </div>

      <section aria-labelledby="titulo-resultados" className="flex flex-col gap-4">
        <h2 id="titulo-resultados" className="sr-only">
          Resultados por prisioneiro
        </h2>
        {results.map(({ prisoner, stats }, index) => (
          <ResultCard
            key={prisoner.slug}
            prisoner={prisoner}
            stats={stats}
            seasonNumber={season.number}
            priority={index === 0}
          />
        ))}
      </section>

      <p className="mt-8 text-center text-sm">
        <a href="/judge" className="underline hover:text-accent-fg">
          ← Voltar para a votação
        </a>
      </p>
    </main>
  );
}
