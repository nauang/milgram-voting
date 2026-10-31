"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

/* ==========================================
   CONFIGURAÇÕES DE UPLOAD
   ========================================== */

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const CSRF_ENDPOINT = "/api/admin/csrf";
const UPLOAD_ENDPOINT = "/api/admin/images";
const CSRF_HEADER = "x-milgram-csrf";

/* ==========================================
   PRISIONEIROS E TEMPORADAS
   ========================================== */

const PRISONERS = [
  { slug: "haruka", name: "Haruka" },
  { slug: "yuno", name: "Yuno" },
  { slug: "futa", name: "Futa" },
  { slug: "mu", name: "Mu" },
  { slug: "shidou", name: "Shidou" },
  { slug: "mahiru", name: "Mahiru" },
  { slug: "kazui", name: "Kazui" },
  { slug: "amane", name: "Amane" },
  { slug: "mikoto", name: "Mikoto" },
  { slug: "kotoko", name: "Kotoko" },
] as const;

type PrisonerSlug = (typeof PRISONERS)[number]["slug"];

type Season = "1" | "2" | "3";

interface StatusMessage {
  type: "success" | "error";
  message: string;
}

/* ==========================================
   INTERPRETAÇÃO DAS RESPOSTAS DA API
   ========================================== */

/**
 * Interpreta a resposta JSON sem presumir
 * que o servidor retornou o formato esperado.
 */
async function readJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Obtém uma mensagem de erro segura.
 */
function getErrorMessage(data: Record<string, unknown> | null, fallback: string): string {
  if (typeof data?.error === "string" && data.error.trim().length > 0) {
    return data.error;
  }

  return fallback;
}

/* ==========================================
   VALIDAÇÃO LOCAL
   ========================================== */

/**
 * Realiza a validação inicial no navegador.
 *
 * A validação definitiva permanece na API.
 */
function validateSelectedFile(file: File): string | null {
  if (file.size === 0) {
    return "O arquivo selecionado está vazio.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "A imagem deve ter no máximo 2 MB.";
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Formato inválido. Utilize PNG, JPEG ou WebP.";
  }

  return null;
}

/* ==========================================
   COMPONENTE PRINCIPAL
   ========================================== */

/**
 * MILGRAM Voting — Gerenciamento de imagens.
 *
 * Fluxo preservado:
 *
 * 1. Seleção e validação local;
 * 2. GET /api/admin/csrf;
 * 3. POST /api/admin/images;
 * 4. Atualização dos Server Components.
 *
 * A interface não acessa diretamente
 * credenciais administrativas ou do Supabase.
 */
export default function ImageUploadForm() {
  const router = useRouter();
  const formId = useId();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrlRef = useRef<string | null>(null);

  const requestControllerRef = useRef<AbortController | null>(null);

  /* ======================================
     ESTADOS
     ====================================== */

  const [prisonerSlug, setPrisonerSlug] = useState<PrisonerSlug>("haruka");

  const [season, setSeason] = useState<Season>("1");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [status, setStatus] = useState<StatusMessage | null>(null);

  /* ======================================
     IDENTIFICADORES ACESSÍVEIS
     ====================================== */

  const prisonerInputId = `${formId}-prisoner`;

  const seasonInputId = `${formId}-season`;

  const fileInputId = `${formId}-file`;

  const fileHelpId = `${formId}-file-help`;

  const previewTitleId = `${formId}-preview-title`;

  const uploadTitleId = `${formId}-title`;

  /* ======================================
     DADOS PARA APRESENTAÇÃO
     ====================================== */

  const selectedPrisoner = PRISONERS.find((prisoner) => prisoner.slug === prisonerSlug);

  const selectedPrisonerName = selectedPrisoner?.name ?? prisonerSlug;

  const trialNumber = season.padStart(2, "0");

  /* ======================================
     PRÉ-VISUALIZAÇÃO
     ====================================== */

  /**
   * Libera a URL temporária da imagem.
   */
  function clearPreview() {
    const currentUrl = previewUrlRef.current;

    previewUrlRef.current = null;

    setPreviewUrl(null);

    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
  }

  /**
   * Cancela requisições pendentes e libera
   * URLs temporárias na desmontagem.
   */
  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);

        previewUrlRef.current = null;
      }
    };
  }, []);

  /* ======================================
     SELEÇÃO DE ARQUIVO
     ====================================== */

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (isSubmitting) {
      return;
    }

    const file = event.target.files?.[0] ?? null;

    clearPreview();

    setSelectedFile(null);
    setStatus(null);

    if (!file) {
      return;
    }

    const validationError = validateSelectedFile(file);

    if (validationError) {
      event.target.value = "";

      setStatus({
        type: "error",
        message: validationError,
      });

      return;
    }

    const objectUrl = URL.createObjectURL(file);

    previewUrlRef.current = objectUrl;

    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  }

  /**
   * Limpa a seleção depois de
   * um upload confirmado pela API.
   */
  function clearSelectedFile() {
    clearPreview();

    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* ======================================
     TOKEN CSRF
     ====================================== */

  async function requestCsrfToken(signal: AbortSignal): Promise<string> {
    const response = await fetch(CSRF_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    const data = await readJsonResponse(response);

    if (response.status === 401) {
      throw new Error("Sua sessão administrativa expirou. Faça login novamente.");
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Não foi possível obter o token de segurança."));
    }

    if (
      data?.success !== true ||
      data.headerName !== CSRF_HEADER ||
      typeof data.csrfToken !== "string" ||
      data.csrfToken.length === 0
    ) {
      throw new Error("O servidor retornou um token de segurança inválido.");
    }

    return data.csrfToken;
  }

  /* ======================================
     ENVIO PARA A API
     ====================================== */

  async function uploadImage(
    file: File,
    slug: PrisonerSlug,
    selectedSeason: Season,
    csrfToken: string,
    signal: AbortSignal,
  ): Promise<void> {
    const formData = new FormData();

    formData.set("file", file);

    formData.set("prisonerSlug", slug);

    formData.set("season", selectedSeason);

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        [CSRF_HEADER]: csrfToken,
      },
      body: formData,
      signal,
    });

    const data = await readJsonResponse(response);

    if (response.status === 401) {
      throw new Error("Sua sessão administrativa expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("A verificação de segurança falhou. Atualize a página e tente novamente.");
    }

    if (!response.ok || data?.success !== true) {
      throw new Error(getErrorMessage(data, "Não foi possível enviar a imagem."));
    }
  }

  /* ======================================
     SUBMISSÃO DO FORMULÁRIO
     ====================================== */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!selectedFile) {
      setStatus({
        type: "error",
        message: "Selecione uma imagem antes de enviar.",
      });

      return;
    }

    const validationError = validateSelectedFile(selectedFile);

    if (validationError) {
      setStatus({
        type: "error",
        message: validationError,
      });

      return;
    }

    const controller = new AbortController();

    requestControllerRef.current = controller;

    setIsSubmitting(true);
    setStatus(null);

    try {
      const csrfToken = await requestCsrfToken(controller.signal);

      await uploadImage(selectedFile, prisonerSlug, season, csrfToken, controller.signal);

      clearSelectedFile();

      const prisonerName =
        PRISONERS.find((prisoner) => prisoner.slug === prisonerSlug)?.name ?? prisonerSlug;

      setStatus({
        type: "success",
        message: `Imagem de ${prisonerName} ` + `(temporada ${season}) enviada com sucesso.`,
      });

      // Atualiza os Server Components
      // após o upload confirmado.
      router.refresh();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Ocorreu um erro inesperado durante o upload.",
      });
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }

      if (!controller.signal.aborted) {
        setIsSubmitting(false);
      }
    }
  }

  /* ==========================================
     INTERFACE
     ========================================== */

  return (
    <section
      aria-labelledby={uploadTitleId}
      className="relative isolate min-w-0 overflow-hidden border border-white/15 bg-[#141414] text-white"
    >
      {/* ======================================
          CABEÇALHO
          ====================================== */}

      <div className="relative overflow-hidden border-b border-white/15 bg-[#1a1a1a] px-5 py-6 sm:px-6">
        {/* Geometria decorativa */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 h-52 w-52 rotate-45 border-[20px] border-accent/10"
        />

        <div className="relative">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-8 bg-accent" />

              <p className="font-mono text-[10px] font-black tracking-[0.13em] text-accent-fg uppercase">
                MILGRAM / ASSET MANAGEMENT
              </p>
            </div>

            <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-white/40 uppercase">
              UPLOAD SYSTEM
            </span>
          </div>

          <h3
            id={uploadTitleId}
            className="milgram-heading text-2xl leading-tight text-white sm:text-3xl"
          >
            ATRIBUIR RETRATO
          </h3>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
            Selecione um prisioneiro, a temporada e uma imagem para atualizar o retrato utilizado
            nas páginas do site.
          </p>
        </div>
      </div>

      {/* ======================================
          FORMULÁRIO
          ====================================== */}

      <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="min-w-0">
        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2">
          {/* ==============================
              CONFIGURAÇÕES DO UPLOAD
              ============================== */}

          <div className="flex min-w-0 flex-col gap-6 border-b border-white/15 p-5 sm:p-6 lg:border-r lg:border-b-0">
            {/* Seleção do prisioneiro */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] font-black text-accent-fg"
                >
                  01
                </span>

                <label
                  htmlFor={prisonerInputId}
                  className="text-xs font-black tracking-[0.12em] text-white uppercase"
                >
                  PRISIONEIRO
                </label>
              </div>

              <select
                id={prisonerInputId}
                name="prisonerSlug"
                value={prisonerSlug}
                onChange={(event) => {
                  setPrisonerSlug(event.target.value as PrisonerSlug);

                  setStatus(null);
                }}
                disabled={isSubmitting}
                className="min-h-12 w-full border border-white/30 bg-[#242424] px-4 py-3 text-sm font-bold text-white transition-colors outline-none hover:border-white/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {PRISONERS.map((prisoner) => (
                  <option key={prisoner.slug} value={prisoner.slug}>
                    {prisoner.name}
                  </option>
                ))}
              </select>

              <p className="text-xs leading-relaxed text-white/45">
                Escolha o personagem cuja imagem será atualizada.
              </p>
            </div>

            {/* Seleção da temporada */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] font-black text-accent-fg"
                >
                  02
                </span>

                <label
                  htmlFor={seasonInputId}
                  className="text-xs font-black tracking-[0.12em] text-white uppercase"
                >
                  TEMPORADA
                </label>
              </div>

              <select
                id={seasonInputId}
                name="season"
                value={season}
                onChange={(event) => {
                  setSeason(event.target.value as Season);

                  setStatus(null);
                }}
                disabled={isSubmitting}
                className="min-h-12 w-full border border-white/30 bg-[#242424] px-4 py-3 text-sm font-bold text-white transition-colors outline-none hover:border-white/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="1">Temporada 1</option>

                <option value="2">Temporada 2</option>

                <option value="3">Temporada 3</option>
              </select>

              <p className="text-xs leading-relaxed text-white/45">
                Cada temporada possui sua própria imagem.
              </p>
            </div>

            {/* Seleção do arquivo */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] font-black text-accent-fg"
                >
                  03
                </span>

                <label
                  htmlFor={fileInputId}
                  className="text-xs font-black tracking-[0.12em] text-white uppercase"
                >
                  ARQUIVO DE IMAGEM
                </label>
              </div>

              <div className="border border-dashed border-white/30 bg-[#1c1c1c] p-3 transition-colors focus-within:border-accent">
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  disabled={isSubmitting}
                  onChange={handleFileChange}
                  aria-describedby={fileHelpId}
                  className="block w-full min-w-0 cursor-pointer text-xs text-white/70 file:mr-3 file:cursor-pointer file:border-0 file:bg-accent file:px-4 file:py-3 file:text-xs file:font-black file:tracking-wide file:text-white file:uppercase hover:file:bg-[#bc1016] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <p id={fileHelpId} className="text-xs leading-relaxed text-white/55">
                Formatos permitidos: PNG, JPEG e WebP. Tamanho máximo: 2 MB. A imagem será
                convertida automaticamente para WebP.
              </p>
            </div>

            {/* ==========================
                ESTADO DO UPLOAD
                ========================== */}

            {status && (
              <div
                role={status.type === "error" ? "alert" : "status"}
                aria-live={status.type === "error" ? "assertive" : "polite"}
                className={`border-l-[3px] p-4 ${
                  status.type === "success"
                    ? "border-[#8ebdc4] bg-[#32555a]/20"
                    : "border-accent bg-accent/10"
                }`}
              >
                <p
                  className={`mb-2 font-mono text-[10px] font-black tracking-[0.12em] uppercase ${
                    status.type === "success" ? "text-[#c8e5e9]" : "text-accent-fg"
                  }`}
                >
                  {status.type === "success" ? "UPLOAD COMPLETE" : "UPLOAD ERROR"}
                </p>

                <p className="text-sm leading-relaxed text-white/85">{status.message}</p>
              </div>
            )}

            {/* ==========================
                AÇÃO DE ENVIO
                ========================== */}

            <div className="mt-auto border-t border-white/10 pt-5">
              <button
                type="submit"
                disabled={isSubmitting || !selectedFile}
                className="inline-flex min-h-12 w-full items-center justify-between gap-4 border border-accent bg-accent px-5 py-3 text-left text-xs font-black tracking-[0.12em] text-white uppercase transition-colors hover:bg-[#bc1016] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-[#343434] disabled:text-white/45"
              >
                <span>{isSubmitting ? "ENVIANDO IMAGEM..." : "ENVIAR IMAGEM"}</span>

                {isSubmitting ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                ) : (
                  <span aria-hidden="true" className="text-lg leading-none">
                    →
                  </span>
                )}
              </button>

              {isSubmitting && (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-3 text-xs leading-relaxed text-white/65"
                >
                  Validando e processando o arquivo...
                </p>
              )}
            </div>
          </div>

          {/* ==============================
              PRÉ-VISUALIZAÇÃO
              ============================== */}

          <div className="flex min-w-0 flex-col bg-[#181818] p-5 sm:p-6">
            {/* Cabeçalho da prévia */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-[2px] w-7 bg-accent" />

                <h4
                  id={previewTitleId}
                  className="font-mono text-[10px] font-black tracking-[0.13em] text-accent-fg uppercase"
                >
                  IMAGE PREVIEW
                </h4>
              </div>

              <span className="font-mono text-[10px] font-bold text-white/45">T-{trialNumber}</span>
            </div>

            {/* Identificação da imagem */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">{selectedPrisonerName}</p>

                <p className="mt-1 font-mono text-[10px] text-white/45 uppercase">PRISONER ASSET</p>
              </div>

              <span className="border border-white/20 bg-black/30 px-3 py-2 font-mono text-[10px] font-bold tracking-[0.1em] text-white/65 uppercase">
                TRIAL {trialNumber}
              </span>
            </div>

            {/* Painel da imagem */}
            <figure className="flex min-w-0 flex-1 flex-col overflow-hidden border border-white/20 bg-[#101010]">
              <div className="relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden bg-[#0c0c0c] p-4">
                {/* Geometria de fundo */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-14 -right-14 h-52 w-52 rotate-45 border-[20px] border-accent/10"
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 h-7 w-7 border-t-2 border-l-2 border-accent"
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 bottom-0 h-7 w-7 border-r-2 border-b-2 border-accent"
                />

                {selectedFile && previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt={`Pré-visualização do arquivo ${selectedFile.name}`}
                    width={400}
                    height={480}
                    unoptimized
                    className="relative z-10 h-auto max-h-80 w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="relative z-10 flex flex-col items-center gap-4 px-4 py-10 text-center">
                    <span
                      aria-hidden="true"
                      className="flex h-16 w-16 items-center justify-center border border-white/20 bg-white/5 text-3xl text-white/35"
                    >
                      ◇
                    </span>

                    <p className="font-mono text-xs font-bold tracking-[0.13em] text-white/55 uppercase">
                      NO IMAGE SELECTED
                    </p>

                    <p className="max-w-xs text-xs leading-relaxed text-white/40">
                      Selecione um arquivo válido para visualizar a imagem antes do envio.
                    </p>
                  </div>
                )}
              </div>

              {/* Informações do arquivo */}
              <figcaption className="border-t border-white/15 bg-[#1c1c1c] p-4">
                {selectedFile && previewUrl ? (
                  <div className="space-y-3">
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-accent-fg uppercase">
                        FILE NAME
                      </p>

                      <p className="mt-1 text-xs leading-relaxed break-all text-white/80">
                        {selectedFile.name}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <div>
                        <p className="font-mono text-[10px] text-white/45 uppercase">FILE SIZE</p>

                        <p className="mt-1 font-mono text-xs font-bold text-white">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>

                      <span className="border border-[#8ebdc4]/60 bg-[#32555a]/20 px-3 py-2 text-[10px] font-black tracking-[0.08em] text-[#c8e5e9] uppercase">
                        PRONTO PARA ENVIO
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">
                      FILE STATUS
                    </span>

                    <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/60 uppercase">
                      AGUARDANDO ARQUIVO
                    </span>
                  </div>
                )}
              </figcaption>
            </figure>
          </div>
        </div>

        {/* ======================================
            RODAPÉ DO SISTEMA
            ====================================== */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 bg-[#101010] px-5 py-4 sm:px-6">
          <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/40 uppercase">
            MILGRAM / IMAGE MANAGEMENT
          </p>

          <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent-fg uppercase">
            ADMINISTRATIVE ACCESS
          </p>
        </div>

        {/* Linha vermelha inferior */}
        <div
          aria-hidden="true"
          className="h-[3px] bg-linear-to-r from-accent via-accent/50 to-transparent"
        />
      </form>
    </section>
  );
}
