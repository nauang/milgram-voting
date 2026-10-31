import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { getCurrentSeason } from "@/lib/season";
import { getPrisonerImage } from "@/lib/prisoner-image";
import { TOTAL_SEASONS } from "@/lib/constants";
import { formatPrisonerNumber } from "@/utils/format";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "MILGRAM | Voting System",
  description:
    "Entre no julgamento de MILGRAM. Conheça os dez prisioneiros e decida quem merece ser perdoado.",
  path: "/",
});

export default async function HomePage() {
  const [currentSeason, prisoners] = await Promise.all([
    getCurrentSeason(),
    prisma.prisoner.findMany({
      orderBy: { number: "asc" },
      include: { images: true },
    }),
  ]);

  const isVoting = currentSeason.status === "voting";
  const isClosed = currentSeason.status === "closed";

  const statusLabel = isVoting
    ? "VOTAÇÃO EM ANDAMENTO"
    : isClosed
      ? "JULGAMENTO ENCERRADO"
      : "AGUARDANDO JULGAMENTO";

  const statusDescription = isVoting
    ? "O julgamento está aberto. Sua decisão pode mudar o destino dos prisioneiros."
    : isClosed
      ? "O julgamento desta temporada terminou. Consulte os vereditos e descubra o resultado."
      : "A votação desta temporada ainda não começou. Conheça os prisioneiros enquanto aguarda.";

  const primaryHref = isClosed ? `/judge/result/${currentSeason.number}` : "/judge";

  const primaryLabel = isClosed
    ? "VER RESULTADOS"
    : isVoting
      ? "ENTRAR NO JULGAMENTO"
      : "ACESSAR JULGAMENTO";

  // Retratos já cadastrados no Supabase.
  // Nenhuma imagem externa é necessária.
  const featuredPrisoners = prisoners
    .map((prisoner) => ({
      ...prisoner,
      imageUrl: getPrisonerImage(prisoner.images, currentSeason.number)?.url ?? null,
    }))
    .filter((prisoner) => prisoner.imageUrl !== null)
    .slice(0, 3);

  return (
    <main id="conteudo" className="relative min-w-0 flex-1 overflow-hidden">
      {/* ==============================================
          HERO — IDENTIDADE MILGRAM
          ============================================== */}

      <section
        aria-labelledby="home-title"
        className="relative isolate min-h-[640px] overflow-hidden border-b border-white/15 bg-[#101010] lg:min-h-[660px]"
      >
        {/* Fundo geométrico */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#3c1115] via-[#171717] to-[#090909]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rotate-45 border-[60px] border-accent/10 lg:h-[760px] lg:w-[760px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 -left-64 h-[520px] w-[520px] rotate-45 border-[45px] border-white/5"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-[20%] hidden h-full w-px bg-white/5 lg:block"
        />

        {/* Conteúdo principal */}
        <div className="relative mx-auto grid min-h-[640px] max-w-7xl grid-cols-1 items-center gap-6 px-5 pt-12 pb-8 sm:px-8 lg:min-h-[660px] lg:grid-cols-2 lg:gap-10 lg:py-12">
          {/* Texto principal */}
          <div className="relative z-10 flex flex-col items-start">
            <div className="mb-7 flex items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-9 bg-accent" />

              <p className="text-[10px] font-black tracking-[0.25em] text-accent-fg uppercase sm:text-xs">
                MILGRAM / VOTING SYSTEM
              </p>
            </div>

            <h1
              id="home-title"
              className="flex flex-col leading-[0.91] font-black tracking-[-0.045em] uppercase"
            >
              <span className="text-[clamp(3.5rem,11vw,7rem)] text-white">MILGRAM</span>

              <span className="mt-3 text-[clamp(3.1rem,10vw,6.5rem)] text-accent-fg">VOTING</span>
            </h1>

            <div className="mt-7 flex items-center gap-3">
              <span className="h-[3px] w-12 bg-accent" />

              <span className="font-mono text-xs font-bold tracking-[0.2em] text-white/70 uppercase">
                TRIAL {String(currentSeason.number).padStart(2, "0")}
              </span>

              <span className="text-white/30">/</span>

              <span className="font-mono text-xs text-white/50">
                {String(TOTAL_SEASONS).padStart(2, "0")}
              </span>
            </div>

            <p className="mt-8 max-w-lg text-xl leading-relaxed font-bold tracking-wide text-white sm:text-2xl">
              VOCÊ DECIDE O VEREDITO.
            </p>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
              Dez prisioneiros. Três julgamentos. Duas escolhas. Conheça suas histórias e decida
              quem deve ser perdoado.
            </p>

            {/* Status da temporada */}
            <div className="mt-8 w-full max-w-md border-l-[3px] border-accent bg-black/40 px-4 py-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rotate-45 ${isVoting ? "bg-accent" : "bg-white/50"}`}
                />

                <span className="text-xs font-black tracking-[0.13em] text-white uppercase">
                  {statusLabel}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-white/60">{statusDescription}</p>
            </div>

            {/* Ações */}
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="group inline-flex min-h-13 items-center justify-between gap-5 border border-accent bg-accent px-6 py-4 text-xs font-black tracking-[0.12em] text-white uppercase transition-colors hover:border-accent-2 hover:bg-accent-2 focus-visible:outline-offset-4"
              >
                <span>{primaryLabel}</span>

                <span
                  aria-hidden="true"
                  className="text-lg leading-none transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>

              <Link
                href="/character"
                className="inline-flex min-h-13 items-center justify-center border border-white/35 bg-black/30 px-6 py-4 text-xs font-black tracking-[0.12em] text-white uppercase transition-colors hover:border-white hover:bg-white/10"
              >
                CONHECER PRISIONEIROS
              </Link>
            </div>
          </div>

          {/* ==========================================
              COMPOSIÇÃO DOS PERSONAGENS

              Usa as imagens já cadastradas.
              object-contain evita cortes.
              ========================================== */}

          <div className="relative flex min-h-[320px] items-end justify-center lg:min-h-[520px]">
            {/* Número decorativo */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-5 right-0 font-mono text-[110px] leading-none font-black tracking-tighter text-white/5 sm:text-[170px] lg:text-[220px]"
            >
              {String(currentSeason.number).padStart(2, "0")}
            </span>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-3 bottom-0 left-3 h-3/4 border-x border-white/10"
            />

            <div className="relative z-10 grid h-[300px] w-full max-w-[580px] grid-cols-3 items-end gap-1 sm:h-[380px] lg:h-[480px]">
              {featuredPrisoners.map((prisoner, index) => (
                <Link
                  key={prisoner.id}
                  href={`/character/${prisoner.slug}`}
                  aria-label={`Conhecer ${prisoner.nickname}`}
                  className={`group relative block h-full min-w-0 overflow-hidden border border-white/10 bg-black/20 transition-colors hover:border-accent/80 ${
                    index === 1 ? "border-accent/40 bg-[#241215]" : ""
                  }`}
                >
                  {prisoner.imageUrl && (
                    <Image
                      src={prisoner.imageUrl}
                      alt={`Retrato de ${prisoner.nickname}`}
                      fill
                      sizes="(min-width: 960px) 200px, 33vw"
                      className="object-contain object-bottom transition-transform duration-300 group-hover:scale-[1.04]"
                      priority={index === 1}
                    />
                  )}

                  {/* Degradê inferior */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/95 via-black/50 to-transparent"
                  />

                  {/* Identificação */}
                  <div className="absolute inset-x-0 bottom-0 z-10 p-2 sm:p-3">
                    <p className="font-mono text-[10px] font-bold text-accent-fg">
                      {formatPrisonerNumber(prisoner.number)}
                    </p>

                    <p className="mt-1 truncate text-xs font-black tracking-wide text-white uppercase sm:text-sm">
                      {prisoner.nickname}
                    </p>
                  </div>
                </Link>
              ))}

              {featuredPrisoners.length === 0 && (
                <div className="col-span-3 flex h-full items-center justify-center border border-white/10 bg-black/30 p-6 text-center">
                  <p className="text-sm tracking-wider text-white/60 uppercase">
                    Arquivos dos prisioneiros
                  </p>
                </div>
              )}
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 left-0 h-[3px] w-2/3 bg-linear-to-r from-accent to-transparent"
            />
          </div>
        </div>

        {/* Faixa inferior do hero */}
        <div className="relative z-10 border-t border-white/10 bg-black/45">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-[10px] font-bold tracking-[0.13em] text-white/50 uppercase sm:px-8">
            <span>MILGRAM / EXPERIMENTO DE JULGAMENTO</span>

            <span>
              {prisoners.length} PRISIONEIROS — {TOTAL_SEASONS} TEMPORADAS
            </span>
          </div>
        </div>
      </section>

      {/* ==============================================
          SEÇÕES PRINCIPAIS
          ============================================== */}

      <section
        aria-labelledby="home-sections-title"
        className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24"
      >
        <div className="mb-10 flex flex-col gap-3">
          <p className="milgram-kicker">EXPLORE MILGRAM</p>

          <h2 id="home-sections-title" className="milgram-heading text-2xl sm:text-4xl">
            O JULGAMENTO COMEÇA AQUI.
          </h2>

          <p className="max-w-2xl text-sm leading-relaxed text-white/65">
            Acompanhe as temporadas, descubra os prisioneiros e participe das decisões quando uma
            votação estiver aberta.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Acesso ao julgamento */}
          <Link
            href="/judge"
            className="group relative flex min-h-[270px] flex-col justify-between overflow-hidden border border-white/20 bg-card p-7 transition-colors hover:border-accent sm:p-9"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rotate-45 border-[35px] border-accent/10"
            />

            <div className="relative">
              <p className="font-mono text-xs font-bold tracking-widest text-accent-fg">
                01 / JUDGE
              </p>

              <h3 className="mt-5 text-3xl font-black tracking-wider text-white uppercase">
                JULGAMENTO
              </h3>

              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
                Escolha entre perdoar e não perdoar. Acompanhe o julgamento da temporada atual.
              </p>
            </div>

            <div className="relative mt-8 flex items-center justify-between border-t border-white/15 pt-5">
              <span className="text-xs font-bold tracking-wider text-white uppercase">ACESSAR</span>

              <span
                aria-hidden="true"
                className="text-xl text-accent-fg transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </div>
          </Link>

          {/* Acesso aos personagens */}
          <Link
            href="/character"
            className="group relative flex min-h-[270px] flex-col justify-between overflow-hidden border border-white/20 bg-card p-7 transition-colors hover:border-accent sm:p-9"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -bottom-20 h-64 w-64 rotate-45 border-[35px] border-white/5"
            />

            <div className="relative">
              <p className="font-mono text-xs font-bold tracking-widest text-accent-fg">
                02 / CHARACTER
              </p>

              <h3 className="mt-5 text-3xl font-black tracking-wider text-white uppercase">
                PRISIONEIROS
              </h3>

              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
                Conheça os dez prisioneiros, explore seus perfis e acompanhe seus históricos de
                julgamento.
              </p>
            </div>

            <div className="relative mt-8 flex items-center justify-between border-t border-white/15 pt-5">
              <span className="text-xs font-bold tracking-wider text-white uppercase">
                EXPLORAR
              </span>

              <span
                aria-hidden="true"
                className="text-xl text-accent-fg transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ==============================================
          INFORMAÇÕES DO EXPERIMENTO
          ============================================== */}

      <section className="border-y border-white/10 bg-black/35">
        <div className="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-3">
          <div className="border-b border-white/10 px-8 py-8 sm:border-r sm:border-b-0">
            <p className="font-mono text-4xl font-black text-white">
              {String(prisoners.length).padStart(2, "0")}
            </p>

            <p className="mt-2 text-xs font-bold tracking-[0.15em] text-white/55 uppercase">
              PRISIONEIROS
            </p>
          </div>

          <div className="border-b border-white/10 px-8 py-8 sm:border-r sm:border-b-0">
            <p className="font-mono text-4xl font-black text-white">
              {String(TOTAL_SEASONS).padStart(2, "0")}
            </p>

            <p className="mt-2 text-xs font-bold tracking-[0.15em] text-white/55 uppercase">
              TEMPORADAS
            </p>
          </div>

          <div className="px-8 py-8">
            <p className="font-mono text-4xl font-black text-accent-fg">02</p>

            <p className="mt-2 text-xs font-bold tracking-[0.15em] text-white/55 uppercase">
              VEREDITOS POSSÍVEIS
            </p>
          </div>
        </div>
      </section>

      {/* ==============================================
          CHAMADA FINAL
          ============================================== */}

      <section className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 lg:py-24">
        <p className="milgram-kicker">YOUR VERDICT</p>

        <h2 className="milgram-heading mx-auto mt-5 max-w-3xl text-3xl sm:text-5xl">
          PERDOAR OU NÃO PERDOAR?
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/65">
          Cada julgamento representa uma nova oportunidade de avaliar os prisioneiros. A decisão
          cabe a você.
        </p>

        <Link
          href={primaryHref}
          className="mt-8 inline-flex min-h-13 items-center justify-center gap-6 border border-accent bg-accent px-8 py-4 text-xs font-black tracking-[0.15em] text-white uppercase transition-colors hover:bg-accent-2"
        >
          {primaryLabel}

          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
