import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentSeason } from "@/lib/season";
import { getPrisonerImage } from "@/lib/prisoner-image";
import { GlitchText } from "@/components/GlitchText";
import { formatPrisonerNumber } from "@/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MILGRAM | Prisioneiros",
  description: "Conheça os 10 prisioneiros do MILGRAM e seus guias.",
};

export default async function CharacterListPage() {
  const currentSeason = await getCurrentSeason();
  const prisoners = await prisma.prisoner.findMany({
    orderBy: { number: "asc" },
    include: { images: true },
  });

  return (
    <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <GlitchText as="h1" className="text-3xl font-bold tracking-[0.15em] uppercase lg:text-5xl">
          Prisioneiros
        </GlitchText>
        <p className="max-w-2xl text-sm text-white/70">
          10 pessoas condenadas por crimes que elas mesmas esqueceram. Conheça cada uma.
        </p>
      </div>

      <section aria-labelledby="titulo-prisioneiros">
        <h2 id="titulo-prisioneiros" className="sr-only">
          Lista de prisioneiros
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {prisoners.map((prisoner) => {
            const image = getPrisonerImage(prisoner.images, currentSeason.number);
            const numberLabel = formatPrisonerNumber(prisoner.number);
            return (
              <li key={prisoner.id}>
                <Link
                  href={`/character/${prisoner.slug}`}
                  className="group block border border-white/20 bg-card transition-all focus-visible:ring-4 focus-visible:ring-accent/50 focus-visible:outline-none motion-safe:hover:scale-[1.03] motion-safe:hover:border-accent motion-safe:hover:shadow-[0_0_24px_rgba(228,0,127,0.4)]"
                >
                  <figure className="relative aspect-[3/4] w-full overflow-hidden">
                    {image?.url ? (
                      <Image
                        src={image.url}
                        alt={`Retrato de ${prisoner.nickname}, ${numberLabel}, temporada ${currentSeason.number}`}
                        fill
                        sizes="(min-width: 960px) 20vw, (min-width: 560px) 33vw, 50vw"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-black text-xs text-white/70">
                        Sem imagem
                      </div>
                    )}
                    <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/95 to-transparent px-3 pt-8 pb-2 text-xs font-bold tracking-[0.15em] text-accent">
                      {numberLabel}
                    </figcaption>
                  </figure>
                  <div className="p-3">
                    <h3 className="text-base font-bold tracking-wide group-hover:text-accent">
                      {prisoner.nickname}
                    </h3>
                    <p className="text-xs text-white/70">{prisoner.fullName}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
