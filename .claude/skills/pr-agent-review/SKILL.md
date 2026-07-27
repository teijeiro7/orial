---
name: pr-agent-review
description: Obtiene los comentarios de PR-Agent (review, code suggestions) en el PR activo, evalúa cada uno de forma independiente y corrige los hallazgos genuinos. Úsalo cuando el usuario pida procesar/atender/revisar comentarios de PR-Agent. Triggers "pr-agent-review", "revisar comentarios de pr-agent", "corregir hallazgos de pr-agent".
---

# PR-Agent Review Processor

Recupera todos los comentarios que PR-Agent ha dejado en el PR activo, evalúa de forma independiente si cada hallazgo es válido, y aplica el fix solo en los genuinos.

## Step 1 — Identificar PR y repo activos

```bash
gh pr view --json number,url,title,headRefName
gh repo view --json nameWithOwner -q .nameWithOwner
```

Si no hay PR abierto para la rama actual, para y avisa al usuario.

## Step 2 — Comprobar que PR-Agent ha corrido

PR-Agent solo corre si el PR lleva la label `pr-agent-review` (ver skill `develop-pr`). Comprueba:

```bash
gh pr view --json labels -q '.labels[].name'
```

Si no está la label, avisa: probablemente no hay nada que procesar (o hay que disparar un comando manual comentando `/review` en el PR).

## Step 3 — Fetch de los comentarios de PR-Agent

PR-Agent postea vía `GITHUB_TOKEN`, así que aparece como `github-actions[bot]`. Con la config por defecto de este repo (`auto_review`, `auto_describe`, `auto_improve`):

- `/review` deja **un comentario persistente** (se edita en cada push, no duplica) con guía de revisión, hallazgos de seguridad, estimación de esfuerzo, cobertura de tests.
- `/improve` deja **un comentario con tabla** de sugerencias (resumen + impacto por fila).
- `/describe` reescribe el **cuerpo del PR**, no deja comentario — ignóralo aquí.

```bash
PR_NUMBER=$(gh pr view --json number -q .number)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# Comentarios top-level (review guide + code suggestions table)
gh api --paginate "repos/$REPO/issues/$PR_NUMBER/comments" \
  | jq '[.[] | select(.user.login == "github-actions[bot]")]'

# Por si algún día se activa commitable_code_suggestions=true (comentarios inline)
gh api --paginate "repos/$REPO/pulls/$PR_NUMBER/comments" \
  | jq '[.[] | select(.user.login == "github-actions[bot]")]'
```

Si ambas listas vienen vacías, avisa: puede que el job aún no haya terminado (revisa `gh run list` / Actions tab) o que la label se añadiera después del último push.

## Step 4 — Extraer hallazgos concretos

De cada comentario, saca ítems accionables:

- Del comentario de **review guide**: cada bullet de hallazgo, sección "security concerns" / "possible issue", cada ítem tiene contexto de fichero (el diff que Codestral vio).
- Del comentario de **code suggestions**: cada fila de la tabla — fichero, línea/rango aproximado, descripción del problema, sugerencia.

Para cada ítem sin fichero/línea explícitos, localízalo tú mismo en el diff actual (`git diff origin/main...HEAD`) antes de evaluarlo.

## Step 5 — Evaluar cada hallazgo

Antes de tocar código, para cada ítem:

1. Lee el fichero señalado (±20 líneas de contexto sobre la línea reportada).
2. Compara contra lo que el comentario describe.
3. Evalúa con tres veredictos:

| Veredicto | Criterio |
|---|---|
| `VALID` | El problema es real en el código actual, el fix mejora corrección/seguridad/calidad, y no choca con convenciones ya existentes del repo |
| `ALREADY_FIXED` | El código en esa ubicación ya no tiene el problema descrito (commit posterior) |
| `FALSE_POSITIVE` | Malinterpreta el código, marca comportamiento intencional, es preferencia de estilo no forzada por el repo, o sugiere algo que contradice convenciones existentes |

Escribe una frase de motivo por veredicto antes de actuar. **No apliques fixes a ciegas** — Codestral, igual que cualquier modelo, puede malinterpretar contexto o aplicar reglas genéricas que no encajan aquí.

## Step 6 — Aplicar fixes en los VALID

- Edita con la herramienta Edit — diff mínimo, solo lo necesario.
- No refactorices alrededor, no añadas comentarios, no toques líneas no relacionadas.
- Si varios hallazgos válidos caen en el mismo fichero, aplica todos antes de pasar al siguiente.

`FALSE_POSITIVE` y `ALREADY_FIXED`: no tocar código, se explican en el reporte.

## Step 7 — Verificar

```bash
npm run typecheck && npm run lint && npm test
```

Si aparecen errores en los ficheros que acabas de tocar, arréglalos antes de continuar.

## Step 8 — Reportar

```
## PR-Agent findings — PR #<number>

| # | Fichero | Línea | Veredicto | Acción |
|---|---|---|---|---|
| 1 | src/... | 42 | ✅ VALID | Fixed: <descripción breve> |
| 2 | src/... | 17 | ⏭ ALREADY_FIXED | El código ya no tiene el problema |
| 3 | src/... | 88 | ❌ FALSE_POSITIVE | <motivo> |

**Fixed:** N  |  **Skipped:** M  |  **False positives:** K
```

## Step 9 — Commit de los fixes (si hubo alguno)

```bash
git add <ficheros modificados>
git commit -m "fix: address PR-Agent findings on <scope breve>"
git push
```

## Notas

- **Scope creep:** si un hallazgo válido requeriría un refactor grande más allá de las líneas comentadas, márcalo `VALID — deferred` y explica por qué un fix mínimo no es apropiado aquí.
- **Conflictos:** si dos hallazgos se contradicen, señálalo explícitamente y no apliques ninguno.
- Si `/describe` reescribió el cuerpo del PR, no lo trates como hallazgo — es solo la descripción, no una review.
