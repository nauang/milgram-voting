"use client";

import type { VoteChoice } from "@/types/domain";

interface VoteDiamondProps {
  choice: VoteChoice;
  disabled: boolean;
  onClick: (choice: VoteChoice) => void;
}

/**
 * MILGRAM Voting — Botões de veredito.
 *
 * Identidade visual:
 *
 * Inocentar:
 * - Azul-petróleo inspirado nos resultados
 *   do MILGRAM oficial.
 *
 * Culpar:
 * - Vermelho MILGRAM (#EA1016).
 *
 * Os diamantes são compactos para funcionar
 * dentro das duas áreas do novo modal.
 *
 * Mantém:
 * - Os valores originais de VoteChoice;
 * - A callback onClick;
 * - O estado disabled;
 * - A identificação acessível;
 * - Os caracteres japoneses originais.
 */

const VOTE_PRESENTATION = {
  forgive: {
    label: "Inocentar",
    kanji: "赦す",
    labelAria: "Inocentar este prisioneiro",

    borderClass: "border-[#8ebdc4]",
    backgroundClass: "bg-[#172c30]",
    textClass: "text-[#c8e5e9]",

    hoverBackground: "group-hover:bg-[#32555a] group-focus-visible:bg-[#32555a]",

    hoverBorder: "group-hover:border-[#b1d8de] group-focus-visible:border-[#b1d8de]",

    hoverText: "group-hover:text-white group-focus-visible:text-white",

    glow: "group-hover:shadow-[0_0_24px_rgba(100,167,175,0.35)]",

    focusClass: "focus-visible:outline-[#a4d0d6]",

    detailClass: "bg-[#a4d0d6]",
  },

  not_forgive: {
    label: "Culpar",
    kanji: "赦さない",
    labelAria: "Culpar este prisioneiro",

    borderClass: "border-accent",
    backgroundClass: "bg-[#301315]",
    textClass: "text-accent-fg",

    hoverBackground: "group-hover:bg-accent group-focus-visible:bg-accent",

    hoverBorder: "group-hover:border-[#ff8589] group-focus-visible:border-[#ff8589]",

    hoverText: "group-hover:text-white group-focus-visible:text-white",

    glow: "group-hover:shadow-[0_0_24px_rgba(234,16,22,0.4)]",

    focusClass: "focus-visible:outline-accent-fg",

    detailClass: "bg-accent",
  },
} as const;

export function VoteDiamond({ choice, disabled, onClick }: VoteDiamondProps) {
  const presentation = VOTE_PRESENTATION[choice];

  return (
    <button
      type="button"
      onClick={() => onClick(choice)}
      disabled={disabled}
      aria-label={presentation.labelAria}
      className={`group flex w-full min-w-0 flex-col items-center justify-center gap-4 px-1 py-5 text-center transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${presentation.focusClass}`}
    >
      {/* ======================================
          DIAMANTE
          ====================================== */}

      <span className="relative flex h-24 w-24 shrink-0 items-center justify-center sm:h-28 sm:w-28">
        {/* Forma geométrica rotacionada */}
        <span
          aria-hidden="true"
          className={`absolute h-16 w-16 rotate-45 border-2 shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 sm:h-[72px] sm:w-[72px] ${presentation.borderClass} ${presentation.backgroundClass} ${presentation.hoverBackground} ${presentation.hoverBorder} ${presentation.glow}`}
        />

        {/* Inscrição japonesa */}
        <span
          aria-hidden="true"
          lang="ja"
          className={`relative z-10 text-sm leading-none font-bold tracking-normal whitespace-nowrap transition-colors duration-200 sm:text-base ${presentation.textClass} ${presentation.hoverText}`}
        >
          {presentation.kanji}
        </span>
      </span>

      {/* ======================================
          IDENTIFICAÇÃO DO VEREDITO
          ====================================== */}

      <span className="flex flex-col items-center gap-2">
        <span className="text-center text-[10px] leading-snug font-black tracking-[0.08em] text-white uppercase transition-colors group-hover:text-white group-focus-visible:text-white sm:text-xs">
          {presentation.label}
        </span>

        {/* Detalhe geométrico */}
        <span
          aria-hidden="true"
          className={`h-[2px] w-8 opacity-70 transition-[width,opacity] duration-200 group-hover:w-12 group-hover:opacity-100 group-focus-visible:w-12 group-focus-visible:opacity-100 ${presentation.detailClass}`}
        />
      </span>
    </button>
  );
}
