---
{
  "id": "BT-001",
  "title": "Establish the local issue and agent workflow",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["tasks/", "scripts/tasks.ts", "tests/tasks.test.ts", ".github/agents/", ".gitignore", "package.json", "README.md", "CLAUDE.md", "docs/TESTING.md"],
  "approval": "User requested implementing the local Markdown tracker proposal on 2026-10-08. Approval covers tracker setup, agent instructions and backlog candidates, not new game features or broad Git commits.",
  "assignment": {
    "owner": "orchestrator-direct",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": null,
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-001: Establish the local issue and agent workflow

## Problem

Session-local checklists are not a durable project backlog or a sufficient
handoff for isolated agents. Boundstoy needs local, readable issues and one
coordinator that can select approved work without racing workers or losing
context between sessions.

## Scope

Add Markdown records, a template, workflow documentation, a generated index,
dependency-free Node tooling, and local orchestrator/worker profiles. Track this
setup as the first issue and add a few clearly unapproved follow-up candidates.

Do not change game behaviour, restart the preview, launch workers, introduce a
remote issue service, install packages, or commit the existing uncommitted game.

## Acceptance criteria

- [x] Issue records have stable IDs, scope, approval, dependencies, lifecycle and handoff/result sections.
- [x] The CLI validates records and references, lists eligible work, generates deterministic index output, and prints bounded worker briefs.
- [x] Dependency/parent deadlocks, conflicting active claims, missing approval, and unsupported metadata are rejected with actionable errors.
- [x] Backlog ideas cannot be dispatched; review/done require evidence and done requires checked acceptance criteria.
- [x] Orchestrator/worker profiles define single-writer coordination, isolated worktrees, bounded delegation, review and interrupted-run recovery.
- [x] No production dependency, background service, worker launch or game change is introduced.
- [x] Targeted tests, complete repository tests, type checking, production build, and actual tracker checks pass.

## Implementation context

Keep the existing Node 24+, TypeScript and native test runner conventions.
`CLAUDE.md` remains the repository instruction entry point. Metadata should use
strict JSON front matter to avoid adding a YAML parser. Issue files, not the
generated index or session database, are the durable source of truth.

The repository has no initial Git commit. Worktree-based dispatch must document
and enforce that prerequisite procedurally; this setup must not silently create
a broad baseline commit. Workers may not edit canonical issue state.

## Verification

- `node --test tests/tasks.test.ts`: parsing, graph/state checks, scope conflicts,
  evidence handling, deterministic output, CLI errors and temporary fixtures.
- `npm run tasks -- index` then `npm run tasks:check`: validate real issue records.
- `npm run tasks -- ready`: no unapproved game-work candidates are executable.
- `npm run tasks -- brief BT-001`: complete bounded brief while this issue is assigned.
- `npm run evaluate`: tracker check, all Node tests, TypeScript and static build.
- Confirm no new dependency is introduced and port 4321 remains stopped.

## Handoff

- Summary: Local tracker setup is implemented and ready for acceptance review.
- Changes: Added tasks/ records, workflow/template/index, scripts/tasks.ts, tests/tasks.test.ts, and two .github/agents/ profiles; connected npm commands, evaluation, Git ignores and repository documentation.
- Verification: The complete npm run evaluate passed 69 tests (49 game/visual and 20 tracker), TypeScript and production build. Real index/check/list/ready/brief commands passed; ready --json returned [] because follow-ups remain unapproved. Invalid fixture states fail clearly without rewriting issues or the index.
- Risks: Profiles were validated statically, not launched. Real parallel dispatch requires an approved committed Git baseline, which does not yet exist. Single-writer coordination is procedural; declared scopes are not an OS sandbox.
- Commit: Uncommitted working-tree changes in /home/hhh/pri/boundstoy; no baseline commit was created and nothing was pushed.
- Resources: No agents or servers launched. Temporary test directories are cleaned by the tests. Port 4321 remains stopped.
- Decisions: Used strict JSON front matter to avoid a parser dependency; only the index generator writes a tracked file. BT-002 through BT-004 are backlog candidates, not authorized game work.

## Result

- Summary: Accepted the local tracker setup. All acceptance criteria are met; follow-up candidates remain in backlog with approval set to null.
- Verification: Reviewed the CLI, lifecycle checks, scope/worktree/branch isolation checks, agent profile contracts and actual generated records. npm run evaluate passed all 69 tests, type checking and production build. The ready queue is empty by design, the runtime dependency list is unchanged, and the game preview is still off.
- Integration: All setup changes are present in the main working tree at /home/hhh/pri/boundstoy. This was a direct orchestration task, so no worker branch merge was needed. No Git baseline commit, remote push or worker dispatch was performed.
