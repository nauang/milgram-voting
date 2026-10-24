import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    // next-auth lança um erro de redirect; só re-lançamos
    throw error;
  }
}

export default async function AdminLoginPage() {
  const session = await auth();
  if (session) {
    redirect("/admin");
  }

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16"
    >
      <h1 className="mb-2 text-3xl font-bold tracking-[0.15em] uppercase">Admin</h1>
      <p className="mb-8 text-sm text-white/70">Acesso restrito ao painel de controle.</p>

      <form action={loginAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wider uppercase">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="border border-white/20 bg-black px-3 py-2 text-white focus-visible:border-accent focus-visible:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wider uppercase">Senha</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="border border-white/20 bg-black px-3 py-2 text-white focus-visible:border-accent focus-visible:outline-none"
          />
        </label>

        <button
          type="submit"
          className="mt-2 border border-accent bg-accent px-4 py-2 font-bold text-white transition-colors hover:bg-accent-2"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
