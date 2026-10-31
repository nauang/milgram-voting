import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");

// Únicos arquivos autorizados a calcular hashes: o voterKey e o hash de IP do rate limit
const FILES_ALLOWED_TO_HASH = ["lib/voter-key.ts", "lib/rate-limit.ts"];

function listSourceFiles(): string[] {
  return readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .map((path) => path.split(sep).join("/"))
    .filter((path) => !path.startsWith("generated/"));
}

function filesContaining(text: string): string[] {
  return listSourceFiles().filter((path) =>
    readFileSync(join(SRC_DIR, path), "utf8").includes(text),
  );
}

describe("voterKey com fonte única", () => {
  it("nenhum arquivo usa o salt padrão público", () => {
    expect(filesContaining("dev-salt-change-me")).toEqual([]);
  });

  it("só voter-key.ts e rate-limit.ts calculam hashes", () => {
    const hashingFiles = filesContaining("createHash(");
    expect(hashingFiles.filter((path) => !FILES_ALLOWED_TO_HASH.includes(path))).toEqual([]);
  });
});
