import { signOut, auth } from "@/auth";
import { redirect } from "next/navigation";

import ImageUploadForm from "@/components/admin/ImageUploadForm";
import { SeasonControl } from "@/components/admin/SeasonControl";
import { SeasonResetButton } from "@/components/SeasonResetButton";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Apresentação dos estados das temporadas.
 *
 * Não modifica os estados armazenados
 * no banco de dados.
 */
function getSeasonStatusLabel(status: string): string {
  switch (status) {
    case "voting":
      return "Em votação";

    case "closed":
      return "Encerrada";

    case "idle":
      return "Aguardando";

    default:
      return status;
  }
}

function getSeasonStatusClass(status: string): string {
  switch (status) {
    case "voting":
      return "border-accent bg-accent/15 text-accent-fg";

    case "closed":
      return "border-[#8ebdc4]/60 bg-[#32555a]/20 text-[#c8e5e9]";

    default:
      return "border-white/20 bg-black/30 text-white/65";
  }
}

export default async function AdminPage() {
  /* ==========================================
     AUTENTICAÇÃO
     ========================================== */

  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  /* ==========================================
     TEMPORADAS
     ========================================== */

  const seasons = await prisma.season.findMany({
    orderBy: { number: "asc" },
  });

  /**
   * Mantém a regra existente:
   *
   * 1. Temporada em votação;
   * 2. Caso não exista, última encerrada;
   * 3. Caso nenhuma exista, sem referência.
   */
  const active =
    seasons.find((s) => s.status === "voting") ??
    seasons.filter((s) => s.status === "closed").pop();

  /* ==========================================
     CONTAGENS DE VOTOS
     ========================================== */

  const voteCounts = active
    ? await prisma.vote.groupBy({
        by: ["prisonerId", "choice"],
        where: { seasonId: active.id },
        _count: true,
      })
    : [];

  const prisoners = await prisma.prisoner.findMany({
    orderBy: { number: "asc" },
  });

  const countsByPrisoner = new Map<
    number,
    {
      forgive: number;
      notForgive: number;
    }
  >();

  for (const c of voteCounts) {
    const current = countsByPrisoner.get(c.prisonerId) ?? {
      forgive: 0,
      notForgive: 0,
    };

    if (c.choice === "forgive") {
      current.forgive = c._count;
    } else {
      current.notForgive = c._count;
    }

    countsByPrisoner.set(c.prisonerId, current);
  }

  /**
   * Resumo calculado a partir das mesmas
   * contagens utilizadas pela tabela.
   *
   * Não executa novas consultas.
   */
  const totals = Array.from(countsByPrisoner.values()).reduce(
    (accumulator, counts) => ({
      forgive: accumulator.forgive + counts.forgive,

      notForgive: accumulator.notForgive + counts.notForgive,
    }),
    {
      forgive: 0,
      notForgive: 0,
    },
  );

  const totalVotes = totals.forgive + totals.notForgive;

  const trialNumber = active ? String(active.number).padStart(2, "0") : "--";

  return (
    <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
      {/* ==========================================
          CABEÇALHO ADMINISTRATIVO
          ========================================== */}

      <header className="relative isolate mb-10 overflow-hidden border border-white/15 bg-[#191919]">
        {/* Fundo geométrico */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#351315] via-[#1b1b1b] to-[#101010]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-36 -right-36 h-[420px] w-[420px] rotate-45 border-[45px] border-accent/10 lg:h-[540px] lg:w-[540px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-32 h-[300px] w-[300px] rotate-45 border-[30px] border-white/5"
        />

        {/* Conteúdo */}
        <div className="relative z-10 px-5 py-9 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
          {/* Identificação e logout */}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-9 bg-accent" />

              <p className="text-[10px] font-black tracking-[0.2em] text-accent-fg uppercase sm:text-xs">
                MILGRAM / SYSTEM CONTROL
              </p>
            </div>

            {/* Preserva a Server Action de logout */}
            <form
              action={async () => {
                "use server";

                await signOut({
                  redirectTo: "/admin/login",
                });
              }}
            >
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-3 border border-white/30 bg-black/40 px-4 py-2 text-xs font-black tracking-[0.12em] text-white uppercase transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span>Sair do painel</span>

                <span aria-hidden="true" className="text-accent-fg">
                  ↗
                </span>
              </button>
            </form>
          </div>

          {/* Título */}
          <div>
            <p className="font-mono text-xs font-bold tracking-[0.17em] text-accent-fg uppercase">
              ADMINISTRATIVE ACCESS
            </p>

            <h1 className="milgram-display mt-4 text-[clamp(2.5rem,9vw,5.5rem)] leading-tight text-white">
              ADMIN PANEL
            </h1>

            <p className="mt-4 max-w-2xl text-lg font-bold text-white">CENTRAL DE CONTROLE</p>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
              Gerencie os julgamentos, acompanhe os votos registrados e administre as imagens dos
              prisioneiros.
            </p>
          </div>

          {/* Estado do sistema */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 border border-[#8ebdc4]/50 bg-[#32555a]/20 px-3 py-2 text-[10px] font-black tracking-[0.12em] text-[#c8e5e9] uppercase">
              <span aria-hidden="true" className="h-2 w-2 bg-[#8ebdc4]" />
              Sessão autenticada
            </span>

            <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/50 uppercase">
              CONTROL / MILGRAM
            </span>
          </div>
        </div>

        {/* ======================================
            INDICADORES RESUMIDOS
            ====================================== */}

        <dl className="relative z-10 grid grid-cols-1 border-t border-white/15 bg-black/35 sm:grid-cols-3">
          {/* Temporadas */}
          <div className="border-b border-white/10 p-5 sm:border-r sm:border-b-0 sm:p-6">
            <dt className="font-mono text-[10px] font-bold tracking-[0.15em] text-white/55 uppercase">
              TEMPORADAS
            </dt>

            <dd className="mt-3 font-mono text-4xl font-black text-white">
              {String(seasons.length).padStart(2, "0")}
            </dd>

            <p className="mt-2 text-xs text-white/45">Julgamentos cadastrados</p>
          </div>

          {/* Prisioneiros */}
          <div className="border-b border-white/10 p-5 sm:border-r sm:border-b-0 sm:p-6">
            <dt className="font-mono text-[10px] font-bold tracking-[0.15em] text-white/55 uppercase">
              PRISIONEIROS
            </dt>

            <dd className="mt-3 font-mono text-4xl font-black text-white">
              {String(prisoners.length).padStart(2, "0")}
            </dd>

            <p className="mt-2 text-xs text-white/45">Registros disponíveis</p>
          </div>

          {/* Votos */}
          <div className="p-5 sm:p-6">
            <dt className="font-mono text-[10px] font-bold tracking-[0.15em] text-white/55 uppercase">
              VOTOS REGISTRADOS
            </dt>

            <dd className="mt-3 font-mono text-4xl font-black text-accent-fg">
              {totalVotes.toLocaleString("pt-BR")}
            </dd>

            <p className="mt-2 text-xs text-white/45">
              {active
                ? `Temporada ${active.number} · ${getSeasonStatusLabel(active.status)}`
                : "Nenhuma temporada de referência"}
            </p>
          </div>
        </dl>

        {/* Linha vermelha inferior */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-20 h-[2px] bg-linear-to-r from-accent via-accent/40 to-transparent"
        />
      </header>

      {/* ==========================================
          CONTROLE DE TEMPORADAS
          ========================================== */}

      <section
        aria-labelledby="admin-seasons-title"
        className="mb-8 overflow-hidden border border-white/20 bg-card"
      >
        {/* Cabeçalho da seção */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 bg-[#1b1b1b] px-5 py-5 sm:px-6">
          <div>
            <p className="milgram-kicker">TRIAL MANAGEMENT</p>

            <h2
              id="admin-seasons-title"
              className="milgram-heading mt-3 text-2xl text-white sm:text-3xl"
            >
              TEMPORADAS
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Consulte o estado dos julgamentos e utilize os controles administrativos para
              gerenciar as temporadas.
            </p>
          </div>

          <span aria-hidden="true" className="font-mono text-3xl font-black text-accent-fg">
            01
          </span>
        </div>

        <div className="p-5 sm:p-6">
          {/* Cartões com os estados */}
          <ul className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {seasons.map((season) => {
              const number = String(season.number).padStart(2, "0");

              const statusLabel = getSeasonStatusLabel(season.status);

              const statusClass = getSeasonStatusClass(season.status);

              return (
                <li
                  key={season.id}
                  className="relative overflow-hidden border border-white/15 bg-[#151515] p-4"
                >
                  {/* Geometria decorativa */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rotate-45 border-[12px] border-accent/5"
                  />

                  <div className="relative">
                    <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-accent-fg uppercase">
                      TRIAL / {number}
                    </p>

                    <p className="milgram-display mt-3 text-3xl leading-none text-white">
                      {number}
                    </p>

                    <div className="mt-5">
                      <span
                        className={`inline-flex min-h-8 items-center border px-3 py-1 text-[10px] font-black tracking-[0.1em] uppercase ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Componente funcional existente */}
          <div className="border-t border-white/15 pt-6">
            <div className="mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-7 bg-accent" />

              <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-white/60 uppercase">
                SEASON CONTROLS
              </p>
            </div>

            <SeasonControl seasons={seasons} />
          </div>
        </div>
      </section>

      {/* ==========================================
          GERENCIAMENTO DE IMAGENS
          ========================================== */}

      <section
        aria-labelledby="admin-images-title"
        className="mb-8 overflow-hidden border border-white/20 bg-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 bg-[#1b1b1b] px-5 py-5 sm:px-6">
          <div>
            <p className="milgram-kicker">PRISONER ASSETS</p>

            <h2
              id="admin-images-title"
              className="milgram-heading mt-3 text-2xl text-white sm:text-3xl"
            >
              GERENCIAMENTO DE IMAGENS
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Administre os retratos utilizados nas fichas dos prisioneiros e nas diferentes
              temporadas.
            </p>
          </div>

          <span aria-hidden="true" className="font-mono text-3xl font-black text-accent-fg">
            02
          </span>
        </div>

        {/* Preserva integralmente o formulário */}
        <div className="min-w-0 p-5 sm:p-6">
          <ImageUploadForm />
        </div>
      </section>

      {/* ==========================================
          ESTATÍSTICAS DE VOTAÇÃO
          ========================================== */}

      <section
        aria-labelledby="admin-votes-title"
        className="mb-8 overflow-hidden border border-white/20 bg-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 bg-[#1b1b1b] px-5 py-5 sm:px-6">
          <div>
            <p className="milgram-kicker">VOTING ANALYTICS</p>

            <h2
              id="admin-votes-title"
              className="milgram-heading mt-3 text-2xl text-white sm:text-3xl"
            >
              ESTATÍSTICAS DE VOTAÇÃO
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Acompanhe a contagem de votos por prisioneiro na temporada utilizada como referência.
            </p>
          </div>

          <span aria-hidden="true" className="font-mono text-3xl font-black text-accent-fg">
            03
          </span>
        </div>

        {active ? (
          <>
            {/* Identificação da temporada */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 bg-black/20 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-black tracking-[0.13em] text-accent-fg uppercase">
                  TRIAL {trialNumber}
                </span>

                <span
                  className={`inline-flex border px-3 py-1 text-[10px] font-black tracking-[0.1em] uppercase ${getSeasonStatusClass(active.status)}`}
                >
                  {getSeasonStatusLabel(active.status)}
                </span>
              </div>

              <span className="font-mono text-xs font-bold text-white/60">
                {totalVotes.toLocaleString("pt-BR")} votos
              </span>
            </div>

            {/* Resumo dos votos */}
            <dl className="grid grid-cols-1 border-b border-white/15 sm:grid-cols-3">
              <div className="border-b border-white/10 bg-[#32555a]/10 p-5 sm:border-r sm:border-b-0">
                <dt className="text-xs font-bold tracking-[0.1em] text-[#a4d0d6] uppercase">
                  INOCENTE
                </dt>

                <dd className="mt-2 font-mono text-3xl font-black text-[#c8e5e9]">
                  {totals.forgive.toLocaleString("pt-BR")}
                </dd>
              </div>

              <div className="border-b border-white/10 bg-accent/5 p-5 sm:border-r sm:border-b-0">
                <dt className="text-xs font-bold tracking-[0.1em] text-accent-fg uppercase">
                  CULPADO
                </dt>

                <dd className="mt-2 font-mono text-3xl font-black text-accent-fg">
                  {totals.notForgive.toLocaleString("pt-BR")}
                </dd>
              </div>

              <div className="p-5">
                <dt className="text-xs font-bold tracking-[0.1em] text-white/60 uppercase">
                  TOTAL
                </dt>

                <dd className="mt-2 font-mono text-3xl font-black text-white">
                  {totalVotes.toLocaleString("pt-BR")}
                </dd>
              </div>
            </dl>

            {/* Tabela de votação */}
            <div className="p-4 sm:p-6">
              {/* Rolagem horizontal somente na tabela */}
              <div className="w-full overflow-x-auto border border-white/15">
                <table className="w-full min-w-[580px] border-collapse text-sm">
                  <caption className="sr-only">
                    Contagem de votos por prisioneiro na temporada {active.number}
                  </caption>

                  <thead className="bg-[#242424] text-left">
                    <tr className="border-b border-white/20">
                      <th
                        scope="col"
                        className="px-4 py-4 font-mono text-[10px] font-bold tracking-[0.12em] text-white/60 uppercase"
                      >
                        NO.
                      </th>

                      <th
                        scope="col"
                        className="px-4 py-4 font-mono text-[10px] font-bold tracking-[0.12em] text-white/60 uppercase"
                      >
                        PRISIONEIRO
                      </th>

                      <th
                        scope="col"
                        className="px-4 py-4 text-right font-mono text-[10px] font-bold tracking-[0.12em] text-[#a4d0d6] uppercase"
                      >
                        INOCENTE
                      </th>

                      <th
                        scope="col"
                        className="px-4 py-4 text-right font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase"
                      >
                        CULPADO
                      </th>

                      <th
                        scope="col"
                        className="px-4 py-4 text-right font-mono text-[10px] font-bold tracking-[0.12em] text-white/75 uppercase"
                      >
                        TOTAL
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {prisoners.map((prisoner) => {
                      const counts = countsByPrisoner.get(prisoner.id) ?? {
                        forgive: 0,
                        notForgive: 0,
                      };

                      const prisonerTotal = counts.forgive + counts.notForgive;

                      return (
                        <tr
                          key={prisoner.id}
                          className="border-b border-white/10 bg-[#181818] transition-colors last:border-b-0 hover:bg-white/5"
                        >
                          <td className="px-4 py-4 font-mono text-xs font-bold text-accent-fg">
                            No.
                            {String(prisoner.number).padStart(2, "0")}
                          </td>

                          <th
                            scope="row"
                            className="px-4 py-4 text-left text-sm font-bold text-white"
                          >
                            {prisoner.nickname}
                          </th>

                          <td className="px-4 py-4 text-right font-mono text-sm font-bold text-[#c8e5e9] tabular-nums">
                            {counts.forgive.toLocaleString("pt-BR")}
                          </td>

                          <td className="px-4 py-4 text-right font-mono text-sm font-bold text-accent-fg tabular-nums">
                            {counts.notForgive.toLocaleString("pt-BR")}
                          </td>

                          <td className="px-4 py-4 text-right font-mono text-sm font-black text-white tabular-nums">
                            {prisonerTotal.toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totais gerais */}
                  <tfoot>
                    <tr className="border-t-2 border-accent bg-[#242424]">
                      <th
                        scope="row"
                        colSpan={2}
                        className="px-4 py-4 text-left text-xs font-black tracking-[0.1em] text-white uppercase"
                      >
                        TOTAL GERAL
                      </th>

                      <td className="px-4 py-4 text-right font-mono text-sm font-black text-[#c8e5e9] tabular-nums">
                        {totals.forgive.toLocaleString("pt-BR")}
                      </td>

                      <td className="px-4 py-4 text-right font-mono text-sm font-black text-accent-fg tabular-nums">
                        {totals.notForgive.toLocaleString("pt-BR")}
                      </td>

                      <td className="px-4 py-4 text-right font-mono text-sm font-black text-white tabular-nums">
                        {totalVotes.toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* Nenhuma votação ativa ou encerrada */
          <div className="p-5 sm:p-6">
            <div className="border-l-[3px] border-white/25 bg-black/25 p-5">
              <p className="font-mono text-[10px] font-bold tracking-[0.13em] text-accent-fg uppercase">
                NO DATA AVAILABLE
              </p>

              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Nenhuma temporada em votação ou encerrada está disponível para consulta de
                estatísticas.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ==========================================
          OPERAÇÕES IRREVERSÍVEIS
          ========================================== */}

      <section
        aria-labelledby="admin-danger-title"
        className="overflow-hidden border border-accent/50 bg-[#1b1515]"
      >
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-accent/25 bg-accent/5 px-5 py-5 sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-accent-fg uppercase">
              RESTRICTED OPERATIONS
            </p>

            <h2
              id="admin-danger-title"
              className="milgram-heading mt-3 text-2xl text-white sm:text-3xl"
            >
              REDEFINIÇÃO DO SISTEMA
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              Esta área contém ações que alteram permanentemente o estado dos julgamentos.
            </p>
          </div>

          <span aria-hidden="true" className="font-mono text-3xl font-black text-accent-fg">
            04
          </span>
        </div>

        {/* Controle existente de reset */}
        <div className="p-5 sm:p-6">
          <div className="mb-6 border-l-[3px] border-accent bg-accent/10 p-4">
            <p className="text-xs font-black tracking-[0.1em] text-accent-fg uppercase">ATENÇÃO</p>

            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Redefinir as temporadas remove os votos e resultados registrados e retorna os
              julgamentos ao estado inicial. As imagens dos prisioneiros são preservadas.
            </p>
          </div>

          <SeasonResetButton />
        </div>

        {/* Linha inferior */}
        <div
          aria-hidden="true"
          className="h-[3px] bg-linear-to-r from-accent via-accent/50 to-transparent"
        />
      </section>

      {/* ==========================================
          RODAPÉ ADMINISTRATIVO
          ========================================== */}

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-6">
        <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/40 uppercase">
          MILGRAM / ADMINISTRATIVE SYSTEM
        </p>

        <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
          SYSTEM CONTROL
        </p>
      </footer>
    </main>
  );
}