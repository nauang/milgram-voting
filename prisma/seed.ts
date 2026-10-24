import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const TOTAL_SEASONS = 3;
const FIRST_SEASON = 1;

// Dados do PROMPT §9 (extraídos do judge.html oficial)
const PRISONERS = [
  { number: 1, nickname: "ハルカ", fullName: "櫻井 遥", slug: "haruka" },
  { number: 2, nickname: "ユノ", fullName: "樫木 優乃", slug: "yuno" },
  { number: 3, nickname: "フータ", fullName: "梶山 風汰", slug: "futa" },
  { number: 4, nickname: "ムウ", fullName: "楠 夢羽", slug: "mu" },
  { number: 5, nickname: "シドウ", fullName: "桐崎 獅童", slug: "shidou" },
  { number: 6, nickname: "マヒル", fullName: "椎奈 真昼", slug: "mahiru" },
  { number: 7, nickname: "カズイ", fullName: "椋原 一威", slug: "kazui" },
  { number: 8, nickname: "アマネ", fullName: "桃瀬 遍", slug: "amane" },
  { number: 9, nickname: "ミコト", fullName: "榧野 尊", slug: "mikoto" },
  { number: 10, nickname: "コトコ", fullName: "杠 琴子", slug: "kotoko" },
] as const;

// "/png" evita o SVG padrão do placehold.co, que o next/image bloqueia
function buildPlaceholderUrl(slug: string, season: number): string {
  return `https://placehold.co/600x800/000000/E4007F/png?text=${slug}+S${season}`;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não definida. Copie .env.example para .env.local.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

  try {
    // Temporadas: só a 1ª começa em "voting". O seed é idempotente, então `update: {}`
    // é proposital: rodar de novo NUNCA pode reabrir ou resetar uma temporada em andamento.
    for (let number = FIRST_SEASON; number <= TOTAL_SEASONS; number++) {
      const isFirstSeason = number === FIRST_SEASON;
      await prisma.season.upsert({
        where: { number },
        update: {},
        create: {
          number,
          status: isFirstSeason ? "voting" : "idle",
          startsAt: isFirstSeason ? new Date() : null,
          // endsAt fica nulo: encerramento manual pelo admin (decisão E3)
        },
      });
    }

    for (const data of PRISONERS) {
      // Dados cadastrais podem ser corrigidos pelo seed...
      const prisoner = await prisma.prisoner.upsert({
        where: { slug: data.slug },
        update: { number: data.number, nickname: data.nickname, fullName: data.fullName },
        create: { ...data },
      });

      // ...mas as imagens não: `update: {}` preserva uploads reais feitos pelo /admin
      for (let season = FIRST_SEASON; season <= TOTAL_SEASONS; season++) {
        await prisma.image.upsert({
          where: { prisonerId_season: { prisonerId: prisoner.id, season } },
          update: {},
          create: { prisonerId: prisoner.id, season, url: buildPlaceholderUrl(data.slug, season) },
        });
      }
    }

    // Confere o resultado: falhar alto é melhor que seed incompleto (decisão E5)
    const prisonerCount = await prisma.prisoner.count();
    const imageCount = await prisma.image.count();
    const seasons = await prisma.season.findMany({ orderBy: { number: "asc" } });

    if (prisonerCount !== PRISONERS.length) {
      throw new Error(`Esperado ${PRISONERS.length} prisioneiros, encontrado ${prisonerCount}.`);
    }
    if (imageCount !== PRISONERS.length * TOTAL_SEASONS) {
      throw new Error(
        `Esperado ${PRISONERS.length * TOTAL_SEASONS} imagens, encontrado ${imageCount}.`,
      );
    }

    const summary = seasons.map((s) => `T${s.number}=${s.status}`).join(" ");
    process.stdout.write(
      `Seed ok: ${prisonerCount} prisioneiros, ${imageCount} imagens, ${summary}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
