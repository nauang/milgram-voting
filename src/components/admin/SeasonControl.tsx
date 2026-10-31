"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

import { TOTAL_SEASONS } from "@/lib/constants";
import type { SeasonRow } from "@/lib/season";
import { getSeasonControls } from "@/lib/season-controls";

interface SeasonControlProps {
  seasons: SeasonRow[];
}

type PendingAction =
  | {
      kind: "init";
      number: number;
    }
  | {
      kind: "close";
      number: number;
      startNext: boolean;
    };

interface ActionCopy {
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
}

/**
 * Textos de confirmação das operações.
 *
 * Mantém as mensagens e as consequências
 * descritas pelo componente original.
 */
function describeAction(action: PendingAction): ActionCopy {
  if (action.kind === "init") {
    return {
      title: `Iniciar a Temporada ${action.number}?`,
      description:
        "A votação será aberta para todos os visitantes e as imagens dos prisioneiros passarão a ser as desta temporada.",
      confirmLabel: `Iniciar T${action.number}`,
      successMessage: `Temporada ${action.number} iniciada.`,
    };
  }

  const isFinalSeason = action.number >= TOTAL_SEASONS;

  if (isFinalSeason) {
    return {
      title: `Encerrar a Temporada ${action.number} e finalizar o julgamento?`,
      description:
        "Os votos serão apurados agora e o julgamento terminará. Esta ação não pode ser desfeita.",
      confirmLabel: "Encerrar e finalizar",
      successMessage: `Temporada ${action.number} encerrada. Julgamento finalizado.`,
    };
  }

  if (action.startNext) {
    return {
      title: `Encerrar a Temporada ${action.number} e iniciar a ${action.number + 1}?`,
      description:
        "Os votos serão apurados agora e a próxima temporada abrirá em seguida, trocando as imagens dos prisioneiros. Esta ação não pode ser desfeita.",
      confirmLabel: `Encerrar e iniciar T${action.number + 1}`,
      successMessage: `Temporada ${action.number} encerrada. Temporada ${action.number + 1} iniciada.`,
    };
  }

  return {
    title: `Encerrar a Temporada ${action.number} e aguardar?`,
    description:
      "Os votos serão apurados agora, mas a próxima temporada só começará quando você iniciá-la. Até lá, os veredictos aparecem na página de julgamento. Esta ação não pode ser desfeita.",
    confirmLabel: "Encerrar e aguardar",
    successMessage: `Temporada ${action.number} encerrada. Inicie a próxima quando quiser.`,
  };
}

/**
 * Extrai as mensagens de erro da API.
 *
 * Mantém a interpretação original
 * das respostas JSON.
 */
function readErrorMessage(data: unknown): string | null {
  if (typeof data === "object" && data !== null && "error" in data) {
    return typeof data.error === "string" ? data.error : null;
  }

  return null;
}

export function SeasonControl({ seasons }: SeasonControlProps) {
  const router = useRouter();

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [isPending, setIsPending] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  /**
   * Todas as permissões de ação continuam
   * sendo determinadas pela função
   * getSeasonControls.
   */
  const controls = getSeasonControls(seasons);

  const copy = pendingAction ? describeAction(pendingAction) : null;

  const { startableSeason, closableSeason, isFinished } = controls;

  const hasAvailableActions = startableSeason !== null || closableSeason !== null;

  /**
   * Mantém o envio para os mesmos endpoints:
   *
   * POST /api/admin/season/init
   * POST /api/admin/season/closeVoting
   *
   * As operações continuam exigindo a
   * confirmação pelo ConfirmDialog.
   */
  const runAction = async (action: PendingAction) => {
    setError(null);
    setStatusMessage(null);
    setIsPending(true);

    const path =
      action.kind === "init" ? "/api/admin/season/init" : "/api/admin/season/closeVoting";

    const body =
      action.kind === "init"
        ? {
            number: action.number,
            confirm: true,
          }
        : {
            number: action.number,
            confirm: true,
            startNext: action.startNext,
          };

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(readErrorMessage(data) ?? `Erro ao executar a ação (HTTP ${response.status}).`);

        return;
      }

      setStatusMessage(describeAction(action).successMessage);

      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setIsPending(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* ======================================
          CABEÇALHO DOS COMANDOS
          ====================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 border-2 border-accent" />

          <p className="font-mono text-[10px] font-black tracking-[0.14em] text-accent-fg uppercase">
            MILGRAM / SYSTEM COMMANDS
          </p>
        </div>

        <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">
          TRIAL CONTROL
        </span>
      </div>

      {/* ======================================
          AÇÕES DISPONÍVEIS
          ====================================== */}

      {hasAvailableActions && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* ==============================
              INICIAR TEMPORADA
              ============================== */}

          {startableSeason !== null && (
            <section className="relative flex min-w-0 flex-col overflow-hidden border border-[#32555a] bg-[#162124]">
              {/* Fundo geométrico */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rotate-45 border-[15px] border-[#8ebdc4]/10"
              />

              <div className="relative flex flex-1 flex-col p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-black tracking-[0.12em] text-[#a4d0d6] uppercase">
                    COMMAND / INIT
                  </p>

                  <span aria-hidden="true" className="font-mono text-xs font-black text-[#8ebdc4]">
                    01
                  </span>
                </div>

                <p className="milgram-display text-2xl leading-tight text-white sm:text-3xl">
                  INICIAR TEMPORADA
                </p>

                <p className="mt-3 font-mono text-xs font-bold tracking-[0.12em] text-[#a4d0d6] uppercase">
                  TRIAL {String(startableSeason).padStart(2, "0")}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-white/65">
                  Abre a votação para os visitantes e ativa as imagens correspondentes à temporada.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setPendingAction({
                      kind: "init",
                      number: startableSeason,
                    })
                  }
                  disabled={isPending}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-between gap-3 border border-[#8ebdc4] bg-[#32555a] px-4 py-3 text-left text-xs font-black tracking-[0.1em] text-white uppercase transition-colors hover:border-[#c8e5e9] hover:bg-[#436b71] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8e5e9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>INICIAR T{startableSeason}</span>

                  <span aria-hidden="true" className="text-lg leading-none">
                    →
                  </span>
                </button>
              </div>

              <div aria-hidden="true" className="h-[3px] bg-[#8ebdc4]" />
            </section>
          )}

          {/* ==============================
              ENCERRAR E INICIAR A PRÓXIMA
              ============================== */}

          {closableSeason && closableSeason.canStartNext && (
            <section className="relative flex min-w-0 flex-col overflow-hidden border border-accent/60 bg-[#281719]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rotate-45 border-[15px] border-accent/10"
              />

              <div className="relative flex flex-1 flex-col p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-black tracking-[0.12em] text-accent-fg uppercase">
                    COMMAND / NEXT TRIAL
                  </p>

                  <span aria-hidden="true" className="font-mono text-xs font-black text-accent-fg">
                    02
                  </span>
                </div>

                <p className="milgram-display text-2xl leading-tight text-white sm:text-3xl">
                  PRÓXIMO JULGAMENTO
                </p>

                <p className="mt-3 font-mono text-xs font-bold tracking-[0.12em] text-accent-fg uppercase">
                  TRIAL {String(closableSeason.number).padStart(2, "0")}
                  {" → "}
                  {String(closableSeason.number + 1).padStart(2, "0")}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-white/65">
                  Encerra o julgamento atual, apura seus votos e abre imediatamente a próxima
                  temporada.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setPendingAction({
                      kind: "close",
                      number: closableSeason.number,
                      startNext: true,
                    })
                  }
                  disabled={isPending}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-between gap-3 border border-accent bg-accent px-4 py-3 text-left text-xs font-black tracking-[0.1em] text-white uppercase transition-colors hover:bg-[#bc1016] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    ENCERRAR T{closableSeason.number}
                    {" E INICIAR T"}
                    {closableSeason.number + 1}
                  </span>

                  <span aria-hidden="true" className="text-lg leading-none">
                    →
                  </span>
                </button>
              </div>

              <div aria-hidden="true" className="h-[3px] bg-accent" />
            </section>
          )}

          {/* ==============================
              ENCERRAR E AGUARDAR
              OU FINALIZAR JULGAMENTO
              ============================== */}

          {closableSeason && (
            <section className="relative flex min-w-0 flex-col overflow-hidden border border-accent/50 bg-[#1c1919]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rotate-45 border-[15px] border-accent/10"
              />

              <div className="relative flex flex-1 flex-col p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-black tracking-[0.12em] text-accent-fg uppercase">
                    COMMAND / CLOSE
                  </p>

                  <span aria-hidden="true" className="font-mono text-xs font-black text-accent-fg">
                    03
                  </span>
                </div>

                <p className="milgram-display text-2xl leading-tight text-white sm:text-3xl">
                  {closableSeason.number >= TOTAL_SEASONS
                    ? "FINALIZAR JULGAMENTO"
                    : "ENCERRAR TEMPORADA"}
                </p>

                <p className="mt-3 font-mono text-xs font-bold tracking-[0.12em] text-accent-fg uppercase">
                  TRIAL {String(closableSeason.number).padStart(2, "0")}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-white/65">
                  {closableSeason.number >= TOTAL_SEASONS
                    ? "Apura os votos da última temporada e finaliza o julgamento."
                    : "Apura os votos da temporada atual e mantém a próxima aguardando uma abertura manual."}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setPendingAction({
                      kind: "close",
                      number: closableSeason.number,
                      startNext: false,
                    })
                  }
                  disabled={isPending}
                  className={`mt-6 inline-flex min-h-12 w-full items-center justify-between gap-3 border px-4 py-3 text-left text-xs font-black tracking-[0.1em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg disabled:cursor-not-allowed disabled:opacity-50 ${
                    closableSeason.number >= TOTAL_SEASONS
                      ? "border-accent bg-accent text-white hover:bg-[#bc1016]"
                      : "border-accent bg-accent/10 text-white hover:bg-accent"
                  }`}
                >
                  <span>
                    {closableSeason.number >= TOTAL_SEASONS
                      ? `ENCERRAR T${closableSeason.number} (FINAL)`
                      : `ENCERRAR T${closableSeason.number} E AGUARDAR`}
                  </span>

                  <span aria-hidden="true" className="text-lg leading-none">
                    →
                  </span>
                </button>
              </div>

              <div aria-hidden="true" className="h-[3px] bg-accent/60" />
            </section>
          )}
        </div>
      )}

      {/* ======================================
          JULGAMENTO FINALIZADO
          ====================================== */}

      {isFinished && (
        <div className="flex items-start gap-4 border border-[#8ebdc4]/50 bg-[#32555a]/15 p-5">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#8ebdc4] bg-[#32555a]/30 text-xl font-black text-[#c8e5e9]"
          >
            ✓
          </span>

          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold tracking-[0.13em] text-[#a4d0d6] uppercase">
              JUDGEMENT COMPLETE
            </p>

            <p className="mt-2 text-base font-black text-white">Julgamento finalizado</p>

            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Todas as temporadas foram encerradas. Nenhuma nova temporada pode ser iniciada pelos
              controles convencionais.
            </p>
          </div>
        </div>
      )}

      {/* ======================================
          SEM AÇÕES DISPONÍVEIS
          ====================================== */}

      {!hasAvailableActions && !isFinished && (
        <div className="border-l-[3px] border-white/25 bg-black/25 p-5">
          <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
            NO AVAILABLE COMMANDS
          </p>

          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Nenhuma operação de temporada está disponível no estado atual do sistema.
          </p>
        </div>
      )}

      {/* ======================================
          ERROS DA API
          ====================================== */}

      {error && (
        <div role="alert" className="border-l-[3px] border-accent bg-accent/10 p-5">
          <p className="font-mono text-[10px] font-black tracking-[0.13em] text-accent-fg uppercase">
            SYSTEM ERROR
          </p>

          <p className="mt-2 text-sm leading-relaxed text-white/85">{error}</p>
        </div>
      )}

      {/* ======================================
          CONFIRMAÇÃO DE SUCESSO
          ====================================== */}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="border-l-[3px] border-[#8ebdc4] bg-[#32555a]/15 p-5"
        >
          <p className="font-mono text-[10px] font-black tracking-[0.13em] text-[#a4d0d6] uppercase">
            COMMAND EXECUTED
          </p>

          <p className="mt-2 text-sm leading-relaxed font-bold text-white">{statusMessage}</p>
        </div>
      )}

      {/* ======================================
          OBSERVAÇÃO DE SEGURANÇA
          ====================================== */}

      {hasAvailableActions && (
        <div className="flex items-start gap-3 border-t border-white/10 pt-4">
          <span aria-hidden="true" className="mt-0.5 text-sm font-black text-accent-fg">
            !
          </span>

          <p className="text-xs leading-relaxed text-white/55">
            As operações de temporada exigem confirmação antes da execução. O encerramento apura os
            votos registrados e não pode ser desfeito pelos controles comuns.
          </p>
        </div>
      )}

      {/* ======================================
          MODAL DE CONFIRMAÇÃO
          ====================================== */}

      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={copy?.title ?? ""}
        description={copy?.description ?? ""}
        confirmLabel={copy?.confirmLabel ?? ""}
        isPending={isPending}
        onConfirm={() => {
          if (pendingAction) {
            void runAction(pendingAction);
          }
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
