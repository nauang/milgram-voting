import Link from "next/link";

// Menu hambúrguer do mobile (wireframe) entra na etapa de refino visual.
// Por ora o "Início" some no mobile (o logo já leva para "/") para caber em 320px.
export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-white/10 bg-black/70 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="inline-block py-3 text-sm font-bold tracking-[0.15em]">
          MILGRAM
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-4 text-[0.7rem] tracking-wider uppercase lg:gap-6 lg:text-xs">
            <li className="hidden sm:block">
              <Link href="/" className="inline-block py-3 hover:text-accent-fg">
                Início
              </Link>
            </li>
            <li>
              <Link href="/judge" className="inline-block py-3 hover:text-accent-fg">
                Julgamento
              </Link>
            </li>
            <li>
              <Link href="/character" className="inline-block py-3 hover:text-accent-fg">
                Personagens
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
