import type { Metadata } from "next";
import { JudgeGrid } from "@/components/JudgeGrid";
import { SeasonBadge } from "@/components/SeasonBadge";
import { TOTAL_SEASONS } from "@/lib/constants";
import { getJudgeData } from "@/lib/judge";
import type { JudgeSeason } from "@/types/domain";
import { formatDate } from "@/utils/format";

// O selo "voted" depende do visitante e o conteúdo depende do banco:
// a página nunca pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { season } = await getJudgeData();
  return {
    title: `MILGRAM | Votação — Temporada ${season.number}`,
    description: `Julgue os 10 prisioneiros da temporada ${season.number} do MILGRAM: perdoe ou não perdoe.`,
  };
}

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

  return (
    <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-[0.15em] uppercase lg:text-5xl">Julgamento</h1>
        <SeasonBadge current={season.number} total={TOTAL_SEASONS} />
        <p className="text-sm text-white/80">
          <SeasonStatusText season={season} />
        </p>
      </div>

      <section aria-labelledby="titulo-prisioneiros">
        <h2 id="titulo-prisioneiros" className="sr-only">
          Prisioneiros
        </h2>
        <JudgeGrid initialPrisoners={prisoners} seasonNumber={season.number} />
      </section>
    </main>
  );
}
