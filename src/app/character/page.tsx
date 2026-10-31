import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { getCurrentSeason } from "@/lib/season";
import { getPrisonerImage } from "@/lib/prisoner-image";

import { GlitchText } from "@/components/GlitchText";
import { SeasonBadge } from "@/components/SeasonBadge";

import { TOTAL_SEASONS } from "@/lib/constants";
import { formatPrisonerNumber } from "@/utils/format";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "MILGRAM | Prisioneiros",
  description: "Conheça os 10 prisioneiros do MILGRAM e seus guias.",
  path: "/character",
});

/**
 * Preserva os enquadramentos ajustados
 * nas etapas anteriores.
 *
 * Temporada 2:
 * - Yuno: object-cover object-top.
 *
 * Temporada 3:
 * - Futa: object-cover object-top.
 * - Amane: object-cover object-top.
 *
 * Demais casos:
 * - object-contain object-center.
 */
function getCharacterImageClass(slug: string, seasonNumber: number): string {
  const needsFullHeight =
    (seasonNumber === 2 && slug === "yuno") ||
    (seasonNumber === 3 && (slug === "futa" || slug === "amane"));

  if (needsFullHeight) {
    return "object-cover object-top";
  }

  return "object-contain object-center";
}

export default async function CharacterListPage() {
  const [currentSeason, prisoners] = await Promise.all([
    getCurrentSeason(),
    prisma.prisoner.findMany({
      orderBy: { number: "asc" },
      include: { images: true },
    }),
  ]);

  const trialNumber = String(currentSeason.number).padStart(2, "0");

  const statusLabel =
    currentSeason.status === "voting"
      ? "VOTAÇÃO EM ANDAMENTO"
      : currentSeason.status === "closed"
        ? "JULGAMENTO ENCERRADO"
        : "AGUARDANDO JULGAMENTO";

  return (
    <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
      {/* ==========================================
          CABEÇALHO DA PÁGINA
          ========================================== */}

      <section
        aria-labelledby="character-title"
        className="relative isolate mb-10 overflow-hidden border border-white/15 bg-[#191919]"
      >
        {/* Fundo geométrico */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#351315] via-[#1b1b1b] to-[#101010]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-36 -right-36 h-[420px] w-[420px] rotate-45 border-[45px] border-accent/10 lg:h-[550px] lg:w-[550px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-36 h-[340px] w-[340px] rotate-45 border-[35px] border-white/5"
        />

        {/* Número decorativo */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 bottom-2 font-mono text-[130px] leading-none font-black text-white/5 select-none sm:text-[190px] lg:text-[230px]"
        >
          10
        </span>

        <div className="relative z-10 px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          {/* Identificação */}
          <div className="mb-7 flex items-center gap-3">
            <span aria-hidden="true" className="h-[2px] w-9 bg-accent" />

            <p className="text-[10px] font-black tracking-[0.22em] text-accent-fg uppercase sm:text-xs">
              MILGRAM / PRISONER DATABASE
            </p>
          </div>

          {/* Título */}
          <GlitchText
            as="h1"
            className="milgram-heading text-[clamp(2.3rem,9vw,5.5rem)] leading-tight text-white"
          >
            PRISIONEIROS
          </GlitchText>

          {/* Subtítulo */}
          <p className="mt-5 max-w-2xl text-lg leading-relaxed font-bold text-white sm:text-xl">
            DEZ PRISIONEIROS. DEZ HISTÓRIAS.
          </p>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
            Conheça os prisioneiros de MILGRAM. Explore seus perfis, descubra suas identidades e
            acompanhe os resultados de cada julgamento.
          </p>

          {/* Temporada atual */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <SeasonBadge current={currentSeason.number} total={TOTAL_SEASONS} />

            <span className="font-mono text-xs font-bold tracking-[0.12em] text-white/60 uppercase">
              TRIAL {trialNumber}
            </span>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/40 px-5 py-4 sm:px-8 lg:px-12">
          <span className="font-mono text-[10px] font-bold tracking-[0.13em] text-white/55 uppercase">
            MILGRAM / CHARACTER FILES
          </span>

          <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
            {statusLabel}
          </span>
        </div>

        {/* Linha vermelha inferior */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-20 h-[2px] bg-linear-to-r from-accent via-accent/40 to-transparent"
        />
      </section>

      {/* ==========================================
          LISTAGEM DOS PRISIONEIROS
          ========================================== */}

      <section aria-labelledby="titulo-prisioneiros">
        {/* Cabeçalho da seção */}
        <div className="mb-7 flex flex-col gap-4 border-b border-white/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="milgram-kicker">PRISONER FILES</p>

            <h2
              id="titulo-prisioneiros"
              className="milgram-heading mt-3 text-2xl text-white sm:text-3xl"
            >
              ARQUIVOS DOS PRISIONEIROS
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              Selecione um prisioneiro para visualizar sua ficha e seu histórico de julgamentos.
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

        {/* Grade dos prisioneiros */}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {prisoners.map((prisoner) => {
            const image = getPrisonerImage(prisoner.images, currentSeason.number);

            const numberLabel = formatPrisonerNumber(prisoner.number);

            const prisonerNumber = String(prisoner.number).padStart(2, "0");

            const imageFrameClass = getCharacterImageClass(prisoner.slug, currentSeason.number);

            return (
              <li key={prisoner.id} className="min-w-0">
                <Link
                  href={`/character/${prisoner.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden border border-white/25 bg-card transition-[transform,border-color,box-shadow] duration-200 hover:border-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_12px_32px_rgba(234,16,22,0.18)]"
                >
                  {/* ==============================
                      RETRATO
                      ============================== */}

                  <figure className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-[#0c0c0c]">
                    {/* Fundo geométrico */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-12 -bottom-16 h-36 w-36 rotate-45 border-[16px] border-accent/10"
                    />

                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-8 right-2 font-mono text-[clamp(3rem,8vw,5rem)] leading-none font-black text-white/5"
                    >
                      {prisonerNumber}
                    </span>

                    {/* Imagem da temporada atual */}
                    {image?.url ? (
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        sizes="(min-width: 960px) 20vw, (min-width: 560px) 33vw, 50vw"
                        className={`${imageFrameClass} transition-transform duration-300 motion-safe:group-hover:scale-[1.03]`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-black px-2 text-center text-xs text-white/70">
                        Sem imagem
                      </div>
                    )}

                    {/* Gradiente inferior */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/95 via-black/55 to-transparent"
                    />

                    {/* Número do prisioneiro */}
                    <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                      <div>
                        <p className="mb-1 font-mono text-[9px] font-bold tracking-[0.14em] text-white/65 uppercase">
                          PRISONER
                        </p>

                        <p className="font-mono text-xl leading-none font-black text-accent-fg sm:text-2xl">
                          {numberLabel}
                        </p>
                      </div>

                      <span
                        aria-hidden="true"
                        className="font-mono text-[9px] font-bold text-white/50"
                      >
                        T-{trialNumber}
                      </span>
                    </figcaption>

                    {/* Canto decorativo */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-accent/80"
                    />
                  </figure>

                  {/* ==============================
                      IDENTIFICAÇÃO
                      ============================== */}

                  <div className="flex flex-1 flex-col border-t border-white/15 bg-[#1c1c1c] px-3 pt-3 pb-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-accent-fg uppercase">
                        FILE / {prisonerNumber}
                      </span>

                      <span className="font-mono text-[9px] text-white/40">MILGRAM</span>
                    </div>

                    <h3 className="text-base leading-snug font-black tracking-wide text-white transition-colors group-hover:text-accent-fg sm:text-lg">
                      {prisoner.nickname}
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-white/65">
                      {prisoner.fullName}
                    </p>

                    {/* Barra decorativa */}
                    <div aria-hidden="true" className="mt-auto flex items-center gap-2 pt-4">
                      <span className="h-[3px] w-10 bg-accent" />

                      <span className="h-px flex-1 bg-white/10" />

                      <span className="h-1.5 w-1.5 rotate-45 border border-accent/70" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ==========================================
          RODAPÉ DA SEÇÃO
          ========================================== */}

      <div className="mt-12 border-t border-white/15 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-white/40 uppercase">
            MILGRAM / PRISONER DATABASE
          </p>

          <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-accent-fg uppercase">
            CURRENT TRIAL / {trialNumber}
          </p>
        </div>
      </div>
    </main>
  );
}
