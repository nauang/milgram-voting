import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest, NextResponse } from "next/server";

import { TOTAL_SEASONS } from "@/lib/constants";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isSameOriginRequest: vi.fn(),
  crossOriginResponse: vi.fn(),
  revalidatePath: vi.fn(),

  transaction: vi.fn(),
  executeRaw: vi.fn(),

  findSeasons: vi.fn(),
  updateSeasons: vi.fn(),
  deleteSeasons: vi.fn(),

  deleteVotes: vi.fn(),
  deleteResults: vi.fn(),

  deleteImages: vi.fn(),
  updateImages: vi.fn(),

  deletePrisoners: vi.fn(),
  updatePrisoners: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/csrf", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest,
  crossOriginResponse: mocks.crossOriginResponse,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { POST } from "@/app/api/admin/season/[action]/route";

const RESET_BODY = {
  confirm: true,
  confirmation: "RESETAR TEMPORADAS",
} as const;

const INITIAL_SEASONS = Array.from({ length: TOTAL_SEASONS }, (_, index) => ({
  number: index + 1,
}));

/**
 * Simula o cliente transacional do Prisma.
 *
 * Incluímos Image e Prisoner para verificar
 * explicitamente que seus dados não são
 * modificados durante o reset.
 */
const transactionClient = {
  $executeRaw: mocks.executeRaw,

  season: {
    findMany: mocks.findSeasons,
    updateMany: mocks.updateSeasons,
    deleteMany: mocks.deleteSeasons,
  },

  vote: {
    deleteMany: mocks.deleteVotes,
  },

  result: {
    deleteMany: mocks.deleteResults,
  },

  image: {
    deleteMany: mocks.deleteImages,
    updateMany: mocks.updateImages,
  },

  prisoner: {
    deleteMany: mocks.deletePrisoners,
    updateMany: mocks.updatePrisoners,
  },
};

type TransactionCallback = (client: typeof transactionClient) => Promise<unknown>;

/**
 * Executa a rota diretamente, sem servidor HTTP
 * e sem conexão com o banco de dados.
 */
async function requestSeasonAction(body: unknown = RESET_BODY, action = "reset") {
  const request = new NextRequest(`http://localhost:3000/api/admin/season/${action}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const response = await POST(request, {
    params: Promise.resolve({ action }),
  });

  const payload: unknown = await response.json();

  return {
    response,
    payload,
  };
}

describe("POST /api/admin/season/reset", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.auth.mockResolvedValue({
      user: {
        email: "admin@example.test",
      },
    });

    mocks.isSameOriginRequest.mockReturnValue(true);

    mocks.crossOriginResponse.mockReturnValue(
      NextResponse.json({ error: "Origem não permitida" }, { status: 403 }),
    );

    mocks.executeRaw.mockResolvedValue(1);

    mocks.findSeasons.mockResolvedValue(INITIAL_SEASONS);

    mocks.updateSeasons.mockResolvedValue({
      count: TOTAL_SEASONS,
    });

    mocks.deleteResults.mockResolvedValue({
      count: 30,
    });

    mocks.deleteVotes.mockResolvedValue({
      count: 150,
    });

    /**
     * Executa somente a função de transação
     * contra o cliente simulado.
     *
     * Nenhuma transação real é aberta.
     */
    mocks.transaction.mockImplementation(async (callback: TransactionCallback) =>
      callback(transactionClient),
    );
  });

  describe("autorização e segurança", () => {
    it("rejeita requisições de outra origem", async () => {
      mocks.isSameOriginRequest.mockReturnValue(false);

      const { response } = await requestSeasonAction();

      expect(response.status).toBe(403);

      expect(mocks.crossOriginResponse).toHaveBeenCalledOnce();

      expect(mocks.auth).not.toHaveBeenCalled();

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejeita usuários não autenticados", async () => {
      mocks.auth.mockResolvedValue(null);

      const { response, payload } = await requestSeasonAction();

      expect(response.status).toBe(401);

      expect(payload).toMatchObject({
        error: "Não autorizado",
      });

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejeita ações desconhecidas", async () => {
      const { response, payload } = await requestSeasonAction(RESET_BODY, "unknown");

      expect(response.status).toBe(400);

      expect(payload).toMatchObject({
        code: "UNKNOWN_ACTION",
      });

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
      null,
      {},
      {
        confirm: false,
        confirmation: "RESETAR TEMPORADAS",
      },
    ])("exige confirmação explícita para o corpo %j", async (body) => {
      const { response, payload } = await requestSeasonAction(body);

      expect(response.status).toBe(400);

      expect(payload).toMatchObject({
        code: "CONFIRMATION_REQUIRED",
      });

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
      {
        confirm: true,
      },
      {
        confirm: true,
        confirmation: "resetar temporadas",
      },
      {
        confirm: true,
        confirmation: "RESETAR TEMPORADA",
      },
    ])("exige a frase exata de confirmação: %j", async (body) => {
      const { response, payload } = await requestSeasonAction(body);

      expect(response.status).toBe(400);

      expect(payload).toMatchObject({
        code: "INVALID_RESET_CONFIRMATION",
      });

      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("reset completo", () => {
    it("retorna sucesso e as quantidades excluídas", async () => {
      const { response, payload } = await requestSeasonAction();

      expect(response.status).toBe(200);

      expect(payload).toMatchObject({
        ok: true,
        reset: true,
        currentSeason: 1,
        seasonsReset: TOTAL_SEASONS,
        votesDeleted: 150,
        resultsDeleted: 30,
      });

      expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("executa todas as alterações em uma transação", async () => {
      await requestSeasonAction();

      expect(mocks.transaction).toHaveBeenCalledOnce();

      const transactionOptions = mocks.transaction.mock.calls[0]?.[1];

      expect(transactionOptions).toEqual({
        maxWait: 5_000,
        timeout: 15_000,
      });

      expect(mocks.executeRaw).toHaveBeenCalledOnce();

      const sqlTemplate = mocks.executeRaw.mock.calls[0]?.[0];

      expect(String(sqlTemplate)).toContain("pg_advisory_xact_lock");
    });

    it("restaura as temporadas para idle e limpa as datas", async () => {
      await requestSeasonAction();

      expect(mocks.findSeasons).toHaveBeenCalledWith({
        select: {
          number: true,
        },
        orderBy: {
          number: "asc",
        },
      });

      expect(mocks.updateSeasons).toHaveBeenCalledWith({
        data: {
          status: "idle",
          startsAt: null,
          endsAt: null,
        },
      });

      expect(mocks.deleteSeasons).not.toHaveBeenCalled();
    });

    it("exclui votos e resultados de todas as temporadas", async () => {
      await requestSeasonAction();

      expect(mocks.deleteResults).toHaveBeenCalledExactlyOnceWith({});

      expect(mocks.deleteVotes).toHaveBeenCalledExactlyOnceWith({});
    });

    it("bloqueia as temporadas antes de apagar os registros", async () => {
      await requestSeasonAction();

      const lockOrder = mocks.executeRaw.mock.invocationCallOrder[0];

      const updateOrder = mocks.updateSeasons.mock.invocationCallOrder[0];

      const resultsOrder = mocks.deleteResults.mock.invocationCallOrder[0];

      const votesOrder = mocks.deleteVotes.mock.invocationCallOrder[0];

      expect(lockOrder).toBeLessThan(updateOrder);

      expect(updateOrder).toBeLessThan(resultsOrder);

      expect(resultsOrder).toBeLessThan(votesOrder);
    });

    it("não altera imagens nem dados dos prisioneiros", async () => {
      await requestSeasonAction();

      expect(mocks.deleteImages).not.toHaveBeenCalled();

      expect(mocks.updateImages).not.toHaveBeenCalled();

      expect(mocks.deletePrisoners).not.toHaveBeenCalled();

      expect(mocks.updatePrisoners).not.toHaveBeenCalled();
    });

    it("não exige número de temporada no corpo", async () => {
      const { response, payload } = await requestSeasonAction({
        confirm: true,
        confirmation: "RESETAR TEMPORADAS",
      });

      expect(response.status).toBe(200);

      expect(payload).toMatchObject({
        currentSeason: 1,
        reset: true,
      });
    });

    it("aceita reset quando não existem votos ou resultados", async () => {
      mocks.deleteVotes.mockResolvedValue({
        count: 0,
      });

      mocks.deleteResults.mockResolvedValue({
        count: 0,
      });

      const { response, payload } = await requestSeasonAction();

      expect(response.status).toBe(200);

      expect(payload).toMatchObject({
        reset: true,
        votesDeleted: 0,
        resultsDeleted: 0,
        seasonsReset: TOTAL_SEASONS,
      });
    });
  });

  describe("integridade e tratamento de erros", () => {
    it("rejeita temporadas ausentes", async () => {
      mocks.findSeasons.mockResolvedValue(INITIAL_SEASONS.slice(0, -1));

      const { response, payload } = await requestSeasonAction();

      expect(response.status).toBe(409);

      expect(payload).toMatchObject({
        code: "SEASONS_INCOMPLETE",
      });

      expect(mocks.updateSeasons).not.toHaveBeenCalled();

      expect(mocks.deleteVotes).not.toHaveBeenCalled();

      expect(mocks.deleteResults).not.toHaveBeenCalled();

      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rejeita numeração inconsistente das temporadas", async () => {
      mocks.findSeasons.mockResolvedValue([{ number: 1 }, { number: 2 }, { number: 99 }]);

      const { response, payload } = await requestSeasonAction();

      expect(response.status).toBe(409);

      expect(payload).toMatchObject({
        code: "SEASONS_INCOMPLETE",
      });

      expect(mocks.deleteVotes).not.toHaveBeenCalled();

      expect(mocks.deleteResults).not.toHaveBeenCalled();
    });

    it("não confirma sucesso se uma exclusão falhar", async () => {
      mocks.deleteResults.mockRejectedValue(new Error("Falha simulada"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        const { response, payload } = await requestSeasonAction();

        expect(response.status).toBe(500);

        expect(payload).toMatchObject({
          code: "INTERNAL",
        });

        expect(mocks.deleteVotes).not.toHaveBeenCalled();

        expect(mocks.revalidatePath).not.toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("invalida o cache somente depois de concluir a transação", async () => {
      let transactionCompleted = false;

      mocks.transaction.mockImplementation(async (callback: TransactionCallback) => {
        const result = await callback(transactionClient);

        transactionCompleted = true;

        return result;
      });

      mocks.revalidatePath.mockImplementation(() => {
        expect(transactionCompleted).toBe(true);
      });

      const { response } = await requestSeasonAction();

      expect(response.status).toBe(200);

      expect(mocks.revalidatePath).toHaveBeenCalledOnce();
    });
  });
});
