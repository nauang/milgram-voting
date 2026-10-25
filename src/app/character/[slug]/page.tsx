import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentSeason } from "@/lib/season";
import { getPrisonerImage } from "@/lib/prisoner-image";
import { calculatePrisonerState } from "@/lib/prisoner-state";
import { hasVotedForPrisoner } from "@/lib/vote-check";
import { GlitchText } from "@/components/GlitchText";
import { SeasonBadge } from "@/components/SeasonBadge";
import { TOTAL_SEASONS } from "@/lib/constants";
import { formatPrisonerNumber } from "@/utils/format";
import { seasonStatusSchema, verdictSchema } from "@/types/domain";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPrisonerBySlug(slug: string) {
  return prisma.prisoner.findUnique({
    where: { slug },
    include: {
      images: true,
      results: {
        include: { season: true },
        orderBy: { seasonId: "asc" },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const prisoner = await getPrisonerBySlug(slug);
  if (!prisoner) return { title: "MILGRAM | Prisioneiro não encontrado" };
  return {
    title: `MILGRAM | ${prisoner.nickname} — ${formatPrisonerNumber(prisoner.number)}`,
    description: `${prisoner.fullName}, prisioneiro ${formatPrisonerNumber(prisoner.number)} do MILGRAM.`,
  };
}

export default async function CharacterPage({ params }: PageProps) {
  const { slug } = await params;
  const [prisoner, currentSeason] = await Promise.all([
    getPrisonerBySlug(slug),
    getCurrentSeason(),
  ]);

  if (!prisoner) notFound();

  const seasonStatus = seasonStatusSchema.parse(currentSeason.status);
  const image = getPrisonerImage(prisoner.images, currentSeason.number);
  const currentResult = prisoner.results.find((r) => r.seasonId === currentSeason.id);
  const parsedVerdict = verdictSchema.safeParse(currentResult?.verdict);

  // Verifica se este visitante já votou (helper fora do componente)
  const hasVoted = seasonStatus === "voting" ? await hasVotedForPrisoner(prisoner.id) : false;

  const state = calculatePrisonerState({
    seasonStatus,
    verdict: parsedVerdict.success ? parsedVerdict.data : undefined,
    hasVoted,
  });

  const numberLabel = formatPrisonerNumber(prisoner.number);

  return (
    <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-white/60">
        <Link href="/character" className="underline hover:text-accent-fg">
          ← Todos os prisioneiros
        </Link>
      </nav>

      <article className="grid gap-8 md:grid-cols-2">
        {/* Imagem */}
        <div>
          <figure className="relative aspect-[3/4] w-full overflow-hidden border border-white/20">
            {image?.url ? (
              <Image
                src={image.url}
                alt={`Retrato de ${prisoner.nickname}, ${numberLabel}, temporada ${currentSeason.number}`}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-black text-xs text-white/70">
                Sem imagem
              </div>
            )}
          </figure>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-bold tracking-widest text-accent-fg">{numberLabel}</p>
            <GlitchText
              as="h1"
              className="mt-2 text-3xl font-bold tracking-[0.1em] uppercase lg:text-4xl"
            >
              {prisoner.nickname}
            </GlitchText>
            <p className="mt-1 text-white/70">{prisoner.fullName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SeasonBadge current={currentSeason.number} total={TOTAL_SEASONS} />
            <StateBadge state={state} />
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <h2 className="mb-2 text-sm font-bold tracking-wider text-white/60 uppercase">
              Histórico
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {prisoner.results.length === 0 && (
                <li className="text-white/60">Nenhum resultado registrado ainda.</li>
              )}
              {prisoner.results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between border-b border-white/5 pb-2"
                >
                  <span>Temporada {r.season.number}</span>
                  <span
                    className={
                      r.verdict === "not_guilty"
                        ? "text-white"
                        : r.verdict === "guilty"
                          ? "text-accent-fg"
                          : "text-white/60"
                    }
                  >
                    {r.verdict === "not_guilty"
                      ? "Perdoado"
                      : r.verdict === "guilty"
                        ? "Não perdoado"
                        : "Empate"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {state === "voting" && (
            <Link
              href="/judge"
              className="mt-6 inline-block border border-accent bg-accent px-6 py-3 text-center text-sm font-bold tracking-wider text-white uppercase hover:bg-accent-2"
            >
              Votar agora
            </Link>
          )}
        </div>
      </article>
    </main>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; className: string }> = {
    voting: { label: "Pode votar", className: "border-white bg-black text-white" },
    voted: { label: "Voto registrado", className: "border-accent bg-accent text-white" },
    lost: { label: "Empate", className: "border-white/60 bg-black text-white" },
    not_guilty: { label: "Perdoado", className: "border-white bg-white text-black" },
    guilty: { label: "Não perdoado", className: "border-accent bg-accent text-white" },
    idle: { label: "Votação em breve", className: "border-white/40 bg-black text-white/80" },
  };
  const config = map[state] ?? map.idle;
  return (
    <span
      className={`inline-block border px-3 py-1 text-xs font-bold tracking-wider uppercase ${config.className}`}
    >
      {config.label}
    </span>
  );
}
