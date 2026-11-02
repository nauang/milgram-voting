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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isBusy = status === "submitting";

  /**
   * Bloqueia a rolagem da página enquanto
   * o modal está aberto.
   *
   * Também posiciona o foco no modal e
   * devolve o foco ao elemento anterior
   * quando ele é fechado.
   */
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  /**
   * Acessibilidade do teclado:
   *
   * - Escape fecha o modal;
   * - Tab mantém o foco dentro do diálogo;
   * - Durante o envio, o fechamento é bloqueado.
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isBusy) {
          event.preventDefault();
          onClose();
        }

        return;
      }

      if (event.key !== "Tab") return;

      const modal = modalRef.current;

      if (!modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (!modal.contains(document.activeElement)) {
        event.preventDefault();

        if (event.shiftKey) {
          last.focus();
        } else {
          first.focus();
        }

        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isBusy, onClose]);

  const numberLabel = prisoner ? formatPrisonerNumber(prisoner.number) : "";

  const prisonerNumber = prisoner ? String(prisoner.number).padStart(2, "0") : "";

  return (
    <AnimatePresence>
      {isOpen && prisoner && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* ======================================
              FUNDO DO MODAL
              ====================================== */}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={!isBusy ? onClose : undefined}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm"
          />

          {/* Centralização */}
          <div className="relative flex min-h-full items-center justify-center px-3 py-5 sm:px-5">
            <motion.div
              ref={modalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              aria-describedby="modal-description"
              aria-busy={isBusy}
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 20,
              }}
              transition={{
                duration: 0.2,
                ease: "easeOut",
              }}
              className="relative z-10 w-full max-w-4xl overflow-hidden border border-white/25 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.75)]"
            >
              {/* ==================================
                  CABEÇALHO DO JULGAMENTO
                  ================================== */}

              <div className="relative flex min-h-15 items-center justify-between gap-4 border-b border-white/15 bg-[#101010] px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="h-7 w-[3px] shrink-0 bg-accent" />

                  <div className="min-w-0">
                    <p className="text-[10px] font-black tracking-[0.17em] text-white uppercase sm:text-xs">
                      MILGRAM
                    </p>

                    <p className="mt-1 text-[9px] font-bold tracking-[0.12em] text-accent-fg uppercase">
                      JUDGEMENT SYSTEM
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="hidden font-mono text-[10px] font-bold tracking-wider text-white/50 uppercase sm:block">
                    CASE / {prisonerNumber}
                  </span>

                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    disabled={isBusy}
                    aria-label="Fechar modal"
                    className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/30 bg-white/5 text-lg text-white transition-colors hover:border-accent hover:bg-accent/15 hover:text-accent-fg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
              </div>

              {/* ==================================
                  CONTEÚDO PRINCIPAL
                  ================================== */}

              <div className="grid sm:grid-cols-2">
                {/* ==============================
                    RETRATO DO PRISIONEIRO
                    ============================== */}

                <figure className="relative h-[280px] overflow-hidden border-b border-white/10 bg-[#090909] sm:h-auto sm:min-h-[470px] sm:border-r sm:border-b-0">
                  {/* Geometria de fundo */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rotate-45 border-[35px] border-accent/10"
                  />

                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-5 right-3 font-mono text-[100px] leading-none font-black tracking-tighter text-white/5 sm:text-[140px]"
                  >
                    {prisonerNumber}
                  </span>

                  {/* Retrato original */}
                  {prisoner.imageUrl ? (
                    <Image
                      src={prisoner.imageUrl}
                      alt={`Retrato de ${prisoner.nickname}, ${numberLabel}`}
                      fill
                      sizes="(min-width: 560px) 50vw, 100vw"
                      className="z-10 object-contain object-bottom"
                    />
                  ) : (
                    <div className="relative z-10 flex h-full items-center justify-center text-sm text-white/60">
                      Sem imagem
                    </div>
                  )}

                  {/* Gradiente de leitura */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-linear-to-t from-black/90 via-black/30 to-transparent"
                  />

                  {/* Identificação sobre a imagem */}
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-3 p-5 sm:p-6">
                    <div>
                      <p className="mb-2 font-mono text-[10px] font-bold tracking-[0.16em] text-white/65 uppercase">
                        PRISONER FILE
                      </p>

                      <p className="font-mono text-3xl leading-none font-black text-accent-fg sm:text-4xl">
                        {numberLabel}
                      </p>
                    </div>

                    <span aria-hidden="true" className="h-3 w-3 rotate-45 border-2 border-accent" />
                  </figcaption>
                </figure>

                {/* ==============================
                    PAINEL DE VOTAÇÃO
                    ============================== */}

                <div className="relative flex min-w-0 flex-col justify-center overflow-hidden p-5 sm:p-7 lg:p-9">
                  {/* Detalhe geométrico */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rotate-45 border-[22px] border-accent/5"
                  />

                  <div className="relative">
                    {/* Identificação */}
                    <div className="mb-5 flex items-center gap-3">
                      <span className="h-[2px] w-8 bg-accent" />

                      <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-accent-fg uppercase">
                        PRISONER / {prisonerNumber}
                      </span>
                    </div>

                    {/* Nome do prisioneiro */}
                    <h2
                      id="modal-title"
                      className="text-3xl leading-tight font-black tracking-wide text-white sm:text-4xl"
                    >
                      {prisoner.nickname}
                    </h2>

                    <p className="mt-2 text-sm text-white/55">{prisoner.fullName}</p>

                    <div className="my-7 h-px bg-white/15" />

                    <p
                      id="modal-description"
                      className="mb-5 text-sm leading-relaxed text-white/75"
                    >
                      Analise o prisioneiro e escolha seu veredito.
                    </p>

                    {/* ==========================
                        ESCOLHA DO VEREDITO
                        ========================== */}

                    {status === "idle" || status === "error" ? (
                      <div>
                        <h3 className="mb-5 text-lg font-black tracking-wide text-white uppercase">
                          QUAL É O SEU VEREDITO?
                        </h3>

                        <div className="flex flex-wrap gap-3">
                          {/* Inocente */}
                          <div className="flex min-w-[138px] flex-1 flex-col items-center gap-4 border border-[#32555a] bg-[#32555a]/15 p-3">
                            <div className="w-full border-b border-[#32555a]/60 pb-3 text-center">
                              <p className="font-mono text-[9px] font-bold tracking-wider text-[#a4d0d6] uppercase">
                                VERDICT / 01
                              </p>

                              <p className="mt-2 text-xs font-black tracking-wide text-white uppercase">
                                INOCENTE
                              </p>
                            </div>

                            <VoteDiamond choice="forgive" disabled={false} onClick={onVote} />
                          </div>

                          {/* Culpado */}
                          <div className="flex min-w-[138px] flex-1 flex-col items-center gap-4 border border-accent/70 bg-accent/10 p-3">
                            <div className="w-full border-b border-accent/50 pb-3 text-center">
                              <p className="font-mono text-[9px] font-bold tracking-wider text-accent-fg uppercase">
                                VERDICT / 02
                              </p>

                              <p className="mt-2 text-xs font-black tracking-wide text-white uppercase">
                                CULPADO
                              </p>
                            </div>

                            <VoteDiamond choice="not_forgive" disabled={false} onClick={onVote} />
                          </div>
                        </div>

                        {/* Erro de votação */}
                        {status === "error" && errorMessage && (
                          <div
                            role="alert"
                            className="mt-5 border-l-[3px] border-accent bg-accent/10 p-4"
                          >
                            <p className="mb-1 text-xs font-black tracking-wider text-accent-fg uppercase">
                              ERRO NO JULGAMENTO
                            </p>

                            <p className="text-sm leading-relaxed text-white/85">{errorMessage}</p>
                          </div>
                        )}
                      </div>
                    ) : status === "submitting" ? (
                      /* ======================
                         ENVIANDO VOTO
                         ====================== */

                      <div
                        role="status"
                        aria-live="polite"
                        className="border-l-[3px] border-accent bg-accent/10 p-5"
                      >
                        <p className="font-mono text-xs font-bold tracking-[0.15em] text-accent-fg uppercase">
                          PROCESSANDO VEREDITO
                        </p>

                        <p className="mt-4 animate-pulse text-lg font-black text-white">
                          Enviando voto...
                        </p>

                        <p className="mt-3 text-sm leading-relaxed text-white/65">
                          Aguarde a confirmação do julgamento.
                        </p>
                      </div>
                    ) : (
                      /* ======================
                         VOTO REGISTRADO
                         ====================== */

                      <div
                        role="status"
                        aria-live="polite"
                        className="border-l-[3px] border-accent bg-accent/10 p-5"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="flex h-10 w-10 items-center justify-center border border-accent bg-accent text-xl font-bold text-white"
                          >
                            ✓
                          </span>

                          <div>
                            <p className="font-mono text-[10px] font-bold tracking-[0.13em] text-accent-fg uppercase">
                              VERDICT CONFIRMED
                            </p>

                            <p className="mt-1 text-lg font-black text-white">Voto registrado</p>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-relaxed text-white/70">
                          Seu veredito foi registrado para este prisioneiro.
                        </p>

                        <p className="mt-3 text-xs font-bold tracking-widest text-white/45">
                          投票済み / MILGRAM
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ==================================
                  RODAPÉ DECORATIVO
                  ================================== */}

              <div className="flex items-center justify-between gap-3 border-t border-white/15 bg-[#101010] px-4 py-3 sm:px-6">
                <p className="font-mono text-[9px] font-bold tracking-[0.12em] text-white/40 uppercase">
                  MILGRAM / VOTING SYSTEM
                </p>

                <p className="font-mono text-[9px] font-bold tracking-[0.1em] text-accent-fg uppercase">
                  YOUR VERDICT
                </p>
              </div>

              {/* Linha inferior vermelha */}
              <div
                aria-hidden="true"
                className="h-[3px] bg-linear-to-r from-accent via-accent/50 to-transparent"
              />
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}