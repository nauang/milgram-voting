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
  { kind: "init"; number: number } | { kind: "close"; number: number; startNext: boolean };

interface ActionCopy {
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
}

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

  const controls = getSeasonControls(seasons);
  const copy = pendingAction ? describeAction(pendingAction) : null;

  const runAction = async (action: PendingAction) => {
    setError(null);
    setStatusMessage(null);
    setIsPending(true);

    const path =
      action.kind === "init" ? "/api/admin/season/init" : "/api/admin/season/closeVoting";
    const body =
      action.kind === "init"
        ? { number: action.number, confirm: true }
        : { number: action.number, confirm: true, startNext: action.startNext };

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const { startableSeason, closableSeason, isFinished } = controls;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {startableSeason !== null && (
          <button
            type="button"
            onClick={() => setPendingAction({ kind: "init", number: startableSeason })}
            disabled={isPending}
            className="border border-white px-4 py-2 text-sm font-bold tracking-wider uppercase hover:bg-white hover:text-black disabled:opacity-50"
          >
            Iniciar T{startableSeason}
          </button>
        )}

        {closableSeason && closableSeason.canStartNext && (
          <button
            type="button"
            onClick={() =>
              setPendingAction({ kind: "close", number: closableSeason.number, startNext: true })
            }
            disabled={isPending}
            className="border border-accent bg-accent px-4 py-2 text-sm font-bold tracking-wider text-white uppercase hover:bg-accent-2 disabled:opacity-50"
          >
            Encerrar T{closableSeason.number} e iniciar T{closableSeason.number + 1}
          </button>
        )}

        {closableSeason && (
          <button
            type="button"
            onClick={() =>
              setPendingAction({ kind: "close", number: closableSeason.number, startNext: false })
            }
            disabled={isPending}
            className={
              closableSeason.number >= TOTAL_SEASONS
                ? "border border-accent bg-accent px-4 py-2 text-sm font-bold tracking-wider text-white uppercase hover:bg-accent-2 disabled:opacity-50"
                : "border border-accent px-4 py-2 text-sm font-bold tracking-wider text-white uppercase hover:bg-accent disabled:opacity-50"
            }
          >
            {closableSeason.number >= TOTAL_SEASONS
              ? `Encerrar T${closableSeason.number} (final)`
              : `Encerrar T${closableSeason.number} e aguardar`}
          </button>
        )}

        {isFinished && (
          <p className="text-sm text-white/60">
            Julgamento finalizado: todas as temporadas foram encerradas.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-accent-fg">
          {error}
        </p>
      )}
      {statusMessage && (
        <p role="status" className="text-sm text-white/80">
          {statusMessage}
        </p>
      )}

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
