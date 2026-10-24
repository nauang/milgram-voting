# Fluxo de voto — pseudocódigo

> Fonte: PROMPT.md §2, §7, §8, §8.1. Cobre: clique no card → modal → `POST /api/vote`
> → validações (rate-limit, 24h) → feedback → fecha modal.
> Pseudocódigo, **não é código final**.

---

## 1. Visão geral (diagrama)

```
[Visitante]
   │ clica no card
   ▼
[Card tem estado "voted"?] ──sim──► [Modal "já votou hoje"] ──► fim
   │ não
   ▼
[Modal de voto abre] ── Esc / ✕ / overlay ──► fecha, foco volta ao card
   │ escolhe losango (forgive | not_forgive)
   ▼
[Cliente: trava botões (once)] ──► POST /api/vote
                                        │
                                        ▼
                               [SERVIDOR: validações em ordem]
                                        │
          ┌──────────┬──────────┬───────┴────┬───────────┬───────────┐
          ▼          ▼          ▼            ▼           ▼           ▼
        400        403/409      429          409         201         500
      inválido   temporada    rate-limit   já votou    sucesso      erro
                 fechada      (IP/hora)    (24h)
          │          │          │            │           │           │
          └──────────┴──────────┴────────────┘           │           │
                     ▼                                   ▼           ▼
          [Mensagem no modal /                  [投票済み / Voto   [Mensagem
           modal "já votou"]                     registrado]        de erro]
                                                      │
                                                      ▼
                                          [Fecha em 1,5s + selo "voted"
                                           + foco volta ao card]
```

---

## 2. Cliente (front-end)

```
FUNÇÃO handleCardClick(prisoner):
    SE prisoner.state == "voted":
        abrirModal("voted", prisoner)
        RETORNAR
    SE prisoner.state != "voting":
        RETORNAR                         // idle / lost / guilty / not_guilty
    guardar cardQueAbriu = elementoDoCard // para devolver o foco depois
    abrirModal("vote", prisoner)         // foco no primeiro losango, focus trap ligado


FUNÇÃO handleVoteSubmit(choice):         // registrado com { once: true } por tentativa
    event.preventDefault()
    SE choice NÃO ESTÁ EM ["forgive", "not_forgive"]:
        mostrarErro("Escolha uma opção válida.")   // aria-invalid + aria-live
        RETORNAR

    modal.estado = "submitting"
    desabilitarLosangos()                // aria-disabled="true" → evita duplo clique

    TENTAR:
        resposta = await POST /api/vote
            headers: { "x-csrf-token": csrfToken }
            body:    { prisonerId, choice }   // seasonId é decidido no SERVIDOR
    CAPTURAR erroDeRede:
        modal.estado = "error"
        mostrarErro("Não foi possível registrar o voto. Tente novamente.")
        reabilitarLosangos()             // permite nova tentativa (novo handler once)
        RETORNAR

    SELECIONAR resposta.status:
        201:
            modal.estado = "success"
            mostrarFeedback("投票済み / Voto registrado")   // aria-live="polite"
            marcarCardComo("voted", prisoner)              // atualização otimista após confirmação
            esperar 1500 ms
            fecharModal()
            devolverFoco(cardQueAbriu)
        409 (JÁ VOTOU, code="ALREADY_VOTED"):
            marcarCardComo("voted", prisoner)
            trocarConteudoModal("voted", resposta.retryAt)
        409/403 (TEMPORADA FECHADA, code="SEASON_CLOSED" | "SEASON_NOT_STARTED"):
            mostrarErro(mensagemCorrespondente)
            // mantém losangos desabilitados: não adianta tentar de novo
        429:
            minutos = ceil(resposta.headers["Retry-After"] / 60)
            mostrarErro("Muitas tentativas. Tente novamente em " + minutos + " minutos.")
        400:
            mostrarErro("Escolha uma opção válida.")
            reabilitarLosangos()
        QUALQUER OUTRO (5xx):
            mostrarErro("Não foi possível registrar o voto. Tente novamente.")
            reabilitarLosangos()
```

Regras do cliente:
- Nunca usar `alert()`; erro sempre perto dos losangos, em `aria-live`.
- O cliente **não decide** se o voto vale. Só o servidor decide.
- O selo `voted` na carga da página vem do servidor (`votedPrisonerIds`).
  `localStorage` é opcional e nunca fonte da verdade.

---

## 3. Servidor — `POST /api/vote`

Ordem das validações: **do mais barato/seguro para o mais caro**. Quem falha cedo
não consulta o banco.

```
FUNÇÃO POST /api/vote(request):

    // 1. CSRF ─────────────────────────────────────────────
    SE token CSRF ausente OU inválido:
        RETORNAR 403 { code: "CSRF_INVALID" }

    // 2. Validação do corpo (Zod) ─────────────────────────
    corpo = voteSchema.safeParse(request.json)
    // voteSchema = { prisonerId: int > 0, choice: enum("forgive","not_forgive") }
    SE corpo.falhou:
        RETORNAR 400 { code: "INVALID_BODY" }

    // 3. Identificação do visitante ───────────────────────
    ip        = extrairIp(request)                     // x-forwarded-for (primeiro valor)
    cookieId  = ler cookie httpOnly "milgram_vid"
    SE cookieId não existe:
        cookieId = gerarUuid()                         // será gravado na resposta de sucesso
    voterKey  = sha256(cookieId + ip + SALT)           // NUNCA guardar IP puro

    // 4. Rate-limit global (anti-bot) ─────────────────────
    // Upstash: janela deslizante de 10 tentativas / 1 hora, por hash do IP
    resultado = voteLimiter.limit(sha256(ip + SALT))
    SE NÃO resultado.success:
        segundos = (resultado.reset - agora) / 1000
        RETORNAR 429 { code: "RATE_LIMITED" } com header "Retry-After: segundos"

    // 5. Temporada ativa (fonte da verdade: banco) ────────
    season = buscar Season onde status == "voting"
    SE season não existe:
        RETORNAR 403 { code: "SEASON_CLOSED" }          // idle ou closed
    SE agora < season.startsAt OU agora > season.endsAt:
        RETORNAR 403 { code: "SEASON_CLOSED" }

    // 6. Prisioneiro existe ───────────────────────────────
    SE NÃO existe Prisoner com id == corpo.prisonerId:
        RETORNAR 404 { code: "PRISONER_NOT_FOUND" }

    // 7. Regra de negócio: 1 voto / prisioneiro / 24h ─────
    limite24h = agora - 24 horas
    votoRecente = buscar Vote onde:
                      voterKey    == voterKey
                      prisonerId  == corpo.prisonerId
                      createdAt   >= limite24h
                  ordenar por createdAt desc, pegar o primeiro
    SE votoRecente existe:
        retryAt = votoRecente.createdAt + 24 horas
        RETORNAR 409 { code: "ALREADY_VOTED", retryAt }

    // 8. Gravação ─────────────────────────────────────────
    // Evitar corrida: dois POST simultâneos passariam juntos pelo passo 7.
    // Não dá para usar índice único (a janela de 24h é móvel), então:
    //   a) travar a chave "vote:lock:{voterKey}:{prisonerId}" no Redis (SET NX, TTL 24h)
    //   b) SE a trava já existe → tratar como ALREADY_VOTED (409)
    //   c) gravar o voto dentro de prisma.$transaction, que RECONFERE season.status
    //      (se o admin fechou a votação no meio do caminho, aborta com SEASON_CLOSED
    //       e a trava é liberada)
    TRANSAÇÃO:
        reconferir season.status == "voting"
        criar Vote { prisonerId, seasonId: season.id, choice, voterKey }

    // 9. Resposta ─────────────────────────────────────────
    gravar cookie "milgram_vid" (httpOnly, sameSite=lax, secure em prod, 1 ano)
    RETORNAR 201 { ok: true, prisonerId, choice }
```

### 3.1 Tabela de respostas

| Status | `code` | Quando | Cliente mostra |
|---|---|---|---|
| 201 | — | Voto gravado | 投票済み / Voto registrado → fecha em 1,5s |
| 400 | `INVALID_BODY` | Zod falhou | "Escolha uma opção válida." |
| 403 | `CSRF_INVALID` | Token ausente/errado | "Sessão expirada. Recarregue a página." |
| 403 | `SEASON_CLOSED` | Sem temporada `voting` / fora do período | "A votação desta temporada já foi encerrada." |
| 404 | `PRISONER_NOT_FOUND` | id inexistente | Erro genérico |
| 409 | `ALREADY_VOTED` | Voto < 24h no mesmo prisioneiro | Modal "já votou hoje" + `retryAt` |
| 429 | `RATE_LIMITED` | > 10 tentativas/hora no IP | "Muitas tentativas. Tente novamente em X minutos." + `Retry-After` |
| 500 | `INTERNAL` | Falha inesperada | "Não foi possível registrar o voto. Tente novamente." |

---

## 4. Por que essa ordem?

1. **CSRF e Zod primeiro:** lixo é descartado sem custo.
2. **Rate-limit antes do banco:** bots não geram consultas.
3. **Temporada antes do 24h:** se a votação fechou, a resposta certa é "encerrada",
   não "já votou".
4. **24h no servidor:** o cliente pode ser burlado; o servidor é a única fonte da verdade.
5. **Reconferir a temporada na transação:** fecha a janela de corrida com o
   `closeVoting` do admin (PROMPT §8: após encerrar, a API recusa novos votos).

---

## 5. Pseudocódigo de apoio — carga da página `/judge` (estado `voted`)

```
FUNÇÃO carregarPaginaJudge(request):
    season     = buscar Season ativa (voting) OU a mais recente
    prisoners  = buscar 10 Prisoner com images
    voterKey   = sha256(cookieId + ip + SALT)       // mesma fórmula do POST

    votedPrisonerIds = buscar Vote.prisonerId onde:
                           voterKey == voterKey
                           createdAt >= agora - 24 horas
                           (distinct)

    PARA CADA prisoner:
        imagem = prisoner.images.find(i => i.season == season.number)
                 OU a última imagem disponível           // fallback (§5)
        estado = calcularEstado(prisoner, season, votedPrisonerIds)

    RETORNAR lista para renderização no servidor (RSC)
```

```
FUNÇÃO calcularEstado(prisoner, season, votedPrisonerIds):
    SE season.status == "closed":
        resultado = buscar Result de (prisoner, season)
        RETORNAR resultado.verdict          // "lost" | "not_guilty" | "guilty"
    SE season.status == "idle":
        RETORNAR "idle"
    SE prisoner.id ESTÁ EM votedPrisonerIds:
        RETORNAR "voted"
    RETORNAR "voting"
```

---

## 6. Pontos de teste derivados (para a Etapa 8)

**Vitest (unit):**
- `calcularEstado` devolve o estado certo para cada combinação.
- Janela de 24h: voto com 23h59 bloqueia; com 24h01 libera.
- `voterKey` é determinístico e **não contém** o IP puro.
- Veredito: maioria / empate / zero votos (na função de encerramento).

**Playwright (E2E):**
- `/judge` → clicar no card → modal abre → votar → "Voto registrado" → modal fecha → selo `voted`.
- Segundo clique no mesmo card → modal "já votou hoje".
- `Esc` fecha o modal e o foco volta ao card.
- 11º envio na mesma hora → mensagem de `429`.

---

## 7. Decisões em aberto

| # | Ponto | Proposta |
|---|---|---|
| F1 | `voterKey = sha256(cookie + ip + salt)`: limpar o cookie ou trocar de IP gera outra chave e contorna o limite de 24h. | Aceitável para um sistema anônimo; o rate-limit por IP limita o dano. Documentar a limitação no README. |
| F2 | O corpo do POST leva `prisonerId`, mas **não** `seasonId`. | O servidor descobre a temporada ativa. Evita o cliente votar em temporada errada. |
| F3 | O lock do passo 8 exige Redis (Upstash), já previsto no §8.1. | Se o Upstash não estiver configurado em dev, fazer fallback em memória e avisar no README. |
