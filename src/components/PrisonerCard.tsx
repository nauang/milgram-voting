"use client";

import Image from "next/image";
import Link from "next/link";

import type { JudgePrisoner, PrisonerState } from "@/types/domain";

import { formatPrisonerNumber, getPrisonerDisplayName } from "@/utils/format";

interface PrisonerCardProps {
  prisoner: JudgePrisoner;
  seasonNumber: number;
  /** Abre o modal de votação ou de voto já registrado. */
  onSelect?: (prisonerId: number) => void;
  /** Carregamento prioritário da imagem. */
  priority?: boolean;
}

/**
 * Apresentação dos estados de julgamento.
 *
 * Todos os estados são identificados por
 * texto, símbolo e aparência visual.
 *
 * Nenhuma identificação depende apenas da cor.
 */
const STATE_PRESENTATION: Record<
  PrisonerState,
  {
    label: string;
    icon: string;
    badgeClass: string;
    borderClass: string;
    imageClass: string;
    stripeClass: string;
  }
> = {
  voting: {
    label: "Pode votar",
    icon: "◇",
    badgeClass: "border-white/80 bg-[#101010]/95 text-white",
    borderClass: "border-white/40",
    imageClass: "",
    stripeClass: "bg-white",
  },

  voted: {
    label: "Voto registrado",
    icon: "✓",
    badgeClass: "border-accent bg-accent text-white",
    borderClass: "border-accent",
    imageClass: "brightness-75",
    stripeClass: "bg-accent",
  },

  not_guilty: {
    label: "Inocente",
    icon: "○",
    badgeClass: "border-white bg-white text-black",
    borderClass: "border-white",
    imageClass: "",
    stripeClass: "bg-white",
  },

  guilty: {
    label: "Culpado",
    icon: "✕",
    badgeClass: "border-accent bg-accent text-white",
    borderClass: "border-accent",
    imageClass: "",
    stripeClass: "bg-accent",
  },

  idle: {
    label: "Votação em breve",
    icon: "…",
    badgeClass: "border-white/40 bg-[#101010]/95 text-white/80",
    borderClass: "border-white/20",
    imageClass: "opacity-60",
    stripeClass: "bg-white/20",
  },
};

/**
 * Expande a área clicável do botão ou link
 * para todo o cartão.
 *
 * Não cria elementos interativos aninhados.
 */
const STRETCHED_CLICK_AREA =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";

/**
 * Enquadramento das ilustrações.
 *
 * Preserva os ajustes já utilizados:
 *
 * Temporada 2:
 * - Yuno utiliza object-cover object-top.
 *
 * Temporada 3:
 * - Futa utiliza object-cover object-top.
 * - Amane utiliza object-cover object-top.
 *
 * Os demais personagens utilizam
 * object-contain object-center.
 *
 * Nenhum arquivo do Supabase é modificado.
 */
function getCardImageClass(slug: string, seasonNumber: number): string {
  const needsFullHeight =
    (seasonNumber === 2 && slug === "yuno") ||
    (seasonNumber === 3 && (slug === "futa" || slug === "amane"));

  if (needsFullHeight) {
    return "object-cover object-top";
  }

  return "object-contain object-center";
}

export function PrisonerCard({
  prisoner,
  seasonNumber,
  onSelect,
  priority = false,
}: PrisonerCardProps) {
  const { id, number, slug, nickname, fullName, imageUrl, state } = prisoner;

  const presentation = STATE_PRESENTATION[state];

  const numberLabel = formatPrisonerNumber(number);

  const statusId = `status-${slug}`;

  const imageAlt =
    `Retrato de ${getPrisonerDisplayName(slug)}, ` + `${numberLabel}, temporada ${seasonNumber}`;

  const imageFrameClass = getCardImageClass(slug, seasonNumber);

  const trialNumber = String(seasonNumber).padStart(2, "0");

  const prisonerNumber = String(number).padStart(2, "0");

  /**
   * Mantém o comportamento original:
   *
   * voting -> abre o modal de votação;
   * voted -> abre o modal de voto registrado;
   * resultados -> direciona para /judge/result;
   * idle -> não permite interação.
   */
  const isVotable = onSelect !== undefined && (state === "voting" || state === "voted");

  const isResultLink = state === "not_guilty" || state === "guilty";

  const isInteractive = isVotable || isResultLink;

  let heading;

  if (isVotable) {
    heading = (
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-describedby={statusId}
        className={`text-left transition-colors hover:text-accent-fg ${STRETCHED_CLICK_AREA}`}
      >
        {nickname}
      </button>
    );
  } else if (isResultLink) {
    heading = (
      <Link
        href={`/judge/result/${seasonNumber}`}
        aria-describedby={statusId}
        className={`transition-colors hover:text-accent-fg ${STRETCHED_CLICK_AREA}`}
      >
        {nickname}
      </Link>
    );
  } else {
    heading = <span>{nickname}</span>;
  }

  const interactiveClass = isInteractive
    ? "motion-safe:hover:-translate-y-1 hover:border-accent/80 motion-safe:hover:shadow-[0_12px_32px_rgba(234,16,22,0.18)]"
    : "";

  return (
    <article
      className={`group relative isolate flex h-full flex-col overflow-hidden border bg-card transition-[transform,border-color,box-shadow] duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${presentation.borderClass} ${interactiveClass}`}
    >
      {/* ==========================================
          RETRATO DO PRISIONEIRO
          ========================================== */}

      <figure className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-[#0c0c0c]">
        {/* Numeração decorativa ao fundo */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-8 right-1 font-mono text-[clamp(3.5rem,9vw,6rem)] leading-none font-black tracking-tighter text-white/5"
        >
          {prisonerNumber}
        </span>

        {/* Geometria decorativa */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -bottom-16 h-36 w-36 rotate-45 border-[16px] border-accent/10"
        />

        {/* Imagem original */}
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(min-width: 960px) 20vw, (min-width: 560px) 33vw, 50vw"
            className={`${imageFrameClass} ${presentation.imageClass}`}
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-black px-2 text-center text-xs text-white/70">
            Sem imagem
          </div>
        )}

        {/* Indicador do estado */}
        <p
          id={statusId}
          className={`absolute top-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 border px-2 py-1.5 text-[10px] leading-tight font-black tracking-[0.05em] uppercase ${presentation.badgeClass}`}
        >
          <span aria-hidden="true" className="shrink-0 text-xs">
            {presentation.icon}
          </span>

          <span>{presentation.label}</span>
        </p>

        {/* Canto geométrico superior direito */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-accent/80"
        />

        {/* Gradiente de leitura */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/95 via-black/55 to-transparent"
        />

        {/* Identificação do arquivo */}
        <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pt-8 pb-3">
          <div>
            <p className="mb-1 font-mono text-[9px] font-bold tracking-[0.16em] text-white/60 uppercase">
              PRISONER
            </p>

            <p className="font-mono text-xl leading-none font-black tracking-[0.03em] text-accent-fg sm:text-2xl">
              {numberLabel}
            </p>
          </div>

          <span
            aria-hidden="true"
            className="font-mono text-[9px] font-bold tracking-[0.08em] text-white/50"
          >
            T-{trialNumber}
          </span>
        </figcaption>
      </figure>

      {/* ==========================================
          IDENTIFICAÇÃO DO PRISIONEIRO
          ========================================== */}

      <div className="relative flex flex-1 flex-col border-t border-white/15 bg-[#1c1c1c] px-3 pt-3 pb-4">
        {/* Referência da ficha */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] font-bold tracking-[0.12em] text-accent-fg uppercase">
            FILE / {prisonerNumber}
          </span>

          <span className="font-mono text-[9px] font-bold tracking-[0.08em] text-white/40">
            MILGRAM
          </span>
        </div>

        {/* Nome */}
        <h3 className="text-base leading-snug font-black tracking-wide text-white sm:text-lg">
          {heading}
        </h3>

        {/* Nome completo */}
        <p className="mt-1 text-xs leading-relaxed text-white/65">{fullName}</p>

        {/* Elemento decorativo inferior */}
        <div aria-hidden="true" className="mt-auto flex items-center gap-2 pt-4">
          <span className={`h-[3px] w-10 ${presentation.stripeClass}`} />

          <span className="h-px flex-1 bg-white/10" />

          <span className="h-1.5 w-1.5 rotate-45 border border-accent/70" />
        </div>
      </div>
    </article>
  );
}