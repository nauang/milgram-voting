import type { Metadata } from "next";

import { AuthError, CredentialsSignin } from "next-auth";

import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

/* ==========================================
   METADADOS
   ========================================== */

export const metadata: Metadata = {
  title: "MILGRAM | Login administrativo",
  description: "Acesso restrito ao painel administrativo do MILGRAM Voting.",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  searchParams: Promise<{
    error?: string;
    code?: string;
  }>;
}

/* ==========================================
   AUTENTICAÇÃO ADMINISTRATIVA
   ========================================== */

/**
 * Server Action original de autenticação.
 *
 * Preserva:
 * - Auth.js;
 * - Login por credenciais;
 * - Tratamento de rate limiting;
 * - Mensagens genéricas de erro;
 * - Redirecionamento após login;
 * - Não divulgação de detalhes internos.
 */
async function loginAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "rate_limited") {
        redirect("/admin/login?error=rate_limited");
      }

      redirect("/admin/login?error=credentials");
    }

    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        redirect("/admin/login?error=credentials");
      }

      console.error("Erro na autenticação administrativa:", error.type);

      redirect("/admin/login?error=server");
    }

    // Preserva os redirects internos
    // utilizados pelo Next.js e Auth.js.
    throw error;
  }

  redirect("/admin");
}

/* ==========================================
   PÁGINA DE LOGIN
   ========================================== */

export default async function AdminLoginPage({ searchParams }: PageProps) {
  /* ======================================
     VERIFICAÇÃO DA SESSÃO
     ====================================== */

  const session = await auth();

  if (session) {
    redirect("/admin");
  }

  /* ======================================
     TRATAMENTO DE ERROS
     ====================================== */

  const { error, code } = await searchParams;

  let errorMessage: string | null = null;

  if (error === "rate_limited" || (error === "CredentialsSignin" && code === "rate_limited")) {
    errorMessage = "Muitas tentativas. Tente novamente em 15 minutos.";
  } else if (error === "credentials" || error === "CredentialsSignin") {
    errorMessage = "Email ou senha incorretos.";
  } else if (error === "server") {
    errorMessage = "Não foi possível realizar o login. Tente novamente mais tarde.";
  }

  /* ==========================================
     INTERFACE
     ========================================== */

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-6 lg:py-16"
    >
      <div className="grid w-full min-w-0 overflow-hidden border border-white/20 bg-[#141414] shadow-[0_25px_70px_rgba(0,0,0,0.45)] lg:grid-cols-[1fr_1fr]">
        {/* ==================================
            IDENTIDADE MILGRAM
            ================================== */}

        <section
          aria-label="MILGRAM Administrative System"
          className="relative isolate flex min-h-[260px] flex-col justify-between overflow-hidden border-b border-white/15 bg-[#211617] p-6 sm:min-h-[330px] sm:p-9 lg:min-h-[560px] lg:border-r lg:border-b-0 lg:p-12"
        >
          {/* Fundo geométrico */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#421a1d] via-[#211617] to-[#101010]"
          />

          {/* Quadrado diagonal */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-36 h-[360px] w-[360px] rotate-45 border-[38px] border-accent/15 lg:h-[480px] lg:w-[480px]"
          />

          {/* Segunda geometria */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-36 -left-28 h-[320px] w-[320px] rotate-45 border-[28px] border-white/5"
          />

          {/* Código decorativo */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 bottom-8 font-mono text-[130px] leading-none font-black text-white/5 sm:text-[180px]"
          >
            01
          </span>

          {/* Identificação superior */}
          <div className="relative z-10 flex flex-wrap items-center gap-3">
            <span aria-hidden="true" className="h-[2px] w-8 bg-accent" />

            <p className="font-mono text-[10px] font-black tracking-[0.15em] text-accent-fg uppercase">
              MILGRAM / SYSTEM ACCESS
            </p>
          </div>

          {/* Logotipo e descrição */}
          <div className="relative z-10 my-10">
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-accent-fg uppercase">
              AUTHORIZATION REQUIRED
            </p>

            <p className="milgram-display mt-5 text-[clamp(3.5rem,10vw,6.5rem)] leading-none text-white">
              MILGRAM
            </p>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-[3px] w-11 bg-accent" />

              <span className="h-px flex-1 bg-white/20" />
            </div>

            <p className="mt-6 text-xl font-black tracking-[0.1em] text-white uppercase sm:text-2xl">
              ADMINISTRATIVE SYSTEM
            </p>

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              Sistema de gerenciamento dos julgamentos, prisioneiros e registros do MILGRAM Voting.
            </p>
          </div>

          {/* Rodapé da identidade */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/45 uppercase">
              RESTRICTED AREA
            </p>

            <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 border-2 border-accent" />
          </div>

          {/* Linha vermelha inferior */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 z-20 h-[3px] bg-linear-to-r from-accent via-accent/45 to-transparent lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[3px]"
          />
        </section>

        {/* ==================================
            FORMULÁRIO DE AUTENTICAÇÃO
            ================================== */}

        <section
          aria-labelledby="admin-login-title"
          className="relative flex min-w-0 flex-col justify-center bg-[#191919] px-5 py-9 sm:px-9 sm:py-12 lg:px-12"
        >
          {/* Identificação */}
          <div className="mb-8">
            <div className="mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="h-[2px] w-8 bg-accent" />

              <p className="font-mono text-[10px] font-black tracking-[0.13em] text-accent-fg uppercase">
                IDENTIFICATION REQUIRED
              </p>
            </div>

            {/* Título */}
            <h1
              id="admin-login-title"
              className="milgram-display text-[clamp(2.8rem,8vw,4.5rem)] leading-tight text-white"
            >
              ADMIN LOGIN
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-white/65">
              Insira suas credenciais administrativas para acessar a central de controle.
            </p>
          </div>

          {/* ==============================
              MENSAGEM DE ERRO
              ============================== */}

          {errorMessage && (
            <div
              id="login-error"
              role="alert"
              aria-live="assertive"
              className="mb-6 border-l-[3px] border-accent bg-accent/10 p-4"
            >
              <p className="mb-2 font-mono text-[10px] font-black tracking-[0.12em] text-accent-fg uppercase">
                AUTHENTICATION ERROR
              </p>

              <p className="text-sm leading-relaxed text-white/85">{errorMessage}</p>
            </div>
          )}

          {/* ==============================
              FORMULÁRIO ORIGINAL
              ============================== */}

          <form action={loginAction} className="flex min-w-0 flex-col gap-6">
            {/* Email */}
            <div className="space-y-3">
              <label htmlFor="admin-login-email" className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] font-black text-accent-fg"
                >
                  01
                </span>

                <span className="text-xs font-black tracking-[0.12em] text-white uppercase">
                  EMAIL
                </span>
              </label>

              <input
                id="admin-login-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="Email administrativo"
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={errorMessage ? "login-error" : undefined}
                className="min-h-12 w-full min-w-0 border border-white/25 bg-[#101010] px-4 py-3 text-sm text-white transition-colors outline-none placeholder:text-white/40 hover:border-white/40 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
              />
            </div>

            {/* Senha */}
            <div className="space-y-3">
              <label htmlFor="admin-login-password" className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] font-black text-accent-fg"
                >
                  02
                </span>

                <span className="text-xs font-black tracking-[0.12em] text-white uppercase">
                  SENHA
                </span>
              </label>

              <input
                id="admin-login-password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="Sua senha"
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={errorMessage ? "login-error" : undefined}
                className="min-h-12 w-full min-w-0 border border-white/25 bg-[#101010] px-4 py-3 text-sm text-white transition-colors outline-none placeholder:text-white/40 hover:border-white/40 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
              />
            </div>

            {/* Botão de autenticação */}
            <button
              type="submit"
              className="mt-2 inline-flex min-h-12 w-full items-center justify-between gap-4 border border-accent bg-accent px-5 py-3 text-left text-xs font-black tracking-[0.13em] text-white uppercase transition-colors hover:bg-[#bc1016] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg"
            >
              <span>ACESSAR PAINEL</span>

              <span aria-hidden="true" className="text-lg leading-none">
                →
              </span>
            </button>
          </form>

          {/* ==================================
              RODAPÉ DO FORMULÁRIO
              ================================== */}

          <div className="mt-9 border-t border-white/15 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-white/40 uppercase">
                MILGRAM / ADMIN ACCESS
              </p>

              <span aria-hidden="true" className="flex items-center gap-2">
                <span className="h-[2px] w-5 bg-accent" />

                <span className="font-mono text-[10px] font-bold tracking-wider text-accent-fg">
                  001
                </span>
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
