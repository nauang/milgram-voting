import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { JudgePrisoner, VoteChoice } from "@/types/domain";

/**
 * O projeto utiliza Vitest em ambiente Node, sem jsdom ou Testing Library.
 * Este pequeno simulador exercita os handlers e estados reais do JudgeGrid,
 * mantendo os componentes visuais filhos isolados.
 *
 * Não substitui testes de foco, acessibilidade ou navegação no browser.
 */
const hooks = vi.hoisted(() => ({
  slots: [] as Array<{
    value?: unknown;
    deps?: readonly unknown[];
    cleanup?: () => void;
  }>,
  index: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  const sameDeps = (a?: readonly unknown[], b?: readonly unknown[]) =>
    a !== undefined &&
    b !== undefined &&
    a.length === b.length &&
    a.every((value, index) => Object.is(value, b[index]));

  return {
    ...actual,
    useState<T>(initial: T | (() => T)) {
      const index = hooks.index++;
      if (!hooks.slots[index]) {
        hooks.slots[index] = {
          value: typeof initial === "function" ? (initial as () => T)() : initial,
        };
      }
      const setState = (next: T | ((previous: T) => T)) => {
        const slot = hooks.slots[index];
        const previous = slot.value as T;
        slot.value = typeof next === "function" ? (next as (value: T) => T)(previous) : next;
      };
      return [hooks.slots[index].value as T, setState] as const;
    },
    useRef<T>(initial: T) {
      const index = hooks.index++;
      if (!hooks.slots[index]) {
        hooks.slots[index] = { value: { current: initial } };
      }
      return hooks.slots[index].value as { current: T };
    },
    useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]) {
      const index = hooks.index++;
      const slot = hooks.slots[index];
      if (!slot || !sameDeps(slot.deps, deps)) {
        hooks.slots[index] = { value: callback, deps: [...deps] };
        return callback;
      }
      return slot.value as T;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = hooks.index++;
      const slot = hooks.slots[index];
      if (slot && sameDeps(slot.deps, deps)) return;
      slot?.cleanup?.();
      const cleanup = effect();
      hooks.slots[index] = {
        deps: deps ? [...deps] : undefined,
        cleanup: typeof cleanup === "function" ? cleanup : undefined,
      };
    },
  };
});

vi.mock("@/components/PrisonerCard", () => ({
  PrisonerCard: () => null,
}));
vi.mock("@/components/Modal", () => ({
  Modal: () => null,
}));

import { JudgeGrid } from "@/components/JudgeGrid";

type CardNode = ReactElement<{
  prisoner: JudgePrisoner;
  seasonNumber: number;
  onSelect: (id: number) => void;
}>;

type ModalNode = ReactElement<{
  prisoner: JudgePrisoner | null;
  isOpen: boolean;
  status: "idle" | "submitting" | "success" | "error";
  errorMessage?: string;
  onClose: () => void;
  onVote: (choice: VoteChoice) => Promise<void>;
}>;

function makePrisoners(): JudgePrisoner[] {
  return [
    {
      id: 1,
      number: 1,
      slug: "haruka",
      nickname: "Haruka",
      fullName: "Haruka Sakurai",
      imageUrl: "/haruka.webp",
      state: "voting",
    },
    {
      id: 2,
      number: 2,
      slug: "yuno",
      nickname: "Yuno",
      fullName: "Yuno Kashiki",
      imageUrl: "/yuno.webp",
      state: "voting",
    },
  ];
}

function renderGrid(prisoners: JudgePrisoner[], seasonNumber = 1) {
  hooks.index = 0;
  const tree = JudgeGrid({ initialPrisoners: prisoners, seasonNumber }) as ReactElement<{
    children: ReactElement[];
  }>;
  const [list, modal] = tree.props.children;
  const listItems = (
    list as ReactElement<{
      children: ReactElement<{ children: CardNode }>[];
    }>
  ).props.children;

  return {
    cards: listItems.map((item) => item.props.children),
    modal: modal as ModalNode,
  };
}

function unmountGrid() {
  for (const slot of hooks.slots) slot.cleanup?.();
  hooks.index = 0;
  hooks.slots = [];
}

beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  vi.useFakeTimers();
});

afterEach(() => {
  unmountGrid();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("JudgeGrid: estado e modal de votação", () => {
  it("renderiza os cartões com os estados recebidos do servidor", () => {
    const prisoners = makePrisoners();
    const view = renderGrid(prisoners);

    expect(view.cards.map((card) => card.props.prisoner.id)).toEqual([1, 2]);
    expect(view.cards[0].props.prisoner.state).toBe("voting");
    expect(view.modal.props.isOpen).toBe(false);
  });

  it("abre a seleção correta e não permite reenvio quando já votou", async () => {
    const prisoners = makePrisoners();
    prisoners[0] = { ...prisoners[0], state: "voted" };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderGrid(prisoners).cards[0].props.onSelect(1);
    const view = renderGrid(prisoners);

    expect(view.modal.props.prisoner?.id).toBe(1);
    expect(view.modal.props.status).toBe("success");
    await view.modal.props.onVote("forgive");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aplica a atualização do servidor e invalida a seleção anterior", () => {
    const prisoners = makePrisoners();
    renderGrid(prisoners).cards[0].props.onSelect(1);
    expect(renderGrid(prisoners).modal.props.isOpen).toBe(true);

    const updated = makePrisoners();
    updated[0] = {
      ...updated[0],
      imageUrl: "/haruka-novo.webp",
      state: "guilty",
    };

    const view = renderGrid(updated, 2);
    expect(view.cards[0].props.prisoner.imageUrl).toBe("/haruka-novo.webp");
    expect(view.cards[0].props.prisoner.state).toBe("guilty");
    expect(view.modal.props.isOpen).toBe(false);
  });

  it("marca apenas o prisioneiro votado e envia os campos esperados", async () => {
    const prisoners = makePrisoners();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    renderGrid(prisoners).cards[0].props.onSelect(1);
    await renderGrid(prisoners).modal.props.onVote("forgive");
    const view = renderGrid(prisoners);

    expect(view.cards.map((card) => card.props.prisoner.state)).toEqual(["voted", "voting"]);
    expect(view.modal.props.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vote",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prisonerId: 1, choice: "forgive" }),
      }),
    );
  });

  it("fecha automaticamente o modal somente após 1,5 segundo", async () => {
    const prisoners = makePrisoners();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    renderGrid(prisoners).cards[0].props.onSelect(1);
    await renderGrid(prisoners).modal.props.onVote("forgive");

    vi.advanceTimersByTime(1499);
    expect(renderGrid(prisoners).modal.props.isOpen).toBe(true);

    vi.advanceTimersByTime(1);
    expect(renderGrid(prisoners).modal.props.isOpen).toBe(false);
  });

  it("cancela o fechamento antigo ao abrir outro prisioneiro", async () => {
    const prisoners = makePrisoners();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    renderGrid(prisoners).cards[0].props.onSelect(1);
    await renderGrid(prisoners).modal.props.onVote("forgive");
    const success = renderGrid(prisoners);
    success.modal.props.onClose();

    renderGrid(prisoners).cards[1].props.onSelect(2);
    vi.advanceTimersByTime(1500);

    const current = renderGrid(prisoners);
    expect(current.modal.props.isOpen).toBe(true);
    expect(current.modal.props.prisoner?.id).toBe(2);
    expect(current.modal.props.status).toBe("idle");
  });

  it("reconhece ALREADY_VOTED como voto existente", async () => {
    const prisoners = makePrisoners();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ code: "ALREADY_VOTED" }),
      }),
    );

    renderGrid(prisoners).cards[0].props.onSelect(1);
    await renderGrid(prisoners).modal.props.onVote("not_forgive");

    expect(renderGrid(prisoners).cards[0].props.prisoner.state).toBe("voted");
    expect(renderGrid(prisoners).modal.props.status).toBe("success");
  });

  it("não interpreta outros erros HTTP 409 como voto registrado", async () => {
    const prisoners = makePrisoners();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ code: "SEASON_CLOSED", error: "Votação encerrada." }),
      }),
    );

    renderGrid(prisoners).cards[0].props.onSelect(1);
    await renderGrid(prisoners).modal.props.onVote("forgive");
    const view = renderGrid(prisoners);

    expect(view.cards[0].props.prisoner.state).toBe("voting");
    expect(view.modal.props.status).toBe("error");
    expect(view.modal.props.errorMessage).toBe("Votação encerrada.");
  });

  it("informa erros de rede sem marcar voto como concluído", async () => {
    const prisoners = makePrisoners();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Rede indisponível")));

    renderGrid(prisoners).cards[0].props.onSelect(1);
    await renderGrid(prisoners).modal.props.onVote("forgive");
    const view = renderGrid(prisoners);

    expect(view.cards[0].props.prisoner.state).toBe("voting");
    expect(view.modal.props.status).toBe("error");
    expect(view.modal.props.errorMessage).toBe("Erro de rede. Tente novamente.");
  });

  it("impede duas requisições simultâneas de voto", async () => {
    const prisoners = makePrisoners();
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderGrid(prisoners).cards[0].props.onSelect(1);
    const first = renderGrid(prisoners).modal.props.onVote("forgive");
    const second = renderGrid(prisoners).modal.props.onVote("not_forgive");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch({ ok: true, status: 200 } as Response);
    await Promise.all([first, second]);
    expect(renderGrid(prisoners).cards[0].props.prisoner.state).toBe("voted");
  });

  it("cancela uma requisição pendente ao desmontar o componente", () => {
    const prisoners = makePrisoners();
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    renderGrid(prisoners).cards[0].props.onSelect(1);
    void renderGrid(prisoners).modal.props.onVote("forgive");

    const options = fetchMock.mock.calls[0]?.[1] as { signal: AbortSignal };
    expect(options.signal.aborted).toBe(false);
    unmountGrid();
    expect(options.signal.aborted).toBe(true);
  });
});
