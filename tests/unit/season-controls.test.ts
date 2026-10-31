import { describe, expect, it } from "vitest";
import { getSeasonControls } from "@/lib/season-controls";

const build = (...statuses: string[]) =>
  statuses.map((status, index) => ({ number: index + 1, status }));

describe("getSeasonControls", () => {
  it("com T1 em votação, NÃO oferece iniciar T2 (o servidor recusaria com 409)", () => {
    expect(getSeasonControls(build("voting", "idle", "idle"))).toEqual({
      startableSeason: null,
      closableSeason: { number: 1, canStartNext: true },
      isFinished: false,
    });
  });

  it("tudo idle: oferece iniciar a T1", () => {
    expect(getSeasonControls(build("idle", "idle", "idle")).startableSeason).toBe(1);
  });

  it("depois de 'Encerrar e aguardar': oferece iniciar a T2 e nada para encerrar", () => {
    expect(getSeasonControls(build("closed", "idle", "idle"))).toEqual({
      startableSeason: 2,
      closableSeason: null,
      isFinished: false,
    });
  });

  it("na T3 em votação não há próxima temporada", () => {
    expect(getSeasonControls(build("closed", "closed", "voting")).closableSeason).toEqual({
      number: 3,
      canStartNext: false,
    });
  });

  it("canStartNext é falso se a próxima não está idle", () => {
    expect(getSeasonControls(build("voting", "closed", "idle")).closableSeason?.canStartNext).toBe(
      false,
    );
  });

  it("T3 encerrada: finalizado, sem botões", () => {
    expect(getSeasonControls(build("closed", "closed", "closed"))).toEqual({
      startableSeason: null,
      closableSeason: null,
      isFinished: true,
    });
  });

  it("não depende da ordem em que as temporadas chegam", () => {
    const shuffled = build("closed", "voting", "idle").reverse();
    expect(getSeasonControls(shuffled).closableSeason).toEqual({ number: 2, canStartNext: true });
  });

  it("não oferece iniciar uma temporada cuja anterior não está encerrada", () => {
    expect(getSeasonControls([{ number: 3, status: "idle" }]).startableSeason).toBeNull();
  });
});
