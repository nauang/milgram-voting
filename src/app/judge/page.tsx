import type { Metadata } from "next";

import { JudgeGrid } from "@/components/JudgeGrid";
import { SeasonBadge } from "@/components/SeasonBadge";

import { TOTAL_SEASONS } from "@/lib/constants";
import { getJudgeData } from "@/lib/judge";

import type { JudgeSeason } from "@/types/domain";

import { formatDate } from "@/utils/format";
import { buildPageMetadata } from "@/lib/seo";

// O selo "voted" depende do visitante e o conteúdo
// depende do banco. A página não pode ser pré-renderizada.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { season } = await getJudgeData();

  return buildPageMetadata({
    title: `MILGRAM | Votação — Temporada ${season.number}`,
    description: `Julgue os 10 prisioneiros da temporada ${season.number} do MILGRAM: inocente ou culpado.`,
    path: "/judge",
  });
}

/**
 * Mantém o comportamento original do indicador
 * de estado da temporada.
 */
function SeasonStatusText({ season }: { season: JudgeSeason }) {
  if (season.status === "voting") {
    return season.endsAt ? (
      <>
        Votação até <time dateTime={season.endsAt.toISOString()}>{formatDate(season.endsAt)}</time>
      </>
    ) : (
      <>Votação aberta</>
    );
  }

  if (season.status === "closed") {
    return season.number === TOTAL_SEASONS ? (
      <>Julgamento encerrado</>
    ) : (
      <>Temporada encerrada. Aguarde a próxima.</>
    );
  }

  return <>A votação ainda não começou</>;
}

export default async function JudgePage() {
  const { season, prisoners } = await getJudgeData();

  const isVoting = season.status === "voting";
  const isClosed = season.status === "closed";

  const statusLabel = isVoting
    ? "VOTAÇÃO EM ANDAMENTO"
    : isClosed
      ? "JULGAMENTO ENCERRADO"
      : "AGUARDANDO JULGAMENTO";

  const statusDescription = isVoting
    ? "O julgamento está aberto. Analise os prisioneiros e registre seu veredito."
    : isClosed
      ? "A votação desta temporada foi encerrada. Consulte os vereditos e resultados disponíveis."
      : "O julgamento ainda não começou. Você poderá votar quando a temporada for iniciada.";

  const sectionDescription = isVoting
    ? "Analise cada prisioneiro e escolha se ele é inocente ou culpado."
    : isClosed
      ? "Confira os prisioneiros e os resultados desta temporada."
      : "Conheça os prisioneiros antes do início da votação.";

  const trialNumber = String(season.number).padStart(2, "0");

  const totalTrials = String(TOTAL_SEASONS).padStart(2, "0");

  return (
    <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
      {/* ==========================================
          HERO DO JULGAMENTO
          ========================================== */}

      <section
        aria-labelledby="judge-title"
        className="relative isolate mb-10 overflow-hidden border border-white/15 bg-[#191919]"
      >
        {/* Fundo geométrico */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#361316] via-[#1b1b1b] to-[#101010]"
        />

        {/* Losango vermelho */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-36 -right-36 h-[360px] w-[360px] rotate-45 border-[45px] border-accent/10 sm:h-[480px] sm:w-[480px] lg:-top-52 lg:-right-32"
        />

        {/* Linhas decorativas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-[25%] hidden h-full w-px bg-white/5 lg:block"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-2/3 bg-linear-to-r from-accent to-transparent"
        />

        {/* Numeração decorativa */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-0 font-mono text-[130px] leading-none font-black tracking-tighter text-white/5 select-none sm:text-[190px] lg:right-10 lg:text-[260px]"
        >
          {trialNumber}
        </span>

        {/* Conteúdo */}
        <div className="relative z-10 grid gap-10 px-5 py-9 sm:px-8 sm:py-12 lg:grid-cols-[1fr_330px] lg:items-end lg:gap-12 lg:px-12 lg:py-16">
          <div className="min-w-0">
            {/* Identificação do experimento */}
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-9 bg-accent" />

              <p className="text-[10px] font-black tracking-[0.23em] text-accent-fg uppercase sm:text-xs">
                MILGRAM / JUDGEMENT SYSTEM
              </p>
            </div>

            {/* Título */}
            <h1
              id="judge-title"
              className="flex flex-col leading-[0.94] font-black tracking-[-0.035em] uppercase"
            >
              <span className="text-[clamp(2.8rem,8vw,6.5rem)] text-white">JULGAMENTO</span>

              <span className="mt-3 text-[clamp(2.4rem,7vw,5.2rem)] text-accent-fg">
                TRIAL {trialNumber}
              </span>
            </h1>

            {/* Identificação da temporada */}
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <SeasonBadge current={season.number} total={TOTAL_SEASONS} />

              <span className="font-mono text-xs font-bold tracking-[0.17em] text-white/55 uppercase">
                SEASON {trialNumber} / {totalTrials}
              </span>
            </div>

            {/* Frase temática */}
            <p className="mt-8 max-w-xl text-lg leading-relaxed font-bold tracking-wide text-white sm:text-xl">
              INOCENTE OU CULPADO?
            </p>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
              Dez prisioneiros. Duas decisões. O veredito está em suas mãos.
            </p>
          </div>

          {/* ======================================
              PAINEL DO ESTADO DA TEMPORADA
              ====================================== */}

          <aside className="relative border border-white/20 bg-black/55">
            {/* Detalhe superior */}
            <div
              aria-hidden="true"
              className="h-[3px] w-full bg-linear-to-r from-accent via-accent/50 to-transparent"
            />

            <div className="p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-bold tracking-[0.17em] text-white/50 uppercase">
                  TRIAL STATUS
                </p>

                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rotate-45 ${
                    isVoting ? "bg-accent" : "border border-white/50 bg-transparent"
                  }`}
                />
              </div>

              <h2 className="text-sm font-black tracking-[0.13em] text-white uppercase">
                {statusLabel}
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-white/65">{statusDescription}</p>

              <div className="mt-6 border-t border-white/15 pt-4">
                <p className="mb-2 font-mono text-[10px] font-bold tracking-[0.15em] text-accent-fg uppercase">
                  PERÍODO DO JULGAMENTO
                </p>

                <p className="text-sm text-white/80">
                  <SeasonStatusText season={season} />
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Rodapé do hero */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/40 px-5 py-4 sm:px-8 lg:px-12">
          <span className="font-mono text-[10px] font-bold tracking-[0.13em] text-white/50 uppercase">
            MILGRAM / PRISONER JUDGEMENT
          </span>

          <span className="font-mono text-[10px] font-bold tracking-[0.13em] text-accent-fg uppercase">
            {prisoners.length} PRISIONEIROS
          </span>
        </div>
      </section>

      {/* ==========================================
          LISTA DOS PRISIONEIROS
          ========================================== */}

      <section aria-labelledby="titulo-prisioneiros">
        {/* Cabeçalho da seção */}
        <div className="mb-6 flex flex-col gap-4 border-b border-white/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="milgram-kicker">PRISONER FILES</p>

            <h2
              id="titulo-prisioneiros"
              className="milgram-heading mt-3 text-2xl sm:text-3xl lg:text-4xl"
            >
              PRISIONEIROS
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              {sectionDescription}
            </p>
          </div>

          {/* Contador */}
          <div className="flex shrink-0 items-baseline gap-2 self-start sm:self-end">
            <span className="font-mono text-3xl font-black text-white">
              {String(prisoners.length).padStart(2, "0")}
            </span>

            <span className="font-mono text-xs font-bold tracking-wider text-accent-fg uppercase">
              FILES
            </span>
          </div>
        </div>

        {/* Legenda do julgamento */}
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border border-white/15 bg-card px-4 py-3 text-xs font-bold tracking-[0.1em] uppercase">
          <span className="text-white/50">VEREDITO</span>

          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 border border-white bg-white" />

            <span className="text-white/85">INOCENTE</span>
          </div>

          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 bg-accent" />

            <span className="text-white/85">CULPADO</span>
          </div>

          <span className="ml-auto font-mono text-[10px] text-white/40">TRIAL {trialNumber}</span>
        </div>

        {/* Grade existente — lógica de votação preservada */}
        <JudgeGrid initialPrisoners={prisoners} seasonNumber={season.number} />
      </section>

      {/* ==========================================
          RODAPÉ TEMÁTICO DA PÁGINA
          ========================================== */}

      <div className="mt-12 border-t border-white/15 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-white/40 uppercase">
            MILGRAM / VOTING SYSTEM
          </p>

          <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-accent-fg uppercase">
            JUDGEMENT {trialNumber} / {totalTrials}
          </p>
        </div>
      </div>
    </main>
  );
}