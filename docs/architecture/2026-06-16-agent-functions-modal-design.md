# Design: Modal de Funções de Agente + Fita de Progresso

**Data:** 2026-06-16  
**Status:** Aprovado

## Contexto

A tela de agentes (`/agents`) exibe uma tabela com todos os agentes do ecossistema. Hoje o nome do agente é texto simples. Este design adiciona: clicar no nome abre um modal com funções executáveis fixas por agente, e a execução roda em background com uma fita de progresso no rodapé da tela.

## Escopo

- Modal de funções ao clicar no nome do agente
- Primeira função implementada: backup `.bak` do HMTrackDB para o agente `banco-dados`
- Fita de progresso global no rodapé (aparece durante execução, fecha com X ao final)

---

## Arquitetura

```
agents/page.tsx
  └── clique no nome do agente
        └── AgentFunctionsModal
              └── lista funções do AGENT_FUNCTIONS_REGISTRY[agent.nome]
                    └── botão "Executar"
                          └── POST /coordination/agent-functions/exec
                                └── FastAPI asyncio.create_task
                                      └── pymssql BACKUP DATABASE + scp
                    ↕ poll GET /coordination/agent-functions/jobs/{job_id} (2s)
JobProgressRibbon (rodapé global do layout)
  └── lê jobStore (Zustand)
```

---

## Frontend

### 1. Registry de funções (`src/lib/agentFunctions.ts`)

Objeto estático mapeando `agent.nome → AgentFunction[]`:

```typescript
interface AgentFunction {
  id: string
  label: string
  description: string
}

export const AGENT_FUNCTIONS_REGISTRY: Record<string, AgentFunction[]> = {
  'banco-dados': [
    {
      id: 'backup-hmtrack',
      label: 'Fazer cópia do servidor HMTrack',
      description: 'Backup completo do HMTrackDB em .bak comprimido (~1.6 GB, ~34s)',
    },
  ],
}
```

Extensível: adicionar novos agentes/funções é só adicionar entradas no objeto.

### 2. `AgentFunctionsModal` (`src/components/coordination/AgentFunctionsModal.tsx`)

- Usa o `Modal.tsx` base existente (`isOpen`, `onClose`, `title`, `children`)
- Recebe `agent: CoordAgent`
- Renderiza `AGENT_FUNCTIONS_REGISTRY[agent.nome] ?? []`
- Cada função: card com `label`, `description` e botão "Executar"
- Ao clicar Executar:
  1. `POST /coordination/agent-functions/exec` com `{ agent_nome, function_id }`
  2. Recebe `{ job_id }`
  3. Salva no `jobStore` (`jobId`, `agentNome`, `functionLabel`, `status: 'running'`, `progress: 0`)
  4. Fecha o modal (`onClose()`)
- Se `AGENT_FUNCTIONS_REGISTRY[agent.nome]` é vazio ou undefined: mensagem "Nenhuma função disponível para este agente."

### 3. `jobStore.ts` (`src/stores/jobStore.ts`)

Zustand store com um único job ativo por vez:

```typescript
interface JobState {
  jobId: string | null
  agentNome: string
  functionLabel: string
  status: 'running' | 'done' | 'failed'
  progress: number        // 0–100
  message: string
  error?: string
}
```

- `startJob(jobId, agentNome, functionLabel)` — inicia o job e o polling
- `clearJob()` — limpa o store (botão X)
- Polling interno: `setInterval` de 2s enquanto `status === 'running'`, chama `GET /coordination/agent-functions/jobs/{jobId}`, atualiza store. Para quando `done` ou `failed`.

### 4. `JobProgressRibbon` (`src/components/layout/JobProgressRibbon.tsx`)

Montado no `layout.tsx` raiz. Visível apenas quando `jobStore.jobId !== null`.

**Layout:**
```
[ ícone (girar|check|X) | "banco-dados · Fazer cópia do servidor HMTrack" | [████████░░] 80% ]  [×]
```

**Comportamento:**
- Posição: `fixed bottom-0 left-0 right-0 z-50`
- Fundo: `bg-neutral-950 border-t border-slate-800`
- Barra de progresso: `width: ${progress}%`, transição `300ms ease-out`
- Cores da barra:
  - Em andamento: `bg-slate-500`
  - Completo (`done`): `bg-emerald-500`
  - Falha (`failed`): `bg-neutral-900` com `border border-red-500`
- Quando `done`: texto "Completo ✓" + botão X para fechar (chama `clearJob()`)
- Quando `failed`: texto "Falhou" + mensagem de erro resumida + botão X

### 5. Alteração em `agents/page.tsx`

Nome do agente (`a.nome`) vira `<button>`:

```tsx
<button
  onClick={() => setSelectedAgent(a)}
  className="text-slate-200 hover:text-white underline underline-offset-2 cursor-pointer"
>
  {a.nome}
</button>
```

Estado local: `selectedAgent: CoordAgent | null` — controla abertura do `AgentFunctionsModal`.

---

## Backend

### Novo arquivo: `backend/app/api/routes/agent_functions.py`

#### `POST /coordination/agent-functions/exec`

```python
Body: { agent_nome: str, function_id: str }
```

- Valida se `function_id` é permitido para `agent_nome` (whitelist hardcoded no backend — espelho do registry frontend)
- Cria `JobState` em dict em memória (`JOBS: Dict[str, JobState]`) com `status="running"`, `progress=0`
- Dispara `asyncio.create_task(run_function(job_id, agent_nome, function_id))`
- Retorna imediatamente: `{ job_id: str }` (UUID4)

#### `GET /coordination/agent-functions/jobs/{job_id}`

- Retorna `JobState` do dict em memória
- 404 se job não encontrado (expirou ou nunca existiu)

#### `run_backup_hmtrack(job_id)` — função interna

1. Conecta ao banco de produção via `pymssql` (lê credenciais de `BANCO_DADOS_ENV_PATH`, default: `BANCO-DADOS/.env`)
2. Registra message handler para capturar `PRINT` do SQL Server
3. Executa:
   ```sql
   BACKUP DATABASE HMTrackDB
   TO DISK = '/var/opt/mssql/backup/HMTrackDB_full_{YYYYMMDD}.bak'
   WITH COMPRESSION, STATS = 10, FORMAT, INIT
   ```
4. A cada mensagem `"N percent processed."` → parseia N → atualiza `progress=N` no dict
5. Ao concluir: copia o `.bak` via `scp` para `BANCO-DADOS/BACKUPS/producao_{YYYYMMDD}/`
6. Atualiza `status="done"`, `progress=100`, `message="Backup salvo em BACKUPS/producao_{date}/"`
7. Em qualquer exceção: `status="failed"`, `error=str(e)`

#### Jobs em memória

Dict simples `JOBS: Dict[str, JobState]` — sem persistência. Suficiente: jobs duram minutos, não precisam sobreviver a restart do servidor.

#### Credenciais

Lidas via `python-dotenv` do path configurável por env var:
```
BANCO_DADOS_ENV_PATH=/home/isakiel/projects/zartoo/hmtrack-documentacao/BANCO-DADOS/.env
```

Default: path relativo ao repo da documentação.

#### Whitelist de funções (segurança)

```python
ALLOWED_FUNCTIONS = {
    'banco-dados': ['backup-hmtrack'],
}
```

Requisição com `function_id` não listado retorna 400.

#### Registro no router

Adicionar em `backend/app/main.py` (ou onde os outros routers são registrados):
```python
from app.api.routes import agent_functions
app.include_router(agent_functions.router, prefix="/coordination")
```

---

## Fluxo completo (data flow)

```
1. Usuário clica em "banco-dados" na tabela
2. AgentFunctionsModal abre — lista: "Fazer cópia do servidor HMTrack"
3. Usuário clica "Executar"
4. POST /coordination/agent-functions/exec → { job_id: "abc-123" }
5. jobStore.startJob("abc-123", "banco-dados", "Fazer cópia do servidor HMTrack")
6. Modal fecha
7. JobProgressRibbon aparece no rodapé
8. Poll a cada 2s: GET /coordination/agent-functions/jobs/abc-123
   → { status: "running", progress: 30, message: "30 percent processed." }
   → barra avança para 30%
9. Após ~34s: { status: "done", progress: 100, message: "Backup salvo em BACKUPS/producao_20260616/" }
10. Barra fica verde, texto "Completo ✓"
11. Usuário clica X → ribbon desaparece
```

---

## Arquivos a criar/modificar

| Ação | Path |
|---|---|
| Criar | `frontend/src/lib/agentFunctions.ts` |
| Criar | `frontend/src/components/coordination/AgentFunctionsModal.tsx` |
| Criar | `frontend/src/stores/jobStore.ts` |
| Criar | `frontend/src/components/layout/JobProgressRibbon.tsx` |
| Modificar | `frontend/src/app/agents/page.tsx` (nome → button + modal) |
| Modificar | `frontend/src/app/layout.tsx` (montar JobProgressRibbon) |
| Criar | `backend/app/api/routes/agent_functions.py` |
| Modificar | `backend/app/main.py` (registrar router) |

---

## Fora do escopo

- Persistência de jobs em banco (jobs em memória são suficientes)
- Histórico de execuções passadas
- Múltiplos jobs simultâneos (um job ativo por vez no store)
- Configuração dinâmica de funções via UI
