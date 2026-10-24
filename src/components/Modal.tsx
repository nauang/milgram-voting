"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VoteDiamond } from "./VoteDiamond";
import type { JudgePrisoner, VoteChoice } from "@/types/domain";
import { formatPrisonerNumber } from "@/utils/format";

interface ModalProps {
  prisoner: JudgePrisoner | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onVote: (choice: VoteChoice) => void;
}

export function Modal({ prisoner, isOpen, isSubmitting, onClose, onVote }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Fechar com ESC e Focus Trap básico
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden"; // Evita scroll no fundo
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isSubmitting, onClose]);

  return (
    <AnimatePresence>
      {isOpen && prisoner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isSubmitting ? onClose : undefined}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Conteúdo do Modal */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="md:flex-row md:items-stretch md:p-8 relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 border border-white/20 bg-[#1a1a1a] p-6"
          >
            <button
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Fechar modal"
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              ✕
            </button>

            {/* Imagem Esquerda (Desktop) */}
            <div className="md:w-1/2 w-full">
              {prisoner.imageUrl ? (
                <img
                  src={prisoner.imageUrl}
                  alt={prisoner.nickname}
                  className="aspect-[3/4] w-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center bg-black">
                  Sem imagem
                </div>
              )}
            </div>

            {/* Ações Direita */}
            <div className="md:w-1/2 md:text-left flex w-full flex-col justify-center text-center">
              <p className="text-sm font-bold tracking-widest text-[#E4007F]">
                {formatPrisonerNumber(prisoner.number)}
              </p>
              <h2 id="modal-title" className="text-3xl font-bold text-white">
                {prisoner.nickname}
              </h2>
              <p className="mb-8 text-sm text-white/60">{prisoner.fullName}</p>

              <p className="mb-6 text-sm font-bold text-white/80">Qual é o seu veredito?</p>

              <div className="md:justify-start flex justify-center gap-8">
                <VoteDiamond choice="forgive" disabled={isSubmitting} onClick={onVote} />
                <VoteDiamond choice="not_forgive" disabled={isSubmitting} onClick={onVote} />
              </div>

              {isSubmitting && (
                <p className="mt-6 animate-pulse text-sm text-white/70">Enviando voto...</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
