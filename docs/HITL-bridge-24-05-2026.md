# HITL Bridge — responder no navegador às tasks bloqueadas que pedem permissão humana

**Data:** 24/05/2026 · **Projeto:** claude-office (+ coletor-task) · **Status:** Fase 1 entregue, em `main` (local)

## O que é

Quando um agente precisa de uma **decisão humana** para continuar, em vez de travar no terminal esperando input, ele **pergunta via web**. Você responde na tela de **Tasks** do claude-office e o agente **destrava** e continua. Funciona do desktop e do celular (via túnel).

## Como funciona (fluxo)

1. O agente roda `hitl.py ask` → grava a pergunta na tabela `hitl_prompts` (Postgres de coordenação, `:5433`) e **bloqueia fazendo poll**.
2. Na tela **Tasks** (`/tasks`, aberta pelo botão **"TASKS"** do header — que substituiu o antigo "LIMPAR BD"), a task ganha um badge **🔒 "aguardando você"** + um contador no topo.
3. Você clica **Open** → abre um modal com a pergunta + contexto + opções, renderizadas conforme o tipo:
   - **Sim/Não** (`yesno`)
   - **Escolha única A–E** (`choice`)
   - **Múltipla `[x][x][ ]`** (`multi`)
   - **Texto livre** (`text`)
4. Você responde → o agente lê a resposta (via poll) e **continua o trabalho**.
5. Se você demorar além do timeout, o agente **sai limpo** (reporta "aguardando HITL #id") e o gerente **re-despacha** quando você responder.

## Arquitetura

```
agente (claude -p)
  └─ hitl.py ask  → INSERT hitl_prompts (pending) → POLL na linha
                                  │
claude-office (Tasks UI)         │  (poll ~10s)
  └─ GET /api/v1/coordination/hitl  ◄── lista pendentes (join issues p/ contexto)
  └─ Open → modal (4 tipos) → POST /api/v1/coordination/hitl/{id}/answer
                                  │
  hitl_prompts.status = answered ◄┘
                                  │
agente: poll vê answered → lê resposta → CONTINUA
        (ou timeout → sai limpo → gerente re-despacha)
```

**Tabela `hitl_prompts`** (migration 003, `:5433`): `id, source_ref, agent, project, question, context, kind(yesno|choice|multi|text), options(jsonb), status(pending|answered|expired), answer(jsonb), expires_at`. Um `sweep` (no `cleanup` do coletor) marca `expired` os vencidos, evitando prompt órfão na UI.

## Fatias entregues

| Fatia | Onde | O quê |
|---|---|---|
| **S1** | `coletor-task` | migration `003_hitl_prompts` (aplicada no :5433) + `hitl.py` (`ask`/`answer`/`list-pending`/`sweep`) + sweep no `cleanup` |
| **S2** | claude-office `backend` | rotas `GET /coordination/hitl` + `POST /coordination/hitl/{id}/answer` (validação por kind, 409 idempotente, UPDATE escopado só em `hitl_prompts`) |
| **S3** | claude-office `frontend` | badge "aguardando você" + contador + `HitlAnswerModal` (4 tipos) na `/tasks` + i18n (en/pt-BR/es) + tratamento de prompts órfãos |
| **S4** | gerente (`automation`) | convenção `ask-human` no template de briefing (`gerente-loop.sh`) + passo de re-dispatch + `DISPATCH_TIMEOUT=5400` (invariante `hitl --timeout < DISPATCH_TIMEOUT`) |

## Contrato do `hitl.py ask` (para os agentes)

```
hitl.py ask --kind <yesno|choice|multi|text> --question "..." \
  [--context "..."] [--options "A:rotulo,B:rotulo"] \
  --source-ref agents-ia#<N> --agent <mesa> --project <proj> --timeout 1800
```
- **exit 0** = answered → lê o campo `answer` do JSON no stdout e CONTINUA.
- **exit 10** = timeout → reporta "aguardando HITL #id" e ENCERRA LIMPO (não assume a resposta).
- Invariante: `--timeout` SEMPRE `< DISPATCH_TIMEOUT` (5400); default 1800 é seguro.

## Verificação

- pytest coletor-task **29/29** + backend **8/8**; `next build` limpo; `tsc`/`eslint` (arquivos novos) ok.
- **Smoke end-to-end ao vivo:** criar prompt → aparece na UI → responder → `answered` → 2ª resposta = 409 (idempotente).

## Decisões e limites

- **Acesso pelo celular:** via **túnel** (tailscale / `ssh -L` / ngrok) até localhost — o `LocalhostOnlyMiddleware` do claude-office fica **intacto** (mais seguro).
- **Fase C dropada:** interceptar os prompts **nativos** (permissão / `AskUserQuestion`) via Claude Agent SDK **não é viável em headless** — o `AskUserQuestion` não passa pelo `canUseTool` e trava sem TTY (recomendação oficial: `disallowedTools` + custom tool). O `canUseTool` só faz allow/deny de tool-use (supervisão), não responde perguntas. Como o objetivo já é coberto pela Fase 1 (`hitl.py`), a Fase C foi descartada.

## Pendências (polimento)

- ADR registrando `hitl_prompts` como a única exceção de escrita da engine de coordenação (read-only por convenção).
- Documentar o setup do túnel para acesso pelo celular.
- Auto-resume automático do re-dispatch (hoje é gerente-driven).

## Referências

- Spec: `Agents/gerente/SPEC_hitl_bridge_2026-05-24.md`
- Plano + patches: `Agents/gerente/PLANO_hitl_bridge_patches_2026-05-24.md`
- DB de coordenação: `Agents/coletor-task/` (schema + `hitl.py`), Postgres Docker `:5433`
