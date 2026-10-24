import Image from "next/image";
import type { JudgePrisoner } from "@/types/domain";
import type { ResultStats } from "@/lib/result";
import { formatPrisonerNumber } from "@/utils/format";
import { ResultBar } from "./ResultBar";

const VERDICT_PRESENTATION = {
  lost: { label: "Empate", icon: "?", badgeClass: "border-white/60 bg-black text-white" },
  not_guilty: { label: "Perdoado", icon: "○", badgeClass: "border-white bg-white text-black" },
  guilty: { label: "Não perdoado", icon: "✕", badgeClass: "border-accent bg-accent text-white" },
} as const;

interface ResultCardProps {
  prisoner: Pick<JudgePrisoner, "number" | "slug" | "nickname" | "fullName" | "imageUrl">;
  stats: ResultStats;
  seasonNumber: number;
  /** Eager load para LCP. Apenas o primeiro card. */
  priority?: boolean;
}

export function ResultCard({ prisoner, stats, seasonNumber, priority = false }: ResultCardProps) {
  const v = VERDICT_PRESENTATION[stats.verdict];
  const numberLabel = formatPrisonerNumber(prisoner.number);

  return (
    <article className="md:flex-row md:items-start md:gap-6 flex flex-col gap-4 border border-white/20 bg-card p-4">
      <div className="md:w-40 relative aspect-[3/4] w-full shrink-0">
        {prisoner.imageUrl ? (
          <Image
            src={prisoner.imageUrl}
            alt={`Retrato de ${prisoner.nickname}, ${numberLabel}, temporada ${seasonNumber}`}
            fill
            sizes="(min-width: 768px) 160px, 100vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-black text-xs text-white/70">
            Sem imagem
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-bold tracking-widest text-accent">{numberLabel}</p>
            <h3 className="text-xl font-bold">{prisoner.nickname}</h3>
            <p className="text-xs text-white/60">{prisoner.fullName}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1 border px-3 py-1 text-xs font-bold tracking-wider uppercase ${v.badgeClass}`}
          >
            <span aria-hidden="true">{v.icon}</span>
            {v.label}
          </span>
        </div>

        {stats.total === 0 ? (
          <p className="text-sm text-white/60">Sem votos nesta temporada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <ResultBar
              label="Perdoar"
              count={stats.forgiveCount}
              percent={stats.forgivePercent}
              tone="forgive"
            />
            <ResultBar
              label="Não perdoar"
              count={stats.notForgiveCount}
              percent={stats.notForgivePercent}
              tone="not-forgive"
            />
            <p className="text-right text-xs text-white/50">{stats.total} votos no total</p>
          </div>
        )}
      </div>
    </article>
  );
}
