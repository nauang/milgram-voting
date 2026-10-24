"use client";

import { useState } from "react";
import { PrisonerCard } from "./PrisonerCard";
import { Modal } from "./Modal";
import type { JudgePrisoner, VoteChoice } from "@/types/domain";

interface JudgeGridProps {
  initialPrisoners: JudgePrisoner[];
  seasonNumber: number;
}

export function JudgeGrid({ initialPrisoners, seasonNumber }: JudgeGridProps) {
  const [prisoners, setPrisoners] = useState(initialPrisoners);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPrisoner = prisoners.find((p) => p.id === selectedId) || null;

  const handleVote = async (choice: VoteChoice) => {
    if (!selectedId) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prisonerId: selectedId, choice }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409) {
          // Já votou
          alert("Você já votou neste prisioneiro hoje.");
          setPrisoners((prev) =>
            prev.map((p) => (p.id === selectedId ? { ...p, state: "voted" } : p)),
          );
        } else {
          alert(err.error || "Erro ao votar.");
        }
        setIsSubmitting(false);
        return;
      }

      // Sucesso
      setPrisoners((prev) => prev.map((p) => (p.id === selectedId ? { ...p, state: "voted" } : p)));

      // Fecha após 1.5s (como no PROMPT)
      setTimeout(() => {
        setSelectedId(null);
        setIsSubmitting(false);
      }, 1500);
    } catch (error) {
      console.error(error);
      alert("Erro de rede.");
      setIsSubmitting(false);
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
              onSelect={(id) => setSelectedId(id)}
              priority={index < 2}
            />
          </li>
        ))}
      </ul>

      <Modal
        prisoner={selectedPrisoner}
        isOpen={selectedId !== null}
        isSubmitting={isSubmitting}
        onClose={() => setSelectedId(null)}
        onVote={handleVote}
      />
    </>
  );
}
