"use client";

import type { VoteChoice } from "@/types/domain";

interface VoteDiamondProps {
  choice: VoteChoice;
  disabled: boolean;
  onClick: (choice: VoteChoice) => void;
}

export function VoteDiamond({ choice, disabled, onClick }: VoteDiamondProps) {
  const isForgive = choice === "forgive";
  const label = isForgive ? "赦す / Perdoar" : "赦さない / Não perdoar";
  const borderColor = isForgive ? "border-white" : "border-[#E4007F]";
  const textColor = isForgive ? "text-white" : "text-[#E4007F]";

  return (
    <button
      type="button"
      onClick={() => onClick(choice)}
      disabled={disabled}
      aria-label={label}
      className={`group flex flex-col items-center justify-center gap-4 transition-all focus-visible:outline-none disabled:opacity-50`}
    >
      <div
        className={`flex h-24 w-24 rotate-45 items-center justify-center border-2 ${borderColor} bg-black/50 transition-all group-hover:scale-110 group-hover:bg-[#E4007F]/20 group-focus-visible:ring-4 group-focus-visible:ring-[#E4007F]/50`}
      >
        <span className={`-rotate-45 text-xl font-bold ${textColor}`}>
          {isForgive ? "赦す" : "赦さない"}
        </span>
      </div>
      <span className="text-sm font-bold tracking-widest text-white/70">
        {isForgive ? "Perdoar" : "Não perdoar"}
      </span>
    </button>
  );
}
