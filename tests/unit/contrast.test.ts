import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AA_NORMAL_TEXT = 4.5;
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) {
    throw new Error(`Token --${name} não encontrado em globals.css`);
  }
  return match[1];
}

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const red = channelToLinear(parseInt(hex.slice(1, 3), 16));
  const green = channelToLinear(parseInt(hex.slice(3, 5), 16));
  const blue = channelToLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(colorA: string, colorB: string): number {
  const luminanceA = luminance(colorA);
  const luminanceB = luminance(colorB);
  return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05);
}

/** Cor resultante de branco com opacidade `alpha` sobre um fundo opaco (ex.: text-white/60). */
function whiteOver(backgroundHex: string, alpha: number): string {
  const mixed = [1, 3, 5].map((start) => {
    const channel = parseInt(backgroundHex.slice(start, start + 2), 16);
    return Math.round(channel + (255 - channel) * alpha)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${mixed.join("")}`;
}

const background = token("bg");
const card = token("card");

describe("contraste das cores do tema (WCAG AA, texto normal)", () => {
  it.each([
    ["texto branco", token("fg"), background],
    ["texto branco", token("fg"), card],
    ["magenta de TEXTO (--accent-text)", token("accent-text"), background],
    ["magenta de TEXTO (--accent-text)", token("accent-text"), card],
    ["texto branco sobre botão magenta (--accent)", token("fg"), token("accent")],
  ])("%s sobre %s passa em ≥ 4,5:1", (_label, foreground, surface) => {
    expect(contrastRatio(foreground, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each([0.5, 0.6, 0.7])("text-white/%s passa sobre o fundo e sobre o card", (alpha) => {
    for (const surface of [background, card]) {
      expect(contrastRatio(whiteOver(surface, alpha), surface)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    }
  });

  it("DOCUMENTA o problema: o magenta de marca em texto pequeno NÃO passa sobre o card", () => {
    expect(contrastRatio(token("accent"), card)).toBeLessThan(AA_NORMAL_TEXT);
  });
});
