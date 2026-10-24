"use client";

import Image from "next/image";
import Link from "next/link";
import type { JudgePrisoner, PrisonerState } from "@/types/domain";
import { formatPrisonerNumber, getPrisonerDisplayName } from "@/utils/format";

interface PrisonerCardProps {
  prisoner: JudgePrisoner;
  seasonNumber: number;
  /** Abre o modal (voto ou "já votou hoje"). Sem ele, o card de votação não é clicável. */
  onSelect?: (prisonerId: number) => void;
  /** Marca como LCP (eager load). Apenas os primeiros cards do grid. */
  priority?: boolean;
}

// Nunca depender só de cor (PROMPT §8.2): todo estado tem texto + ícone + borda.
// Texto branco sobre magenta (#E4007F) dá ~4,6:1; magenta sobre o cinza do card NÃO passa.
const STATE_PRESENTATION: Record<
  PrisonerState,
  { label: string; icon: string; badgeClass: string; borderClass: string; imageClass: string }
> = {
  voting: {
    label: "Pode votar",
    icon: "◇",
    badgeClass: "border-white bg-black text-white",
    borderClass: "border-white/40",
    imageClass: "",
  },
  voted: {
    label: "Voto registrado",
    icon: "✓",
    badgeClass: "border-accent bg-accent text-white",
    borderClass: "border-accent",
    imageClass: "brightness-75",
  },
  lost: {
    label: "Empate",
    icon: "?",
    badgeClass: "border-white/60 bg-black text-white",
    borderClass: "border-white/30",
    imageClass: "grayscale",
  },
  not_guilty: {
    label: "Perdoado",
    icon: "○",
    badgeClass: "border-white bg-white text-black",
    borderClass: "border-white",
    imageClass: "",
  },
  guilty: {
    label: "Não perdoado",
    icon: "✕",
    badgeClass: "border-accent bg-accent text-white",
    borderClass: "border-accent",
    imageClass: "",
  },
  idle: {
    label: "Votação em breve",
    icon: "…",
    badgeClass: "border-white/40 bg-black text-white/80",
    borderClass: "border-white/20",
    imageClass: "opacity-60",
  },
};

// "Stretched link": o pseudo-elemento estica a área clicável por todo o card, sem colocar
// <h3>/<figure> dentro de <button> (HTML inválido no validator.w3.org).
const STRETCHED_CLICK_AREA =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";

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
  const imageAlt = `Retrato de ${getPrisonerDisplayName(slug)}, ${numberLabel}, temporada ${seasonNumber}`;

  const isVotable = onSelect !== undefined && (state === "voting" || state === "voted");
  const isResultLink = state === "lost" || state === "not_guilty" || state === "guilty";
  const isInteractive = isVotable || isResultLink;

  let heading;
  if (isVotable) {
    heading = (
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-describedby={statusId}
        className={`text-left ${STRETCHED_CLICK_AREA}`}
      >
        {nickname}
      </button>
    );
  } else if (isResultLink) {
    heading = (
      <Link
        href={`/judge/result/${seasonNumber}`}
        aria-describedby={statusId}
        className={STRETCHED_CLICK_AREA}
      >
        {nickname}
      </Link>
    );
  } else {
    heading = <span>{nickname}</span>;
  }

  // O foco aparece no card inteiro (o botão tem o outline desligado acima)
  const interactiveClass = isInteractive
    ? "motion-safe:hover:scale-[1.03] motion-safe:hover:shadow-[0_0_24px_rgba(228,0,127,0.45)]"
    : "";

  return (
    <article
      className={`relative flex flex-col border bg-card transition-shadow transition-transform duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${presentation.borderClass} ${interactiveClass}`}
    >
      <figure className="relative aspect-[3/4] w-full overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(min-width: 960px) 20vw, (min-width: 560px) 33vw, 50vw"
            className={`object-cover ${presentation.imageClass}`}
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-black text-xs text-white/70">
            Sem imagem
          </div>
        )}
        <p
          id={statusId}
          className={`absolute top-2 left-2 inline-flex items-center gap-1 border px-2 py-1 text-[0.7rem] font-bold tracking-wider uppercase ${presentation.badgeClass}`}
        >
          <span aria-hidden="true">{presentation.icon}</span>
          {presentation.label}
        </p>
        <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 to-transparent px-3 pt-8 pb-2 text-xs font-bold tracking-[0.15em]">
          {numberLabel}
        </figcaption>
      </figure>
      <div className="p-3">
        <h3 className="text-base font-bold tracking-wide">{heading}</h3>
        <p className="text-xs text-white/70">{fullName}</p>
      </div>
    </article>
  );
}
