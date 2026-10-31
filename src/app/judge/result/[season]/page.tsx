import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ResultCard } from "@/components/ResultCard";
import { SeasonBadge } from "@/components/SeasonBadge";

import { TOTAL_SEASONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getPrisonerImage } from "@/lib/prisoner-image";
import { calculateResultStats } from "@/lib/result";
import { buildPageMetadata } from "@/lib/seo";

import { verdictSchema } from "@/types/domain";
import { formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ season: string }>;
}

/**
 * Busca os resultados da temporada solicitada.
 *
 * Preserva as regras originais:
 * - Apenas temporadas existentes;
 * - Resultados somente após encerramento;
 * - Dados carregados pelo Prisma;
 * - Estatísticas calculadas por calculateResultStats;
 * - Imagens específicas da temporada.
 */
async function getSeasonData(seasonParam: string) {
  const seasonNumber = Number(seasonParam);

  if (!Number.isInteger(seasonNumber) || seasonNumber < 1 || seasonNumber > TOTAL_SEASONS) {
    return null;
  }

  const season = await prisma.season.findUnique({
    where: { number: seasonNumber },
  });

  if (!season) {
    return null;
  }

  if (season.status !== "closed") {
    return {
      season,
      notClosed: true as const,
      results: [],
    };
  }

  const [prisoners, results] = await Promise.all([
    prisma.prisoner.findMany({
      orderBy: { number: "asc" },
      include: { images: true },
    }),

    prisma.result.findMany({
      where: { seasonId: season.id },
    }),
  ]);

  const resultsByPrisoner = new Map(results.map((result) => [result.prisonerId, result]));

  const data = prisoners.map((prisoner) => {
    const result = resultsByPrisoner.get(prisoner.id);

    const parsedVerdict = verdictSchema.safeParse(result?.verdict);

    const image = getPrisonerImage(prisoner.images, season.number);

    return {
      prisoner: {
        number: prisoner.number,
        slug: prisoner.slug,
        nickname: prisoner.nickname,
        fullName: prisoner.fullName,
        imageUrl: image?.url ?? null,
      },

      stats: calculateResultStats({
        forgiveCount: result?.forgiveCount ?? 0,
        notForgiveCount: result?.notForgiveCount ?? 0,
        verdict: parsedVerdict.success ? parsedVerdict.data : "lost",
      }),
    };
  });

  return {
    season,
    notClosed: false as const,
    results: data,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { season } = await params;

  const data = await getSeasonData(season);

  if (!data) {
    return {
      title: "MILGRAM | Temporada não encontrada",
      robots: { index: false },
    };
  }

  return buildPageMetadata({
    title: `MILGRAM | Resultado — Temporada ${data.season.number}`,
    description: `Resultados da votação da temporada ${data.season.number}: vereditos e porcentagens de votos.`,
    path: `/judge/result/${data.season.number}`,
  });
}

export default async function ResultPage({ params }: PageProps) {
  const { season: seasonParam } = await params;

  const data = await getSeasonData(seasonParam);

  if (!data) {
    notFound();
  }

  if (data.notClosed) {
    redirect("/judge");
  }

  const { season, results } = data;

  const trialNumber = String(season.number).padStart(2, "0");

  const totalTrials = String(TOTAL_SEASONS).padStart(2, "0");

  // Estatísticas gerais derivadas dos resultados
  // já calculados, sem alterar os registros.
  const totalVotes = results.reduce((sum, { stats }) => sum + stats.total, 0);

  const totalForgive = results.reduce((sum, { stats }) => sum + stats.forgiveCount, 0);

  const totalNotForgive = results.reduce((sum, { stats }) => sum + stats.notForgiveCount, 0);

  return (
    <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
      {/* ==========================================
          NAVEGAÇÃO
          ========================================== */}

      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-3 text-xs">
        <Link
          href="/judge"
          className="font-bold tracking-wider text-white/60 uppercase transition-colors hover:text-accent-fg"
        >
          ← JULGAMENTO
        </Link>

        <span aria-hidden="true" className="text-accent-fg">
          /
        </span>

        <span className="font-mono text-white/50">RESULT / {trialNumber}</span>
      </nav>

      {/* ==========================================
          CABEÇALHO DOS RESULTADOS
          ========================================== */}

      <header className="relative isolate mb-8 overflow-hidden border border-white/15 bg-[#191919]">
        {/* Fundo geométrico */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#351315] via-[#1b1b1b] to-[#101010]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-36 h-[450px] w-[450px] rotate-45 border-[45px] border-accent/10 lg:h-[570px] lg:w-[570px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-44 -left-40 h-[340px] w-[340px] rotate-45 border-[35px] border-white/5"
        />

        {/* Número da temporada ao fundo */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 bottom-1 font-mono text-[130px] leading-none font-black text-white/5 select-none sm:text-[190px] lg:text-[250px]"
        >
          {trialNumber}
        </span>

        <div className="relative z-10 px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          {/* Identificação */}
          <div className="mb-7 flex items-center gap-3">
            <span aria-hidden="true" className="h-[2px] w-9 bg-accent" />

            <p className="text-[10px] font-black tracking-[0.2em] text-accent-fg uppercase sm:text-xs">
              MILGRAM / JUDGEMENT RESULTS
            </p>
          </div>

          {/* Título principal */}
          <h1 className="flex flex-col leading-[0.98] font-black uppercase">
            <span className="milgram-display text-[clamp(2.6rem,9vw,6rem)] text-white">
              RESULTADOS
            </span>

            <span className="milgram-display mt-3 text-[clamp(2.4rem,8vw,5rem)] text-accent-fg">
              TRIAL {trialNumber}
            </span>
          </h1>

          {/* Temporada */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <SeasonBadge current={season.number} total={TOTAL_SEASONS} />

            <span className="font-mono text-xs font-bold tracking-[0.13em] text-white/55 uppercase">
              JUDGEMENT {trialNumber} / {totalTrials}
            </span>
          </div>

          {/* Descrição */}
          <p className="mt-8 max-w-2xl text-lg leading-relaxed font-bold text-white sm:text-xl">
            O JULGAMENTO FOI ENCERRADO.
          </p>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
            Consulte os vereditos e as porcentagens dos votos registrados para cada prisioneiro
            nesta temporada.
          </p>
        </div>

        {/* Barra inferior */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/40 px-5 py-4 sm:px-8 lg:px-12">
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/55 uppercase">
            MILGRAM / TRIAL REPORT
          </span>

          <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
            JULGAMENTO ENCERRADO
          </span>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-20 h-[2px] bg-linear-to-r from-accent via-accent/40 to-transparent"
        />
      </header>

      {/* ==========================================
          RESUMO DA TEMPORADA
          ========================================== */}

      <section
        aria-labelledby="trial-summary-title"
        className="milgram-panel mb-10 overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-4 sm:px-6">
          <div>
            <p className="milgram-kicker">TRIAL OVERVIEW</p>

            <h2 id="trial-summary-title" className="milgram-heading mt-3 text-xl sm:text-2xl">
              RESUMO DA TEMPORADA
            </h2>
          </div>

          <span className="font-mono text-xs font-bold tracking-[0.12em] text-accent-fg uppercase">
            T-{trialNumber}
          </span>
        </div>

        {/* Estatísticas gerais */}
        <dl className="grid grid-cols-1 sm:grid-cols-3">
          <div className="border-b border-white/10 p-5 sm:border-r sm:border-b-0 sm:p-6">
            <dt className="text-xs font-bold tracking-[0.12em] text-white/60 uppercase">
              PRISIONEIROS
            </dt>

            <dd className="mt-3 font-mono text-4xl font-black text-white">
              {String(results.length).padStart(2, "0")}
            </dd>
          </div>

          <div className="border-b border-white/10 p-5 sm:border-r sm:border-b-0 sm:p-6">
            <dt className="text-xs font-bold tracking-[0.12em] text-white/60 uppercase">
              VOTOS REGISTRADOS
            </dt>

            <dd className="mt-3 font-mono text-4xl font-black text-white">
              {totalVotes.toLocaleString("pt-BR")}
            </dd>
          </div>

          <div className="p-5 sm:p-6">
            <dt className="text-xs font-bold tracking-[0.12em] text-white/60 uppercase">
              TEMPORADA
            </dt>

            <dd className="mt-3 font-mono text-4xl font-black text-accent-fg">
              {trialNumber}
              <span className="ml-2 text-sm text-white/50">/ {totalTrials}</span>
            </dd>
          </div>
        </dl>

        {/* Totais das escolhas */}
        <div className="grid grid-cols-1 border-t border-white/15 lg:grid-cols-2">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#32555a]/10 px-5 py-5 lg:border-r lg:border-b-0 lg:px-6">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center border border-[#8ebdc4] bg-[#32555a]/30 text-xl text-[#c8e5e9]"
              >
                ○
              </span>

              <div>
                <p className="text-xs font-black tracking-[0.1em] text-white uppercase">PERDOAR</p>

                <p className="mt-1 text-xs text-[#a4d0d6]">Votos pelo perdão</p>
              </div>
            </div>

            <p className="font-mono text-2xl font-black text-[#c8e5e9]">
              {totalForgive.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 bg-accent/5 px-5 py-5 lg:px-6">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center border border-accent bg-accent/20 text-xl text-accent-fg"
              >
                ✕
              </span>

              <div>
                <p className="text-xs font-black tracking-[0.1em] text-white uppercase">
                  NÃO PERDOAR
                </p>

                <p className="mt-1 text-xs text-accent-fg">Votos contrários ao perdão</p>
              </div>
            </div>

            <p className="font-mono text-2xl font-black text-accent-fg">
              {totalNotForgive.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Data de encerramento */}
        {season.endsAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 bg-black/25 px-5 py-4 sm:px-6">
            <p className="font-mono text-[10px] font-bold tracking-[0.13em] text-white/50 uppercase">
              ENCERRAMENTO
            </p>

            <time
              dateTime={season.endsAt.toISOString()}
              className="text-sm font-bold text-white/80"
            >
              {formatDate(season.endsAt)}
            </time>
          </div>
        )}
      </section>

      {/* ==========================================
          RESULTADOS INDIVIDUAIS
          ========================================== */}

      <section aria-labelledby="titulo-resultados">
        {/* Cabeçalho da seção */}
        <div className="mb-7 flex flex-col gap-4 border-b border-white/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="milgram-kicker">JUDGEMENT RECORDS</p>

            <h2
              id="titulo-resultados"
              className="milgram-heading mt-3 text-2xl sm:text-3xl lg:text-4xl"
            >
              VEREDITOS
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              Resultados individuais do julgamento da Temporada {season.number}.
            </p>
          </div>

          <div className="flex shrink-0 items-baseline gap-2 self-start sm:self-end">
            <span className="font-mono text-3xl font-black text-white">
              {String(results.length).padStart(2, "0")}
            </span>

            <span className="font-mono text-xs font-bold tracking-wider text-accent-fg uppercase">
              FILES
            </span>
          </div>
        </div>

        {/* Legenda */}
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border border-white/15 bg-card px-4 py-3">
          <span className="text-xs font-bold tracking-[0.1em] text-white/50 uppercase">
            VEREDITOS
          </span>

          <span className="inline-flex items-center gap-2 text-xs font-bold text-white/85 uppercase">
            <span aria-hidden="true" className="h-3 w-3 border border-white bg-white" />
            PERDOADO
          </span>

          <span className="inline-flex items-center gap-2 text-xs font-bold text-white/85 uppercase">
            <span aria-hidden="true" className="h-3 w-3 bg-accent" />
            NÃO PERDOADO
          </span>

          <span className="inline-flex items-center gap-2 text-xs font-bold text-white/85 uppercase">
            <span aria-hidden="true" className="h-3 w-3 border border-white/60 bg-black" />
            EMPATE
          </span>
        </div>

        {/* Cartões existentes:
            mantém os enquadramentos ajustados
            e os cálculos originais. */}
        <div className="flex flex-col gap-4">
          {results.map(({ prisoner, stats }, index) => (
            <ResultCard
              key={prisoner.slug}
              prisoner={prisoner}
              stats={stats}
              seasonNumber={season.number}
              priority={index === 0}
            />
          ))}
        </div>
      </section>

      {/* ==========================================
          RODAPÉ E NAVEGAÇÃO
          ========================================== */}

      <footer className="mt-12 border-t border-white/15 pt-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/judge"
            className="text-xs font-bold tracking-[0.12em] text-white/70 uppercase transition-colors hover:text-accent-fg"
          >
            ← VOLTAR AO JULGAMENTO
          </Link>

          <Link
            href="/character"
            className="text-xs font-bold tracking-[0.12em] text-white/70 uppercase transition-colors hover:text-accent-fg"
          >
            VER PRISIONEIROS →
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <span className="font-mono text-[10px] font-bold tracking-[0.13em] text-white/40 uppercase">
            MILGRAM / RESULT DATABASE
          </span>

          <span className="font-mono text-[10px] font-bold tracking-[0.13em] text-accent-fg uppercase">
            TRIAL {trialNumber} / {totalTrials}
          </span>
        </div>
      </footer>
    </main>
  );
}
