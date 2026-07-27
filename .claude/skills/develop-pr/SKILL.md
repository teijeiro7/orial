---
name: develop-pr
description: Abre un PR de la rama actual hacia `main` con el formato estándar del repo (Summary + Test plan) y decide si activar la review automática de PR-Agent según si el diff toca lógica de negocio o es solo visual/UI. Úsalo cuando el usuario pida abrir/crear un PR, subir una feature o un fix.
model: sonnet
---

# Skill: develop-pr

Crea un PR de la rama actual (feature/fix/chore) hacia `main`. Este repo no tiene rama `develop`, sigue el formato ya usado en el histórico (`## Summary` + `## Test plan`, footer de Claude Code).

## Paso 1 — Contexto de la rama

```bash
git fetch origin main --quiet
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git log origin/main..HEAD --pretty=format:"%h %s"   # commits que entran
git diff origin/main...HEAD --stat                   # ficheros tocados
```

- Si `BRANCH` es `main`, **parar y avisar**: esta skill es para ramas de trabajo, no para promocionar directamente.
- Si no hay commits sobre `origin/main`, avisar de que no hay nada que abrir.
- Si hay cambios sin commitear, pregunta antes de continuar (no asumas que hay que commitearlos).
- Asegúrate de que la rama está pusheada: `git push -u origin "$BRANCH"` si hace falta.

## Paso 2 — Clasificar el cambio

Mira el diff y los commits para decidir el tipo (rige el prefijo del título y la primera sección del cuerpo):

| Tipo | Prefijo título | Primera sección |
|---|---|---|
| Corrección de bug | `fix(scope):` | `## Problema` |
| Funcionalidad nueva | `feat(scope):` | `## Contexto` |
| Mejora sin bug ni feature | `refactor/perf/chore(scope):` | `## Contexto` |

`scope` es el área tocada en minúsculas (`auth`, `sync`, `forge`, `nutrition`, `whoop`, `db`...). Si es transversal, omite el scope.

## Paso 3 — Redactar título y cuerpo

Estilo conventional commit, imperativo, sin punto final ni emojis.

```
## Summary
- <cambio concreto 1>
- <cambio concreto 2>

## Test plan
- [x] `npm run typecheck` — <resultado real>
- [x] `npm run lint` — <resultado real>
- [x] `npm test` — <resultado real>
- [ ] <verificación manual en dispositivo/simulador, si aplica>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

No inventes resultados de test que no has corrido — corre los comandos relevantes antes o márcalos como pendientes.

## Paso 4 — Decidir si conviene la review de PR-Agent

PR-Agent es una review automática por IA (Codestral vía Mistral) montada en este repo como GitHub Action, gateada por la label `pr-agent-review` — sin esa label, no se ejecuta. Aporta valor en PRs con **lógica de negocio real** (bugs, casos borde, seguridad, datos); es ruido en cambios puramente visuales.

**No la actives por defecto.** Razona sobre el diff del Paso 1 y pregunta al usuario antes de decidir (`AskUserQuestion` o pregunta directa).

Heurística — **probablemente NO hace falta** cuando el PR es:

- Solo estilos, spacing, temas, componentes de UI puramente visuales (sin nueva lógica).
- Solo config/tooling (eslint, tsconfig, babel/metro config, CI yaml, dependencias/lockfile).
- Muy pequeño y de bajo riesgo (pocas líneas, sin ramas lógicas nuevas).
- Documentación (`.md`).

Heurística — **probablemente SÍ hace falta** cuando el PR toca:

- `src/` con lógica real: sync services, cálculos, transformaciones de datos, integraciones (Whoop, Hermes).
- Auth (Supabase Auth), sesiones, tokens, permisos, manejo de secretos.
- `drizzle/` — esquema de BD, migraciones, queries.
- Background fetch, notificaciones, cualquier lógica que toque datos de usuario.
- Superficie amplia con lógica en varios ficheros, o tests nuevos que cubren comportamiento.

Presenta tu recomendación con el motivo y deja que el usuario decida. Ejemplo:

> "Este PR solo toca clases de estilo en `ProfileCard.tsx` (sin lógica nueva). **No recomiendo** activar PR-Agent — sería ruido. ¿Lo activo igual?"

Guarda la decisión para el Paso 5.

## Paso 5 — Confirmar y abrir el PR

Muestra al usuario título y cuerpo completos, pide confirmación antes de `gh pr create`.

```bash
gh pr create \
  --base main \
  --head "$BRANCH" \
  --title "tipo(scope): resumen" \
  --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] ...

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Si el Paso 4 salió en "sí", añade la label tras crear el PR (créala si no existe todavía, es idempotente):

```bash
gh label create pr-agent-review --color BFD4F2 --description "Activa la review automática de PR-Agent" --force
gh pr edit <PR_URL> --add-label pr-agent-review
```

Al añadir la label, el workflow (`.github/workflows/pr-agent.yml`) corre la review automáticamente — no hace falta comentar `/review` a mano. La action de pr-agent solo procesa por defecto los eventos `opened/reopened/ready_for_review/review_requested` (ignora `labeled`/`synchronize` internamente), así que el workflow amplía esa lista vía `github_action_config.pr_actions` para incluirlos también. Tarda 1-2 minutos.

Si salió en "no", no toques labels — sin `pr-agent-review` el workflow no se dispara, que es el comportamiento deseado.

Devuelve al usuario la URL del PR.

## Paso 6 — Tras abrir

Si aplicaste la label `pr-agent-review`, espera a que las dos runs de "PR Agent" en Actions terminen (`gh run list`) y luego usa la skill `pr-agent-review` para procesar sus comentarios.

## Anti-patrones (no hacer)

- ❌ Usar esta skill para `main` o estando ya en `main`.
- ❌ Abrir el PR sin confirmar título y cuerpo con el usuario.
- ❌ Rellenar `## Test plan` con tests que no has corrido.
- ❌ Añadir la label `pr-agent-review` sin razonar el diff ni preguntar al usuario (Paso 4).
- ❌ Recomendar PR-Agent en un PR puramente visual, o desaconsejarlo en uno con lógica de negocio real.
