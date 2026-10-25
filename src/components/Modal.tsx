"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VoteDiamond } from "./VoteDiamond";
import type { JudgePrisoner, VoteChoice } from "@/types/domain";
import { formatPrisonerNumber } from "@/utils/format";

export type ModalStatus = "idle" | "submitting" | "success" | "error";

interface ModalProps {
  prisoner: JudgePrisoner | null;
  isOpen: boolean;
  status: ModalStatus;
  errorMessage?: string;
  onClose: () => void;
  onVote: (choice: VoteChoice) => void;
}

export function Modal({ prisoner, isOpen, status, errorMessage, onClose, onVote }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isBusy = status === "submitting";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isBusy, onClose]);

  return (
    <AnimatePresence>
      {isOpen && prisoner && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isBusy ? onClose : undefined}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <div className="relative flex min-h-full items-center justify-center p-4">
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 border border-white/20 bg-[#1a1a1a] p-6 sm:flex-row sm:items-stretch sm:p-8"
            >
              <button
                onClick={onClose}
                disabled={isBusy}
                aria-label="Fechar modal"
                className="absolute top-4 right-4 text-white/50 hover:text-white"
              >
                ✕
              </button>

              <div className="w-full sm:w-1/2">
                {prisoner.imageUrl ? (
                  <div className="relative aspect-[3/4] w-full overflow-hidden border border-white/10">
                    <Image
                      src={prisoner.imageUrl}
                      alt={prisoner.nickname}
                      fill
                      sizes="(min-width: 560px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-black">
                    Sem imagem
                  </div>
                )}
              </div>

              <div className="flex w-full flex-col justify-center text-center sm:w-1/2 sm:text-left">
                <p className="text-sm font-bold tracking-widest text-[#E4007F]">
                  {formatPrisonerNumber(prisoner.number)}
                </p>
                <h2 id="modal-title" className="text-3xl font-bold text-white">
                  {prisoner.nickname}
                </h2>
                <p className="mb-8 text-sm text-white/60">{prisoner.fullName}</p>

                {status === "idle" || status === "error" ? (
                  <>
                    <p className="mb-6 text-sm font-bold text-white/80">Qual é o seu veredito?</p>
                    <div className="flex justify-center gap-8 sm:justify-start">
                      <VoteDiamond choice="forgive" disabled={false} onClick={onVote} />
                      <VoteDiamond choice="not_forgive" disabled={false} onClick={onVote} />
                    </div>
                    {status === "error" && errorMessage && (
                      <p role="alert" className="mt-4 text-sm text-accent-fg">
                        {errorMessage}
                      </p>
                    )}
                  </>
                ) : status === "submitting" ? (
                  <p className="mt-6 animate-pulse text-sm text-white/70">Enviando voto...</p>
                ) : (
                  <p className="mt-6 text-lg font-bold text-accent-fg">
                    投票済み / Voto registrado
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
