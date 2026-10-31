"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PrisonerCard } from "./PrisonerCard";
import { Modal, type ModalStatus } from "./Modal";

import type { JudgePrisoner, VoteChoice } from "@/types/domain";

interface JudgeGridProps {
  initialPrisoners: JudgePrisoner[];
  seasonNumber: number;
}

interface LocalVotes {
  source: JudgePrisoner[];
  seasonNumber: number;
  ids: number[];
}

interface ModalSelection {
  id: number;
  source: JudgePrisoner[];
  seasonNumber: number;
}

/**
 * A lista recebida do servidor continua sendo a fonte de verdade.
 * Os votos locais são aplicados apenas enquanto as propriedades originais
 * da temporada permanecerem iguais. Assim, um router.refresh() pode
 * atualizar estados, retratos e resultados sem manter dados antigos.
 */
export function JudgeGrid({ initialPrisoners, seasonNumber }: JudgeGridProps) {
  const [localVotes, setLocalVotes] = useState<LocalVotes | null>(null);
  const [selection, setSelection] = useState<ModalSelection | null>(null);
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      requestControllerRef.current?.abort();
    };
  }, [clearCloseTimer]);

  const localVotedIds =
    localVotes?.source === initialPrisoners && localVotes.seasonNumber === seasonNumber
      ? localVotes.ids
      : [];

  const prisoners = initialPrisoners.map((prisoner) => {
    if (prisoner.state === "voting" && localVotedIds.includes(prisoner.id)) {
      return { ...prisoner, state: "voted" as const };
    }

    return prisoner;
  });

  // Se o servidor enviar uma nova lista ou temporada, uma seleção antiga
  // não pode continuar autorizando a votação com dados desatualizados.
  const selectedId =
    selection?.source === initialPrisoners && selection.seasonNumber === seasonNumber
      ? selection.id
      : null;

  const selectedPrisoner = prisoners.find((prisoner) => prisoner.id === selectedId) ?? null;

  const closeModal = useCallback(() => {
    // A solicitação em andamento não pode ser interrompida pela interface.
    if (isSubmittingRef.current) return;

    clearCloseTimer();
    setSelection(null);
    setStatus("idle");
    setErrorMessage(undefined);
  }, [clearCloseTimer]);

  const openModal = (id: number) => {
    if (isSubmittingRef.current) return;

    const prisoner = prisoners.find((item) => item.id === id);
    if (!prisoner || (prisoner.state !== "voting" && prisoner.state !== "voted")) {
      return;
    }

    clearCloseTimer();
    setSelection({ id, source: initialPrisoners, seasonNumber });
    setStatus(prisoner.state === "voted" ? "success" : "idle");
    setErrorMessage(undefined);
  };

  const markAsVoted = (id: number) => {
    setLocalVotes((previous) => {
      const existingIds =
        previous?.source === initialPrisoners && previous.seasonNumber === seasonNumber
          ? previous.ids
          : [];

      return {
        source: initialPrisoners,
        seasonNumber,
        ids: existingIds.includes(id) ? existingIds : [...existingIds, id],
      };
    });

    setStatus("success");
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      closeModal();
    }, 1500);
  };

  const handleVote = async (choice: VoteChoice) => {
    if (
      isSubmittingRef.current ||
      selectedPrisoner === null ||
      selectedPrisoner.state !== "voting"
    ) {
      return;
    }

    // Captura o ID antes da chamada assíncrona para evitar que uma
    // eventual atualização de interface altere o destino do voto.
    const prisonerId = selectedPrisoner.id;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    isSubmittingRef.current = true;

    clearCloseTimer();
    setStatus("submitting");
    setErrorMessage(undefined);

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prisonerId, choice }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const errorData =
          typeof data === "object" && data !== null && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : null;

        // Um 409 só representa voto prévio quando a API o identifica
        // explicitamente. Não apresentamos outros conflitos como sucesso.
        if (response.status === 409 && errorData?.code === "ALREADY_VOTED") {
          markAsVoted(prisonerId);
          return;
        }

        setStatus("error");
        setErrorMessage(
          typeof errorData?.error === "string" && errorData.error.trim()
            ? errorData.error
            : "Erro ao votar. Tente novamente.",
        );
        return;
      }

      markAsVoted(prisonerId);
    } catch {
      if (controller.signal.aborted) return;

      setStatus("error");
      setErrorMessage("Erro de rede. Tente novamente.");
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      isSubmittingRef.current = false;
    }
  };

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {prisoners.map((prisoner, index) => (
          <li key={prisoner.id}>
            <PrisonerCard
              prisoner={prisoner}
              seasonNumber={seasonNumber}
              onSelect={openModal}
              priority={index < 2}
            />
          </li>
        ))}
      </ul>

      <Modal
        prisoner={selectedPrisoner}
        isOpen={selectedPrisoner !== null}
        status={status}
        errorMessage={errorMessage}
        onClose={closeModal}
        onVote={handleVote}
      />
    </>
  );
}
