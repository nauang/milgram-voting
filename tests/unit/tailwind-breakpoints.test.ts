import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

// O @theme do globals.css apaga os breakpoints padrão e define só sm, lg e xl.
// Classes com md: ou 2xl: não geram CSS e não dão erro.
const REMOVED_BREAKPOINT_CLASS = /(?<![\w-])(md|2xl):/;

function listSourceFiles(): string[] {
  return readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .map((path) => path.split(sep).join("/"))
    .filter((path) => !path.startsWith("generated/"));
}

describe("breakpoints do Tailwind", () => {
  it("nenhum arquivo usa md: ou 2xl: (breakpoints removidos no globals.css)", () => {
    const offenders = listSourceFiles().filter((path) =>
      REMOVED_BREAKPOINT_CLASS.test(readFileSync(join(SRC_DIR, path), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
