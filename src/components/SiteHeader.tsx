"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Cabeçalho do MILGRAM Voting.
 *
 * Utiliza a fonte MILGRAM English na identidade
 * principal e mantém a tipografia convencional
 * nos elementos de navegação.
 *
 * Breakpoints:
 * - Mobile e tablet: abaixo de 960px.
 * - Desktop: a partir de 960px.
 */

const NAV_ITEMS = [
  {
    href: "/",
    label: "Início",
    number: "01",
  },
  {
    href: "/judge",
    label: "Julgamento",
    number: "02",
  },
  {
    href: "/character",
    label: "Personagens",
    number: "03",
  },
] as const;

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-white/15 bg-[#141414]/95 backdrop-blur-md">
      {/* Linha decorativa inferior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-accent via-[#681316] to-transparent"
      />

      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logotipo MILGRAM */}
        <Link
          href="/"
          onClick={closeMenu}
          className="group flex min-w-0 shrink-0 items-center gap-3 border-l-[3px] border-accent pl-3"
          aria-label="MILGRAM Voting — Página inicial"
        >
          <span className="flex flex-col justify-center">
            {/* Fonte oficial personalizada */}
            <span className="milgram-display text-[21px] leading-none font-normal tracking-[0.06em] text-white transition-colors group-hover:text-accent-fg sm:text-[23px]">
              MILGRAM
            </span>

            {/* Identificação do projeto */}
            <span className="mt-1 text-[8px] leading-none font-bold tracking-[0.3em] text-accent-fg">
              VOTING SYSTEM
            </span>
          </span>
        </Link>

        {/* Menu mobile */}
        <button
          type="button"
          onClick={() => setMenuOpen((previous) => !previous)}
          aria-label={menuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
          aria-controls="site-navigation"
          aria-expanded={menuOpen}
          className="flex min-h-11 min-w-11 items-center justify-center gap-3 border border-white/20 bg-black/30 px-3 text-white transition-colors hover:border-accent hover:text-accent-fg lg:hidden"
        >
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase">Menu</span>

          <span
            aria-hidden="true"
            className="flex h-4 w-5 flex-col items-center justify-center gap-1"
          >
            <span
              className={`block h-[2px] w-5 bg-current motion-safe:transition-transform ${
                menuOpen ? "translate-y-[6px] rotate-45" : ""
              }`}
            />

            <span
              className={`block h-[2px] w-5 bg-current motion-safe:transition-opacity ${
                menuOpen ? "opacity-0" : ""
              }`}
            />

            <span
              className={`block h-[2px] w-5 bg-current motion-safe:transition-transform ${
                menuOpen ? "-translate-y-[6px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>

        {/* Navegação principal */}
        <nav
          id="site-navigation"
          aria-label="Navegação principal"
          className={`absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-accent/50 bg-[#141414] shadow-[0_18px_35px_rgba(0,0,0,0.65)] lg:static lg:block lg:h-full lg:max-h-none lg:overflow-visible lg:border-0 lg:bg-transparent lg:shadow-none ${
            menuOpen ? "block" : "hidden"
          }`}
        >
          <ul className="flex flex-col gap-1 px-4 py-4 lg:h-full lg:flex-row lg:items-stretch lg:gap-1 lg:p-0">
            {NAV_ITEMS.map((item) => {
              const active = isActiveRoute(pathname, item.href);

              return (
                <li key={item.href} className="lg:flex">
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex min-h-12 items-center gap-3 border-l-2 px-4 py-3 text-sm font-bold tracking-[0.12em] uppercase transition-colors lg:h-full lg:min-h-0 lg:gap-2 lg:border-l-0 lg:px-4 lg:py-0 lg:text-xs ${
                      active
                        ? "border-accent bg-accent/10 text-white"
                        : "border-transparent text-white/70 hover:border-accent/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`font-mono text-[10px] tracking-normal ${
                        active ? "text-accent-fg" : "text-white/40 group-hover:text-accent-fg"
                      }`}
                    >
                      {item.number}
                    </span>

                    <span>{item.label}</span>

                    {/* Indicador da rota ativa — desktop */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-0 hidden h-[3px] w-full bg-accent lg:block"
                      />
                    )}

                    {/* Indicador da rota ativa — mobile */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="ml-auto h-2 w-2 rotate-45 bg-accent lg:hidden"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Rodapé decorativo do menu mobile */}
          <div
            aria-hidden="true"
            className="flex items-center gap-3 border-t border-white/10 px-5 py-4 lg:hidden"
          >
            <span className="h-[2px] w-6 bg-accent" />

            <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">
              MILGRAM / Voting System
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
}
