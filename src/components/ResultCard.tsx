import Image from "next/image";

import type { JudgePrisoner } from "@/types/domain";
import type { ResultStats } from "@/lib/result";

import { formatPrisonerNumber } from "@/utils/format";
import { ResultSplitBar } from "./ResultSplitBar";

interface ResultCardProps {
  prisoner: Pick<JudgePrisoner, "number" | "slug" | "nickname" | "fullName" | "imageUrl">;
  stats: ResultStats;
  seasonNumber: number;
  priority?: boolean;
}

const VERDICT_PRESENTATION = {
  lost: {
    label: "Empate",
    code: "TIE",
    icon: "?",
    badgeClass: "border-white/40 bg-black/40 text-white",
  },

  not_guilty: {
    label: "Perdoado",
    code: "NOT GUILTY",
    icon: "○",
    badgeClass: "border-[#8ebdc4] bg-[#32555a]/20 text-[#c8e5e9]",
  },

  guilty: {
    label: "Não perdoado",
    code: "GUILTY",
    icon: "✕",
    badgeClass: "border-accent bg-accent/15 text-accent-fg",
  },
} as const;

export function ResultCard({ prisoner, stats, seasonNumber, priority = false }: ResultCardProps) {
  const verdict = VERDICT_PRESENTATION[stats.verdict];

  const numberLabel = formatPrisonerNumber(prisoner.number);

  const prisonerNumber = String(prisoner.number).padStart(3, "0");

  const trialNumber = String(seasonNumber).padStart(2, "0");

  return (
    <article className="group relative flex min-w-0 flex-col gap-4 overflow-hidden border border-white/15 bg-[#141414] p-4 transition-colors hover:border-white/30 sm:flex-row sm:items-center sm:gap-6 sm:p-5 lg:gap-8 lg:p-6">
      {/* ======================================
          RETRATO DO PRISIONEIRO
          ====================================== */}

      <figure className="relative h-[184px] w-[160px] max-w-full shrink-0 self-center overflow-hidden bg-card sm:self-start">
        {prisoner.imageUrl ? (
          <Image
            src={prisoner.imageUrl}
            alt={`Retrato de ${prisoner.nickname}, ${numberLabel}, temporada ${seasonNumber}`}
            fill
            sizes="160px"
            className="object-contain object-bottom"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-card px-3 text-center text-xs text-white/60">
            Sem imagem
          </div>
        )}
      </figure>

      {/* ======================================
          IDENTIFICAÇÃO E RESULTADO
          ====================================== */}

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Número oficial do prisioneiro */}
            <p className="milgram-display text-xl leading-none text-accent-fg sm:text-2xl">
              PRISON.{prisonerNumber}
            </p>

            {/* Nome */}
            <h3 className="milgram-display mt-3 text-[clamp(1.8rem,4vw,3rem)] leading-tight text-white">
              {prisoner.nickname}
            </h3>

            <p className="mt-1 text-xs tracking-wide text-white/55 sm:text-sm">
              {prisoner.fullName}
            </p>
          </div>

          {/* Informações adicionais */}
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">
              TRIAL {trialNumber}
            </span>

            <span
              className={`inline-flex items-center gap-2 border px-3 py-2 text-[10px] font-black tracking-wide uppercase ${verdict.badgeClass}`}
            >
              <span aria-hidden="true" className="text-sm leading-none">
                {verdict.icon}
              </span>

              {verdict.label}
            </span>
          </div>
        </div>

        {/* ==================================
            BARRA ÚNICA DE RESULTADOS
            ================================== */}

        {stats.total === 0 ? (
          <div className="border-l-[3px] border-white/30 bg-white/5 px-4 py-5">
            <p className="text-sm text-white/65">Sem votos nesta temporada.</p>
          </div>
        ) : (
          <ResultSplitBar
            forgiveCount={stats.forgiveCount}
            forgivePercent={stats.forgivePercent}
            notForgiveCount={stats.notForgiveCount}
            notForgivePercent={stats.notForgivePercent}
          />
        )}

        {/* Rodapé discreto */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-white/40 uppercase">
            MILGRAM / JUDGEMENT RECORD
          </p>

          <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-accent-fg uppercase">
            {verdict.code}
          </p>
        </div>
      </div>
    </article>
  );
}
