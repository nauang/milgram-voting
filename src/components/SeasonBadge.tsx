interface SeasonBadgeProps {
  current: number;
  total: number;
}

export function SeasonBadge({ current, total }: SeasonBadgeProps) {
  return (
    <span className="inline-block border border-accent px-4 py-1 text-sm font-bold tracking-[0.15em]">
      TRIAL {current} / {total}
    </span>
  );
}
