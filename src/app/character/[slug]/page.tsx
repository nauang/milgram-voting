import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

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
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Mantém os enquadramentos utilizados
 * nas páginas de julgamento e personagens.
 *
 * Temporada 2:
 * - Yuno: object-cover object-top.
 *
 * Temporada 3:
 * - Futa e Amane: object-cover object-top.
 *
 * Demais casos:
 * - object-contain object-center.
 */
function getDetailImageClass(slug: string, seasonNumber: number): string {
  const needsFullHeight =
    (seasonNumber === 2 && slug === "yuno") ||
    (seasonNumber === 3 && (slug === "futa" || slug === "amane"));

  if (needsFullHeight) {
    return "object-cover object-top";
  }

  return "object-contain object-center";
}

/**
 * Compartilha a consulta do prisioneiro
 * entre generateMetadata e a página,
 * dentro da mesma requisição.
 */
const getPrisonerBySlug = cache(async (slug: string) =>
  prisma.prisoner.findUnique({
    where: { slug },
    include: {
      images: true,
      results: {
        include: { season: true },
        orderBy: { seasonId: "asc" },
      },
    },
  }),
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const [prisoner, currentSeason] = await Promise.all([
    getPrisonerBySlug(slug),
    getCurrentSeason(),
  ]);

  if (!prisoner) {
    return {
      title: "MILGRAM | Prisioneiro não encontrado",
      robots: { index: false },
    };
  }

  const numberLabel = formatPrisonerNumber(prisoner.number);

  return buildPageMetadata({
    title: `MILGRAM | ${prisoner.nickname} — ${numberLabel}`,
    description: `${prisoner.fullName}, prisioneiro ${numberLabel} do MILGRAM.`,
    path: `/character/${prisoner.slug}`,
    imageUrl: getPrisonerImage(prisoner.images, currentSeason.number)?.url ?? null,
  });
}

export default async function CharacterPage({ params }: PageProps) {
  const { slug } = await params;

  const [prisoner, currentSeason] = await Promise.all([
    getPrisonerBySlug(slug),
    getCurrentSeason(),
  ]);

  if (!prisoner) {
    notFound();
  }

  const seasonStatus = seasonStatusSchema.parse(currentSeason.status);

  const image = getPrisonerImage(prisoner.images, currentSeason.number);

  const currentResult = prisoner.results.find((result) => result.seasonId === currentSeason.id);

  const parsedVerdict = verdictSchema.safeParse(currentResult?.verdict);

  // Verifica o voto do visitante somente
  // quando a temporada está aberta.
  const hasVoted = seasonStatus === "voting" ? await hasVotedForPrisoner(prisoner.id) : false;

  const state = calculatePrisonerState({
    seasonStatus,
    verdict: parsedVerdict.success ? parsedVerdict.data : undefined,
    hasVoted,
  });

  const numberLabel = formatPrisonerNumber(prisoner.number);

  const prisonerNumber = String(prisoner.number).padStart(2, "0");

  const trialNumber = String(currentSeason.number).padStart(2, "0");

  const imageFrameClass = getDetailImageClass(prisoner.slug, currentSeason.number);

  const seasonDescription =
    seasonStatus === "voting"
      ? "O julgamento está aberto. A decisão sobre este prisioneiro está em andamento."
      : seasonStatus === "closed"
        ? "O julgamento desta temporada foi encerrado."
        : "O julgamento desta temporada ainda não começou.";

  return (
    <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
      {/* ==========================================
          NAVEGAÇÃO
          ========================================== */}

      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-3 text-xs">
        <Link
          href="/character"
          className="font-bold tracking-wider text-white/60 uppercase transition-colors hover:text-accent-fg"
        >
          ← PRISIONEIROS
        </Link>

        <span aria-hidden="true" className="text-accent-fg">
          /
        </span>

        <span className="font-mono text-white/50">FILE {prisonerNumber}</span>
      </nav>

      <article>
        {/* ======================================
            CABEÇALHO DA FICHA
            ====================================== */}

        <header className="relative isolate mb-8 overflow-hidden border border-white/15 bg-[#191919]">
          {/* Fundo geométrico */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#351315] via-[#1b1b1b] to-[#101010]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-32 h-[380px] w-[380px] rotate-45 border-[42px] border-accent/10"
          />

          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 bottom-0 font-mono text-[150px] leading-none font-black tracking-tighter text-white/5 select-none sm:text-[200px] lg:text-[250px]"
          >
            {prisonerNumber}
          </span>

          <div className="relative z-10 px-5 py-9 sm:px-8 sm:py-12 lg:px-12">
            {/* Identificação do arquivo */}
            <div className="mb-7 flex items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-9 bg-accent" />

              <p className="text-[10px] font-black tracking-[0.2em] text-accent-fg uppercase sm:text-xs">
                MILGRAM / PRISONER DATABASE
              </p>
            </div>

            {/* Número e nome */}
            <div className="flex flex-col gap-3">
              <p className="font-mono text-sm font-black tracking-[0.17em] text-accent-fg uppercase">
                PRISONER {numberLabel}
              </p>

              <GlitchText
                as="h1"
                className="milgram-heading max-w-full text-[clamp(2.6rem,9vw,5.5rem)] leading-tight wrap-break-word text-white"
              >
                {prisoner.nickname}
              </GlitchText>

              <p className="text-base font-medium text-white/70 sm:text-lg">{prisoner.fullName}</p>
            </div>

            {/* Identificação da temporada */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <SeasonBadge current={currentSeason.number} total={TOTAL_SEASONS} />

              <span className="font-mono text-xs font-bold tracking-[0.12em] text-white/55 uppercase">
                TRIAL {trialNumber}
              </span>
            </div>
          </div>

          {/* Rodapé do cabeçalho */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/40 px-5 py-4 sm:px-8 lg:px-12">
            <p className="font-mono text-[10px] font-bold tracking-[0.13em] text-white/50 uppercase">
              PRISONER IDENTIFICATION
            </p>

            <p className="font-mono text-[10px] font-bold tracking-[0.13em] text-accent-fg uppercase">
              FILE / {prisonerNumber}
            </p>
          </div>

          {/* Linha vermelha */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 z-20 h-[2px] bg-linear-to-r from-accent via-accent/40 to-transparent"
          />
        </header>

        {/* ======================================
            RETRATO E INFORMAÇÕES
            ====================================== */}

        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Retrato */}
          <figure className="min-w-0 overflow-hidden border border-white/20 bg-[#101010]">
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-black">
              {/* Detalhe geométrico */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rotate-45 border-[25px] border-accent/10"
              />

              {/* Imagem original */}
              {image?.url ? (
                <Image
                  src={image.url}
                  alt={`Retrato de ${prisoner.nickname}, ${numberLabel}, temporada ${currentSeason.number}`}
                  fill
                  sizes="(min-width: 960px) 50vw, 100vw"
                  className={imageFrameClass}
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/60">
                  Sem imagem
                </div>
              )}

              {/* Cantos decorativos */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 h-8 w-8 border-t-[3px] border-l-[3px] border-accent"
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 bottom-0 h-8 w-8 border-r-[3px] border-b-[3px] border-accent"
              />
            </div>

            {/* Legenda abaixo da imagem */}
            <figcaption className="flex items-center justify-between gap-3 border-t border-white/15 bg-card px-4 py-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-accent-fg uppercase">
                  PRISONER FILE
                </p>

                <p className="mt-1 text-sm font-bold text-white">
                  {numberLabel} / {prisoner.nickname}
                </p>
              </div>

              <span className="font-mono text-xs font-bold text-white/50">T-{trialNumber}</span>
            </figcaption>
          </figure>

          {/* Informações */}
          <div className="flex min-w-0 flex-col gap-6">
            {/* ==============================
                IDENTIFICAÇÃO
                ============================== */}

            <section
              aria-labelledby="identification-title"
              className="milgram-panel overflow-hidden"
            >
              <div className="border-b border-white/15 px-5 py-4 sm:px-6">
                <p className="milgram-kicker">IDENTIFICATION</p>

                <h2 id="identification-title" className="milgram-heading mt-3 text-xl sm:text-2xl">
                  IDENTIFICAÇÃO
                </h2>
              </div>

              <dl className="divide-y divide-white/10">
                <div className="grid grid-cols-[105px_1fr] gap-4 px-5 py-4 sm:grid-cols-[135px_1fr] sm:px-6">
                  <dt className="text-xs font-bold tracking-wide text-white/50 uppercase">
                    NÚMERO
                  </dt>

                  <dd className="font-mono text-sm font-bold text-accent-fg">{numberLabel}</dd>
                </div>

                <div className="grid grid-cols-[105px_1fr] gap-4 px-5 py-4 sm:grid-cols-[135px_1fr] sm:px-6">
                  <dt className="text-xs font-bold tracking-wide text-white/50 uppercase">NOME</dt>

                  <dd className="text-sm font-bold text-white">{prisoner.fullName}</dd>
                </div>

                <div className="grid grid-cols-[105px_1fr] gap-4 px-5 py-4 sm:grid-cols-[135px_1fr] sm:px-6">
                  <dt className="text-xs font-bold tracking-wide text-white/50 uppercase">
                    IDENTIFICAÇÃO
                  </dt>

                  <dd className="text-sm font-bold text-white">{prisoner.nickname}</dd>
                </div>

                <div className="grid grid-cols-[105px_1fr] gap-4 px-5 py-4 sm:grid-cols-[135px_1fr] sm:px-6">
                  <dt className="text-xs font-bold tracking-wide text-white/50 uppercase">
                    TEMPORADA
                  </dt>

                  <dd className="font-mono text-sm font-bold text-white">TRIAL {trialNumber}</dd>
                </div>
              </dl>
            </section>

            {/* ==============================
                ESTADO DO JULGAMENTO
                ============================== */}

            <section aria-labelledby="judgement-title" className="milgram-panel overflow-hidden">
              <div className="border-b border-white/15 px-5 py-4 sm:px-6">
                <p className="milgram-kicker">JUDGEMENT STATUS</p>

                <h2 id="judgement-title" className="milgram-heading mt-3 text-xl sm:text-2xl">
                  JULGAMENTO ATUAL
                </h2>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <SeasonBadge current={currentSeason.number} total={TOTAL_SEASONS} />

                  <StateBadge state={state} />
                </div>

                <p className="mt-5 text-sm leading-relaxed text-white/65">{seasonDescription}</p>

                {/* Mantém a navegação original
                    para votação aberta. */}
                {state === "voting" && (
                  <Link
                    href="/judge"
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-between gap-4 border border-accent bg-accent px-5 py-3 text-xs font-black tracking-[0.12em] text-white uppercase transition-colors hover:bg-accent-2"
                  >
                    <span>VOTAR AGORA</span>

                    <span aria-hidden="true" className="text-lg">
                      →
                    </span>
                  </Link>
                )}

                {/* Acesso aos resultados da
                    temporada encerrada. */}
                {seasonStatus === "closed" && (
                  <Link
                    href={`/judge/result/${currentSeason.number}`}
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-between gap-4 border border-white/35 bg-black/30 px-5 py-3 text-xs font-black tracking-[0.12em] text-white uppercase transition-colors hover:border-accent hover:text-accent-fg"
                  >
                    <span>VER RESULTADOS</span>

                    <span aria-hidden="true" className="text-lg">
                      →
                    </span>
                  </Link>
                )}
              </div>
            </section>

            {/* ==============================
                HISTÓRICO DE JULGAMENTOS
                ============================== */}

            <section aria-labelledby="history-title" className="milgram-panel overflow-hidden">
              <div className="border-b border-white/15 px-5 py-4 sm:px-6">
                <p className="milgram-kicker">JUDGEMENT HISTORY</p>

                <h2 id="history-title" className="milgram-heading mt-3 text-xl sm:text-2xl">
                  HISTÓRICO
                </h2>
              </div>

              <div className="p-5 sm:p-6">
                {prisoner.results.length === 0 ? (
                  <div className="border-l-[3px] border-white/20 bg-black/30 p-4">
                    <p className="text-sm leading-relaxed text-white/60">
                      Nenhum resultado registrado ainda.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {prisoner.results.map((result) => {
                      const verdict =
                        VERDICT_PRESENTATION[result.verdict] ?? VERDICT_PRESENTATION.not_guilty;

                      return (
                        <li
                          key={result.id}
                          className="flex flex-wrap items-center justify-between gap-3 border border-white/15 bg-black/30 p-4"
                        >
                          <div>
                            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
                              TRIAL {String(result.season.number).padStart(2, "0")}
                            </p>

                            <p className="mt-1 text-sm font-bold text-white">
                              Temporada {result.season.number}
                            </p>
                          </div>

                          <span
                            className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-black tracking-wide uppercase ${verdict.className}`}
                          >
                            <span aria-hidden="true">{verdict.icon}</span>

                            {verdict.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ======================================
            RODAPÉ DA FICHA
            ====================================== */}

        <footer className="mt-10 flex flex-col gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/character"
            className="text-xs font-bold tracking-[0.12em] text-white/70 uppercase transition-colors hover:text-accent-fg"
          >
            ← VOLTAR AOS PRISIONEIROS
          </Link>

          <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
            MILGRAM / FILE {prisonerNumber}
          </p>
        </footer>
      </article>
    </main>
  );
}

/**
 * Apresentação dos vereditos históricos.
 */
const VERDICT_PRESENTATION: Record<
  string,
  {
    label: string;
    icon: string;
    className: string;
  }
> = {
  not_guilty: {
    label: "Inocente",
    icon: "○",
    className: "border-white bg-white text-black",
  },

  guilty: {
    label: "Culpado",
    icon: "✕",
    className: "border-accent bg-accent text-white",
  },
};

/**
 * Selo de estado da temporada atual.
 *
 * Mantém os estados originais calculados
 * por calculatePrisonerState.
 */
function StateBadge({ state }: { state: string }) {
  const map: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    voting: {
      label: "Pode votar",
      className: "border-white bg-black text-white",
    },

    voted: {
      label: "Voto registrado",
      className: "border-accent bg-accent text-white",
    },

    not_guilty: {
      label: "Inocente",
      className: "border-white bg-white text-black",
    },

    guilty: {
      label: "Culpado",
      className: "border-accent bg-accent text-white",
    },

    idle: {
      label: "Votação em breve",
      className: "border-white/40 bg-black text-white/80",
    },
  };

  const config = map[state] ?? map.idle;

  return (
    <span
      className={`inline-flex items-center border px-3 py-2 text-xs font-black tracking-[0.08em] uppercase ${config.className}`}
    >
      {config.label}
    </span>
  );
}