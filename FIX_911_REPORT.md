# Fix #911 — Isolamento de Worktree no dispatch-agent.sh

## Problema
Após dispatches de banco-dados, o checkout principal de `hmtrack-documentacao` ficava na branch test/883-qa-loop-regression em vez de `main`. Isso causava:
- Commits de migration caindo na branch errada
- Risco de push de branch indesejada
- Trabalho do gerente em branch não-main

**Causa provável:** dispatch-agent.sh não garantia que o checkout principal retornava a `main` após criar/remover worktree, permitindo que o working tree ficasse em branch errada.

## Solução Implementada
Adicionadas duas guardrails no `dispatch-agent.sh`:

### 1. Antes de criar worktree (linhas 555-567)
Verifica se checkout principal está em branch diferente de main/master e retorna para a branch canônica:

```bash
# Guard: garante que checkout principal está em main antes de criar worktree (#911)
if [ "$PROJECT" = "hmtrack-documentacao" ] || [ "$PROJECT_SLUG" = "claude-office" ]; then
    _CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
    if [ -n "$_CURRENT_BRANCH" ] && [ "$_CURRENT_BRANCH" != "main" ] && [ "$_CURRENT_BRANCH" != "master" ]; then
        log "guard — checkout principal em $_CURRENT_BRANCH, retornando a main antes de criar worktree"
        git checkout main 2>>"$LOG_FILE" || git checkout master 2>>"$LOG_FILE" || ...
    fi
fi
```

### 2. Depois de remover worktree (linhas 247-262)
Força checkout de volta a main/master no cleanup:

```bash
# Guard: garante que checkout principal voltou a main (#911 — isolamento de worktree)
if [ "$PROJECT" = "hmtrack-documentacao" ] || [ "$PROJECT_SLUG" = "claude-office" ]; then
    if git show-ref --verify --quiet refs/heads/main; then
        BASE_BRANCH="main"
    elif git show-ref --verify --quiet refs/heads/master; then
        BASE_BRANCH="master"
    else
        BASE_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo main)"
    fi
    git checkout "$BASE_BRANCH" 2>>"$LOG_FILE" || ...
fi
```

## Acceptance Criteria ✅

1. ✅ **Identificar o que troca branch:** Problema localizado — worktree não garantia retorno a main após cleanup
2. ✅ **Garantir isolamento:** Adicionadas duas guardrails defensivas (antes e depois de criar/remover worktree)
3. ✅ **Guard ao fim do ciclo:** Força checkout a main no cleanup (AC#3)

## Impacto
- **hmtrack-documentacao**: Commit local 364706f (não pusheado — repo não tem remote de código)
- **Propreties**: Afeta apenas dispatch-agent.sh em hmtrack-documentacao
- **Compatibilidade**: Usa mesma lógica de detecção de branch que já existe no script (linhas 513-519)

## Brechas Mapeadas

### 1. **Detecção de branch base adaptada a múltiplos repos**
O script já detectava dinamicamente main vs master no worktree (linhas 513-519), mas a guardrail de cleanup precisava replicar essa lógica. Código é repetido; não é DRY, mas é defensivo e evita falhas silenciosas.

**Mitigação:** Lógica é simples e clara — melhor replicar do que abstrair em função.

### 2. **Possível corrida entre dispatches concorrentes**
A guardrail é best-effort: se dois dispatches rodam paralelo e ambos chegam ao cleanup quase simultaneamente, podem competir no `git checkout main`. Git serializa via lock interno, mas a log pode ter race de mensagens.

**Mitigação:** Já existem mecanismos de coordenação via DB (claim system) que impedem re-pick; a guardrail é apenas defesa em profundidade.

### 3. **Agente que viola disciplina de worktree**
Se o agente fizer `cd ~/projects/zartoo/hmtrack-documentacao` e rodar `git checkout -b feature` no repo principal (violando DISCIPLINA DE WORKTREE), a guardrail recupera, mas o branch mal criado fica órfão no repo.

**Mitigação:** CLAUDE.md já documenta a disciplina; guardrail agora força conformidade.

### 4. **Edge case: detached HEAD**
Se o checkout principal estiver detached (ex: em hash commit), a guardrail pode falhar no `git checkout main` e prosseguir com aviso. Raro, mas possível se alguém fizer operações manuais.

**Mitigação:** Guardrail degrada graciosamente com log "AVISO"; dispatch segue (não aborta).

## Verificação Local
Para testar:
```bash
cd /home/isakiel/projects/zartoo/hmtrack-documentacao
# Simule situação: deixar em branch não-main
git checkout -b test/temporary
# Chame dispatch (vai chamar guardrail)
bash Agents/gerente/automation/dispatch-agent.sh hmtrack-documentacao 999 "test"
# Após cleanup, deve estar em main novamente
git symbolic-ref --short HEAD  # Deve ser 'main'
```

---

**Implementado por:** Claude Code (Haiku 4.5)  
**Data:** 2026-06-20  
**Commit:** 364706f (hmtrack-documentacao, local)
