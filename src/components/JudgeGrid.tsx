"use client";

import { useState } from "react";
import { PrisonerCard } from "./PrisonerCard";
import { Modal, type ModalStatus } from "./Modal";
import type { JudgePrisoner, VoteChoice } from "@/types/domain";

interface JudgeGridProps {
  initialPrisoners: JudgePrisoner[];
  seasonNumber: number;
}

export function JudgeGrid({ initialPrisoners, seasonNumber }: JudgeGridProps) {
  const [prisoners, setPrisoners] = useState(initialPrisoners);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const selectedPrisoner = prisoners.find((p) => p.id === selectedId) || null;

  const closeModal = () => {
    setSelectedId(null);
    setStatus("idle");
    setErrorMessage(undefined);
  };

  const handleVote = async (choice: VoteChoice) => {
    if (!selectedId) return;
    setStatus("submitting");
    setErrorMessage(undefined);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prisonerId: selectedId, choice }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          // Marca como já votado e mostra sucesso (a UI já refletiu o estado real)
          setPrisoners((prev) =>
            prev.map((p) => (p.id === selectedId ? { ...p, state: "voted" } : p)),
          );
          setStatus("success");
          setTimeout(() => closeModal(), 1500);
          return;
        }
        setStatus("error");
        setErrorMessage(err.error ?? "Erro ao votar. Tente novamente.");
        return;
      }

      setPrisoners((prev) => prev.map((p) => (p.id === selectedId ? { ...p, state: "voted" } : p)));
      setStatus("success");
      setTimeout(() => closeModal(), 1500);
    } catch {
      setStatus("error");
      setErrorMessage("Erro de rede. Tente novamente.");
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
              onSelect={(id) => {
                setSelectedId(id);
                setStatus("idle");
              }}
              priority={index < 2}
            />
          </li>
        ))}
      </ul>

      <Modal
        prisoner={selectedPrisoner}
        isOpen={selectedId !== null}
        status={status}
        errorMessage={errorMessage}
        onClose={closeModal}
        onVote={handleVote}
      />
    </>
  );
}
