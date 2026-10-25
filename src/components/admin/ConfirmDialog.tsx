"use client";

import { useEffect, useId, useRef } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
      // Ação destrutiva: o foco inicial é o botão seguro. Ao fechar, o navegador
      // devolve o foco ao botão que abriu o diálogo.
      cancelButtonRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Esc: o React controla o fechamento; durante o envio, o Esc é ignorado
        event.preventDefault();
        if (!isPending) {
          onCancel();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md border border-white/30 bg-card p-6 text-fg backdrop:bg-black/80"
    >
      <h2 id={titleId} className="text-lg font-bold tracking-wide">
        {title}
      </h2>
      <p id={descriptionId} className="mt-3 text-sm text-white/80">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="border border-white px-4 py-2 text-sm font-bold tracking-wider uppercase hover:bg-white hover:text-black disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          aria-busy={isPending}
          className="border border-accent bg-accent px-4 py-2 text-sm font-bold tracking-wider text-white uppercase hover:bg-accent-2 disabled:opacity-50"
        >
          {isPending ? "Processando…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
