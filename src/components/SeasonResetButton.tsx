"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* ==========================================
   CONFIGURAÇÕES
   ========================================== */

const CONFIRMATION_PHRASE = "RESETAR TEMPORADAS";

interface ResetResponse {
  ok?: boolean;
  reset?: boolean;
  currentSeason?: number;
  seasonsReset?: number;
  votesDeleted?: number;
  resultsDeleted?: number;
  error?: string;
}

/**
 * MILGRAM Voting — Redefinição de temporadas.
 *
 * Preserva o fluxo original:
 *
 * 1. O administrador abre a confirmação;
 * 2. Digita exatamente RESETAR TEMPORADAS;
 * 3. Confirma explicitamente a operação;
 * 4. A API valida e executa o reset;
 * 5. O painel é atualizado.
 *
 * A API continua responsável por:
 *
 * - Validar a autenticação;
 * - Verificar a origem da requisição;
 * - Validar a frase de confirmação;
 * - Excluir os votos e resultados;
 * - Restaurar as temporadas;
 * - Preservar imagens e prisioneiros.
 */
export function SeasonResetButton() {
  const router = useRouter();

  /* ======================================
     ESTADOS
     ====================================== */

  const [isConfirming, setIsConfirming] = useState(false);

  const [confirmation, setConfirmation] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ResetResponse | null>(null);

  /* ======================================
     CONTROLE DE CONFIRMAÇÃO
     ====================================== */

  const canReset = confirmation === CONFIRMATION_PHRASE && !isSubmitting;

  const resetComplete = result?.reset === true;

  /**
   * Abre a segunda etapa de confirmação.
   *
   * Não executa nenhuma requisição.
   */
  function openConfirmation() {
    setError(null);
    setConfirmation("");
    setIsConfirming(true);
  }

  /**
   * Cancela a confirmação.
   *
   * Durante o envio não é permitido
   * cancelar pela interface.
   */
  function cancel() {
    if (isSubmitting) {
      return;
    }

    setIsConfirming(false);
    setConfirmation("");
    setError(null);
  }

  /* ======================================
     REDEFINIÇÃO DAS TEMPORADAS
     ====================================== */

  async function handleReset() {
    if (!canReset || result?.reset) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/season/reset", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirm: true,
          confirmation: CONFIRMATION_PHRASE,
        }),
      });

      const payload: ResetResponse | null = await response.json().catch(() => null);

      if (!response.ok || payload?.ok !== true || payload.reset !== true) {
        throw new Error(payload?.error ?? "Não foi possível resetar as temporadas.");
      }

      /* Operação confirmada pelo servidor */

      setResult(payload);
      setIsConfirming(false);
      setConfirmation("");

      /**
       * Atualiza os Server Components
       * depois da resposta positiva.
       */
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Ocorreu um erro inesperado.");

      /**
       * Exige que a frase seja digitada
       * novamente após uma falha.
       */
      setConfirmation("");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ==========================================
     INTERFACE
     ========================================== */

  return (
    <section
      aria-labelledby="season-reset-title"
      className="relative isolate min-w-0 overflow-hidden border border-accent/50 bg-[#171313] text-white"
    >
      {/* ======================================
          CABEÇALHO
          ====================================== */}

      <header className="relative overflow-hidden border-b border-accent/25 bg-[#201516] px-5 py-6 sm:px-6">
        {/* Geometria decorativa */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rotate-45 border-[22px] border-accent/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rotate-45 border-[15px] border-white/5"
        />

        <div className="relative">
          {/* Identificação */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-8 bg-accent" />

              <p className="font-mono text-[10px] font-black tracking-[0.13em] text-accent-fg uppercase">
                MILGRAM / RESTRICTED OPERATIONS
              </p>
            </div>

            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center border border-accent/60 bg-accent/10 text-xl font-black text-accent-fg"
            >
              !
            </span>
          </div>

          {/* Título */}
          <h2
            id="season-reset-title"
            className="milgram-display text-[clamp(2rem,7vw,3.5rem)] leading-tight text-white"
          >
            SYSTEM RESET
          </h2>

          <p className="mt-3 text-base font-black tracking-[0.08em] text-accent-fg uppercase">
            RESETAR TEMPORADAS
          </p>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
            Reinicia o ciclo completo de julgamento, remove todos os votos e resultados registrados
            e restaura as três temporadas ao estado inicial.
          </p>
        </div>
      </header>

      {/* ======================================
          CONSEQUÊNCIAS DA OPERAÇÃO
          ====================================== */}

      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6">
        {/* Dados removidos */}
        <div className="relative overflow-hidden border border-accent/50 bg-accent/10 p-4">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center border border-accent/50 bg-accent/15 text-lg font-black text-accent-fg"
            >
              ✕
            </span>

            <div>
              <p className="font-mono text-[10px] font-black tracking-[0.12em] text-accent-fg uppercase">
                DATA REMOVAL
              </p>

              <p className="mt-1 text-sm font-black text-white uppercase">DADOS EXCLUÍDOS</p>
            </div>
          </div>

          <ul className="space-y-2 text-sm leading-relaxed text-white/75">
            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="text-accent-fg">
                ✕
              </span>

              <span>Todos os votos das três temporadas</span>
            </li>

            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="text-accent-fg">
                ✕
              </span>

              <span>Todos os resultados dos julgamentos</span>
            </li>
          </ul>
        </div>

        {/* Dados preservados */}
        <div className="relative overflow-hidden border border-[#8ebdc4]/50 bg-[#32555a]/15 p-4">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center border border-[#8ebdc4]/50 bg-[#32555a]/30 text-lg font-black text-[#c8e5e9]"
            >
              ✓
            </span>

            <div>
              <p className="font-mono text-[10px] font-black tracking-[0.12em] text-[#a4d0d6] uppercase">
                DATA PRESERVATION
              </p>

              <p className="mt-1 text-sm font-black text-white uppercase">DADOS PRESERVADOS</p>
            </div>
          </div>

          <ul className="space-y-2 text-sm leading-relaxed text-white/75">
            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="text-[#a4d0d6]">
                ✓
              </span>

              <span>Imagens de todas as temporadas</span>
            </li>

            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="text-[#a4d0d6]">
                ✓
              </span>

              <span>Cadastros e informações dos prisioneiros</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ======================================
          RESULTADO / AÇÃO / CONFIRMAÇÃO
          ====================================== */}

      <div className="border-t border-white/10 px-5 py-6 sm:px-6">
        {/* ==============================
            REDEFINIÇÃO CONCLUÍDA
            ============================== */}

        {resetComplete ? (
          <div
            role="status"
            aria-live="polite"
            className="overflow-hidden border border-[#8ebdc4]/60 bg-[#32555a]/15"
          >
            {/* Cabeçalho do sucesso */}
            <div className="flex flex-wrap items-center gap-3 border-b border-[#8ebdc4]/25 p-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#8ebdc4] bg-[#32555a]/40 text-xl font-black text-[#c8e5e9]"
              >
                ✓
              </span>

              <div className="min-w-0">
                <p className="font-mono text-[10px] font-black tracking-[0.13em] text-[#a4d0d6] uppercase">
                  RESET COMPLETE
                </p>

                <p className="mt-1 text-base font-black text-white">
                  Temporadas reiniciadas com sucesso.
                </p>
              </div>
            </div>

            {/* Estatísticas retornadas pela API */}
            <dl className="grid grid-cols-1 border-b border-[#8ebdc4]/20 sm:grid-cols-3">
              <div className="border-b border-[#8ebdc4]/20 p-4 sm:border-r sm:border-b-0">
                <dt className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#a4d0d6] uppercase">
                  TEMPORADAS
                </dt>

                <dd className="mt-2 font-mono text-3xl font-black text-white">
                  {result?.seasonsReset ?? 0}
                </dd>

                <p className="mt-1 text-xs text-white/60">Restauradas</p>
              </div>

              <div className="border-b border-[#8ebdc4]/20 p-4 sm:border-r sm:border-b-0">
                <dt className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#a4d0d6] uppercase">
                  VOTOS
                </dt>

                <dd className="mt-2 font-mono text-3xl font-black text-white">
                  {(result?.votesDeleted ?? 0).toLocaleString("pt-BR")}
                </dd>

                <p className="mt-1 text-xs text-white/60">Excluídos</p>
              </div>

              <div className="p-4">
                <dt className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#a4d0d6] uppercase">
                  RESULTADOS
                </dt>

                <dd className="mt-2 font-mono text-3xl font-black text-white">
                  {(result?.resultsDeleted ?? 0).toLocaleString("pt-BR")}
                </dd>

                <p className="mt-1 text-xs text-white/60">Removidos</p>
              </div>
            </dl>

            <div className="p-4">
              <p className="text-sm leading-relaxed text-white/80">
                A Temporada 1 está pronta para ser iniciada novamente. Os retratos e os dados dos
                prisioneiros foram preservados.
              </p>
            </div>
          </div>
        ) : !isConfirming ? (
          /* ==============================
              PRIMEIRA ETAPA
              ============================== */

          <div>
            <div className="mb-5 border-l-[3px] border-accent bg-accent/10 p-4">
              <p className="font-mono text-[10px] font-black tracking-[0.12em] text-accent-fg uppercase">
                IMPORTANT WARNING
              </p>

              <p className="mt-2 text-sm leading-relaxed text-white/80">
                Esta operação não pode ser desfeita pelos controles administrativos. Você precisará
                iniciar os julgamentos novamente após o reset.
              </p>
            </div>

            {/* Não executa a requisição */}
            <button
              type="button"
              onClick={openConfirmation}
              className="inline-flex min-h-12 w-full items-center justify-between gap-4 border border-accent bg-accent/15 px-5 py-3 text-left text-xs font-black tracking-[0.1em] text-white uppercase transition-colors hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg sm:w-auto"
            >
              <span>RESETAR TODAS AS TEMPORADAS</span>

              <span aria-hidden="true" className="text-lg leading-none">
                →
              </span>
            </button>
          </div>
        ) : (
          /* ==============================
              SEGUNDA ETAPA
              ============================== */

          <form
            aria-busy={isSubmitting}
            className="overflow-hidden border border-accent/60 bg-[#211517]"
            onSubmit={(event) => {
              event.preventDefault();

              void handleReset();
            }}
          >
            {/* Cabeçalho da confirmação */}
            <div className="border-b border-accent/25 bg-accent/10 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <span aria-hidden="true" className="h-[2px] w-7 bg-accent" />

                <p className="font-mono text-[10px] font-black tracking-[0.12em] text-accent-fg uppercase">
                  FINAL CONFIRMATION
                </p>
              </div>

              <h3 className="milgram-display text-2xl leading-tight text-white sm:text-3xl">
                CONFIRMAR RESET COMPLETO
              </h3>

              <p id="season-reset-warning" className="mt-4 text-sm leading-relaxed text-white/80">
                Esta operação é irreversível. Todos os votos e resultados das três temporadas serão
                excluídos.
              </p>

              <p className="mt-2 text-sm leading-relaxed font-bold text-[#c8e5e9]">
                As imagens e os dados dos prisioneiros serão preservados.
              </p>
            </div>

            {/* Campo da frase obrigatória */}
            <div className="space-y-3 p-4 sm:p-5">
              <div>
                <p className="mb-2 font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
                  REQUIRED VERIFICATION
                </p>

                <label
                  htmlFor="season-reset-confirmation"
                  className="block text-sm leading-relaxed text-white/85"
                >
                  Digite exatamente a frase abaixo para confirmar:
                </label>
              </div>

              {/* Frase exibida para conferência */}
              <div className="border border-accent/40 bg-black/35 px-4 py-3">
                <code className="block font-mono text-sm font-black tracking-[0.08em] text-accent-fg select-all sm:text-base">
                  {CONFIRMATION_PHRASE}
                </code>
              </div>

              <input
                id="season-reset-confirmation"
                name="confirmation"
                type="text"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={isSubmitting}
                aria-describedby="season-reset-warning"
                className="min-h-12 w-full min-w-0 border border-white/30 bg-[#101010] px-4 py-3 font-mono text-sm text-white transition-colors outline-none placeholder:text-white/35 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={CONFIRMATION_PHRASE}
              />

              {/* Estado da validação textual */}
              <p
                role="status"
                aria-live="polite"
                className={`font-mono text-[10px] font-bold tracking-[0.08em] uppercase ${
                  confirmation === CONFIRMATION_PHRASE ? "text-[#a4d0d6]" : "text-white/50"
                }`}
              >
                {confirmation === CONFIRMATION_PHRASE
                  ? "✓ CONFIRMAÇÃO VALIDADA"
                  : "AGUARDANDO CONFIRMAÇÃO"}
              </p>

              {/* Erro de execução */}
              {error && (
                <div role="alert" className="border-l-[3px] border-accent bg-accent/10 p-4">
                  <p className="mb-2 font-mono text-[10px] font-black tracking-[0.12em] text-accent-fg uppercase">
                    RESET ERROR
                  </p>

                  <p className="text-sm leading-relaxed text-white/85">{error}</p>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex flex-col gap-3 border-t border-accent/25 bg-black/20 p-4 sm:flex-row sm:flex-wrap sm:p-5">
              {/* Confirmar */}
              <button
                type="submit"
                disabled={!canReset}
                aria-busy={isSubmitting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-3 border border-accent bg-accent px-5 py-3 text-center text-xs font-black tracking-[0.1em] text-white uppercase transition-colors hover:bg-[#bc1016] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-[#3a292b] disabled:text-white/45 sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />

                    <span>RESETANDO...</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" className="text-base leading-none">
                      !
                    </span>

                    <span>CONFIRMAR RESET DEFINITIVO</span>
                  </>
                )}
              </button>

              {/* Cancelar */}
              <button
                type="button"
                onClick={cancel}
                disabled={isSubmitting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-3 border border-white/35 bg-white/5 px-5 py-3 text-xs font-black tracking-[0.1em] text-white uppercase transition-colors hover:border-white hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  ✕
                </span>

                <span>CANCELAR</span>
              </button>
            </div>

            <div className="border-t border-white/10 px-4 py-3 sm:px-5">
              <p className="text-xs leading-relaxed text-white/45">
                O reset só será executado após a confirmação exata e a validação pelo servidor.
              </p>
            </div>
          </form>
        )}

        {/* Erros fora do formulário */}
        {error && !isConfirming && (
          <div role="alert" className="mt-4 border-l-[3px] border-accent bg-accent/10 p-4">
            <p className="text-sm leading-relaxed text-white/85">{error}</p>
          </div>
        )}
      </div>

      {/* ======================================
          RODAPÉ
          ====================================== */}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#101010] px-5 py-4 sm:px-6">
        <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/40 uppercase">
          MILGRAM / SYSTEM RESET
        </p>

        <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
          RESTRICTED ACCESS
        </p>
      </footer>

      {/* Linha inferior */}
      <div
        aria-hidden="true"
        className="h-[3px] bg-linear-to-r from-accent via-accent/50 to-transparent"
      />
    </section>
  );
}

export default SeasonResetButton;
