interface ResultSplitBarProps {
  forgiveCount: number;
  forgivePercent: number;
  notForgiveCount: number;
  notForgivePercent: number;
}

/**
 * Exibe as porcentagens recebidas do cálculo oficial, sem acrescentar
 * casas decimais artificiais (por exemplo, 67 em vez de 67,00%).
 */
function formatPercent(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  return `${safeValue.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

export function ResultSplitBar({
  forgiveCount,
  forgivePercent,
  notForgiveCount,
  notForgivePercent,
}: ResultSplitBarProps) {
  const total = forgiveCount + notForgiveCount;

  const forgiveLabel = formatPercent(forgivePercent);
  const notForgiveLabel = formatPercent(notForgivePercent);

  // A geometria considera a proporção real dos votos, mesmo quando
  // calculateResultStats arredonda um lado para 0% ou 100%.
  // Os valores exibidos permanecem os recebidos do cálculo oficial.
  const forgiveWidth = total > 0 ? (forgiveCount / total) * 100 : 0;
  const notForgiveWidth = total > 0 ? 100 - forgiveWidth : 0;

  const forgiveVotes = forgiveCount.toLocaleString("pt-BR");
  const notForgiveVotes = notForgiveCount.toLocaleString("pt-BR");
  const totalVotes = total.toLocaleString("pt-BR");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Uma só barra: o comprimento de cada cor representa os votos reais. */}
      <div
        role="img"
        aria-label={`Resultado da votação: Perdoar ${forgiveLabel} (${forgiveVotes} ${forgiveCount === 1 ? "voto" : "votos"}) e Não perdoar ${notForgiveLabel} (${notForgiveVotes} ${notForgiveCount === 1 ? "voto" : "votos"}).`}
        className="flex h-18 w-full min-w-0 overflow-hidden border border-white/15 bg-black"
      >
        <div
          className="@container flex h-full min-w-0 shrink-0 items-center justify-center bg-[#32555a]"
          style={{ width: `${forgiveWidth}%` }}
        >
          {/* A legenda interna só aparece quando ESTE segmento tem espaço. */}
          {forgiveCount > 0 && (
            <div
              aria-hidden="true"
              className="hidden w-full flex-col items-center justify-center gap-0.5 px-2 text-center text-white @min-[120px]:flex"
            >
              <span className="text-lg leading-none font-bold sm:text-xl">赦す</span>
              <span className="text-sm leading-tight font-black tabular-nums sm:text-base">
                {forgiveLabel}
              </span>
            </div>
          )}
        </div>

        <div
          className="@container flex h-full min-w-0 shrink-0 items-center justify-center bg-[#ea1016]"
          style={{ width: `${notForgiveWidth}%` }}
        >
          {notForgiveCount > 0 && (
            <div
              aria-hidden="true"
              className="hidden w-full flex-col items-center justify-center gap-0.5 px-2 text-center text-white @min-[150px]:flex"
            >
              <span className="text-lg leading-none font-bold sm:text-xl">赦さない</span>
              <span className="text-sm leading-tight font-black tabular-nums sm:text-base">
                {notForgiveLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Abaixo da barra, todas as informações permanecem visíveis,
          inclusive quando um segmento mede menos de 1% da largura. */}
      <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="flex min-w-0 items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 bg-[#32555a]" />
          <div className="min-w-0">
            <p className="font-bold tracking-wide text-white uppercase">Perdoar</p>
            <p className="mt-1 text-white/75 tabular-nums">
              {forgiveLabel} · {forgiveVotes} {forgiveCount === 1 ? "voto" : "votos"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start justify-end gap-2 text-right">
          <div className="min-w-0">
            <p className="font-bold tracking-wide text-white uppercase">Não perdoar</p>
            <p className="mt-1 text-white/75 tabular-nums">
              {notForgiveLabel} · {notForgiveVotes} {notForgiveCount === 1 ? "voto" : "votos"}
            </p>
          </div>
          <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 bg-[#ea1016]" />
        </div>

        <p className="col-span-2 border-t border-white/10 pt-2 text-center text-[11px] text-white/60 tabular-nums">
          {totalVotes} {total === 1 ? "voto total" : "votos totais"}
        </p>
      </div>
    </div>
  );
}
