interface ResultBarProps {
  label: string;
  count: number;
  percent: number;
  tone: "forgive" | "not-forgive";
}

export function ResultBar({ label, count, percent, tone }: ResultBarProps) {
  const barClass = tone === "forgive" ? "bg-white" : "bg-accent";
  const textClass = tone === "forgive" ? "text-white" : "text-accent-fg";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-bold tracking-wider text-white/70 uppercase">{label}</span>
        <span className={`font-bold ${textClass}`}>
          {count} votos · {percent}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden bg-white/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent}% dos votos`}
      >
        <div className={`h-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
