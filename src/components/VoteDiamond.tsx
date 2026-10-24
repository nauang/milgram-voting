"use client";

import type { VoteChoice } from "@/types/domain";

interface VoteDiamondProps {
  choice: VoteChoice;
  disabled: boolean;
  onClick: (choice: VoteChoice) => void;
}

export function VoteDiamond({ choice, disabled, onClick }: VoteDiamondProps) {
  const isForgive = choice === "forgive";
  const label = isForgive ? "Perdoar" : "Não perdoar";
  const labelAria = `${label} este prisioneiro`;
  const kanji = isForgive ? "赦す" : "赦さない";

  const borderColor = isForgive ? "border-white" : "border-[#E4007F]";
  const textColor = isForgive ? "text-white" : "text-[#E4007F]";
  const hoverFill = isForgive
    ? "group-hover:bg-white group-focus-visible:bg-white"
    : "group-hover:bg-[#E4007F] group-focus-visible:bg-[#E4007F]";
  const hoverText = isForgive
    ? "group-hover:text-black group-focus-visible:text-black"
    : "group-hover:text-white group-focus-visible:text-white";
  const ringColor = isForgive ? "ring-white/40" : "ring-[#E4007F]/40";
  const glow = isForgive
    ? "group-hover:shadow-[0_0_24px_rgba(255,255,255,0.35)]"
    : "group-hover:shadow-[0_0_24px_rgba(228,0,127,0.5)]";

  return (
    <button
      type="button"
      onClick={() => onClick(choice)}
      disabled={disabled}
      aria-label={labelAria}
      className="group flex flex-col items-center gap-5 transition-all focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 sm:gap-6"
    >
      <div
        className={`flex h-24 w-24 rotate-45 items-center justify-center border-2 ${borderColor} bg-black/60 transition-all duration-200 ease-out ${hoverFill} ${glow} group-hover:scale-110 group-focus-visible:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#1a1a1a] ${ringColor} sm:h-32 sm:w-32`}
      >
        <span
          className={`-rotate-45 text-lg font-bold tracking-wider ${textColor} ${hoverText} transition-colors duration-200 sm:text-2xl`}
        >
          {kanji}
        </span>
      </div>

      <span className="text-[0.65rem] font-bold tracking-[0.2em] text-white/60 uppercase transition-colors group-hover:text-white group-focus-visible:text-white sm:text-xs">
        {label}
      </span>
    </button>
  );
}
