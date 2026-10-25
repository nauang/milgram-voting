import { signOut, auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SeasonControl } from "@/components/admin/SeasonControl";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session) {
    redirect("/admin/login");
  }

  const seasons = await prisma.season.findMany({ orderBy: { number: "asc" } });

  // Contagem de votos por prisioneiro na temporada ativa (ou última encerrada)
  const active =
    seasons.find((s) => s.status === "voting") ??
    seasons.filter((s) => s.status === "closed").pop();
  const voteCounts = active
    ? await prisma.vote.groupBy({
        by: ["prisonerId", "choice"],
        where: { seasonId: active.id },
        _count: true,
      })
    : [];

  const prisoners = await prisma.prisoner.findMany({ orderBy: { number: "asc" } });
  const countsByPrisoner = new Map<number, { forgive: number; notForgive: number }>();
  for (const c of voteCounts) {
    const current = countsByPrisoner.get(c.prisonerId) ?? { forgive: 0, notForgive: 0 };
    if (c.choice === "forgive") current.forgive = c._count;
    else current.notForgive = c._count;
    countsByPrisoner.set(c.prisonerId, current);
  }

  return (
    <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-[0.15em] uppercase">Admin</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/login" });
          }}
        >
          <button
            type="submit"
            className="border border-white/20 px-4 py-2 text-sm hover:border-accent hover:text-accent-fg"
          >
            Sair
          </button>
        </form>
      </div>

      <section className="mb-8 border border-white/20 p-4">
        <h2 className="mb-4 text-lg font-bold">Temporadas</h2>
        <ul className="mb-4 flex flex-wrap gap-2">
          {seasons.map((s) => (
            <li
              key={s.id}
              className={`border px-3 py-1 text-xs font-bold tracking-wider uppercase ${
                s.status === "voting"
                  ? "border-accent bg-accent text-white"
                  : s.status === "closed"
                    ? "border-white/60 text-white/80"
                    : "border-white/20 text-white/50"
              }`}
            >
              T{s.number} · {s.status}
            </li>
          ))}
        </ul>

        <SeasonControl seasons={seasons} />
      </section>

      {active && (
        <section className="border border-white/20 p-4">
          <h2 className="mb-4 text-lg font-bold">
            Votos da temporada {active.number} ({active.status})
          </h2>
          <table className="w-full text-sm">
            <thead className="border-b border-white/20 text-left text-xs tracking-wider text-white/60 uppercase">
              <tr>
                <th className="py-2">No.</th>
                <th className="py-2">Prisioneiro</th>
                <th className="py-2 text-right">Perdoar</th>
                <th className="py-2 text-right">Não perdoar</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {prisoners.map((p) => {
                const c = countsByPrisoner.get(p.id) ?? { forgive: 0, notForgive: 0 };
                return (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="py-2 text-white/60">No.{String(p.number).padStart(2, "0")}</td>
                    <td className="py-2">{p.nickname}</td>
                    <td className="py-2 text-right text-white/80">{c.forgive}</td>
                    <td className="py-2 text-right text-accent-fg">{c.notForgive}</td>
                    <td className="py-2 text-right font-bold">{c.forgive + c.notForgive}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
