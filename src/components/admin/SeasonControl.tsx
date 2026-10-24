"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeasonRow } from "@/lib/season";

interface SeasonControlProps {
  seasons: SeasonRow[];
}

export function SeasonControl({ seasons }: SeasonControlProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voting = seasons.find((s) => s.status === "voting");
  const closed = seasons.filter((s) => s.status === "closed");
  const idle = seasons.find((s) => s.status === "idle");

  const action = async (path: string, body: Record<string, unknown> = {}) => {
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao executar ação");
      } else {
        router.refresh();
      }
    } catch {
      setError("Erro de rede");
    } finally {
      setIsPending(false);
    }
  };

  const handleInit = () => {
    if (!idle) return;
    if (!confirm(`Iniciar a Temporada ${idle.number}?`)) return;
    action("/api/admin/season/init", { number: idle.number, confirm: true });
  };

  const handleCloseVoting = () => {
    if (!voting) return;
    if (!confirm(`Encerrar a votação da Temporada ${voting.number} e iniciar a próxima?`)) return;
    action("/api/admin/season/closeVoting", { number: voting.number, confirm: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {idle && (
          <button
            onClick={handleInit}
            disabled={isPending}
            className="border border-white px-4 py-2 text-sm font-bold tracking-wider uppercase hover:bg-white hover:text-black disabled:opacity-50"
          >
            Iniciar T{idle.number}
          </button>
        )}
        {voting && (
          <button
            onClick={handleCloseVoting}
            disabled={isPending}
            className="border border-accent bg-accent px-4 py-2 text-sm font-bold tracking-wider text-white uppercase hover:bg-accent-2 disabled:opacity-50"
          >
            Encerrar votação T{voting.number}
          </button>
        )}
        {!idle && !voting && closed.length === 3 && (
          <p className="text-sm text-white/60">Todas as temporadas foram encerradas.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
