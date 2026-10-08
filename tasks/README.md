# Local work tracking

`tasks/issues/*.md` is the durable source of truth. These files belong in Git
alongside the code. `INDEX.md` is a generated view, not a second task database.
No server, external issue service, agent daemon or production dependency is used.

## Everyday commands

Run from the project directory:

```sh
npm run tasks                   # List all issues by priority and ID
npm run tasks -- ready           # Approved, unblocked, non-conflicting candidates
npm run tasks -- ready --json    # Structured output for the orchestrator
npm run tasks -- list blocked
npm run tasks -- show BT-001
npm run tasks -- brief BT-002    # Requires eligible or already assigned work
npm run tasks -- next-id         # Suggestion, not an ID reservation
npm run tasks -- index           # Regenerate INDEX.md after changes
npm run tasks:check              # Validate records AND index freshness
```

The helper never approves work, assigns it, launches workers, executes commands
from an issue, creates worktrees, commits, or starts the game. Only `index`
writes a file, and that file is `tasks/INDEX.md`. `check` is read-only.
Machine consumers should call `node scripts/tasks.ts ready --json` (or
`npm --silent run tasks -- ready --json`) to avoid npm's own log banner.

The initial records are BT-001 (this tracker setup) and three unapproved
follow-up candidates: browser smoke automation, mobile readability, and Astro
consumer verification. An empty `ready` result is intentional until specific
follow-up work is approved. Creating the tracker did not authorize those ideas.

## Issue format

Copy `TEMPLATE.md` into `issues/BT-NNN-short-slug.md`, replace the ID/title and
fill every required section. IDs are permanent, unique, positive, zero-padded to
at least three digits. Never move files between status folders or recycle IDs.
Use `depends_on` for actual prerequisites, not merely a preferred ordering.

Metadata is **strict JSON between `---` lines**. JSON is also valid YAML, but
we deliberately accept only JSON so Node can parse it without a YAML dependency.
No comments, unquoted keys, trailing commas or YAML-only syntax.

| Field | Meaning |
| --- | --- |
| `id`, `title` | Stable identifier and readable title; must match the H1 |
| `type` | `bug`, `feature`, `chore`, or `epic` |
| `status` | Lifecycle state below |
| `priority` | `P0` urgent, `P1` next, `P2` normal, `P3` later; not authorization |
| `depends_on` | Array of prerequisite issue IDs |
| `parent` | Epic ID or `null`; grouping does not create a prerequisite |
| `scope` | Exact repo-relative files, directories ending in `/`, or `.` for everything; no globs |
| `approval` | User approval reference and its scope, or `null` |
| `assignment` | Owner, runtime run/agent reference, branch, worktree; or `null` |
| `blocked_reason` | Required for `blocked`, otherwise `null` |

Use a repo-relative worktree path such as `.worktrees/BT-002`. A direct
orchestrator task may use `"worktree": "."`, `"branch": null`. Record the actual
runtime agent/run identifier once launched. An intended agent name is not
evidence that a worker is running.

`Problem` describes the user-visible outcome. `Scope` states inclusions and
non-goals; metadata lists the expected write surface. `Acceptance criteria`
contains checkboxes with observable outcomes. `Implementation context` includes
relevant files and decisions. `Verification` gives exact commands and manual
scenarios. `Handoff` belongs to worker-to-orchestrator reporting; `Result` records
the orchestrator's review and integration.

For visual/gameplay work, require concrete evidence: a legal replay, a measured
threshold, or named screenshots at specified viewport sizes. A green build does
not prove a course is fun or a hazard readable.

## Lifecycle and authorization

| State | Entry/exit rule |
| --- | --- |
| `backlog` | Idea or proposed work; must not be executed automatically |
| `ready` | User-approved scope with clear acceptance/verification; dependencies may still be pending |
| `in_progress` | Orchestrator has assigned the issue and dependencies are done |
| `review` | Worker has returned the required handoff; integration is not yet accepted |
| `blocked` | A real blocker is recorded; no pretending the issue is finished |
| `done` | Acceptance boxes checked, handoff recorded, review/integration evidence present |

Normal flow: `backlog -> ready -> in_progress -> review -> done`.
Rework returns `review -> in_progress`. Blocked work returns to `ready` after its
worker is stopped/reconciled and the assignment is released, or to
`in_progress` when the same verified worker resumes.

Only user-approved work becomes `ready`. Approval may be recorded against a
bounded parent request, with that reference explicitly copied into its children.
An agent's suggestion, priority, or successful test does not authorize expansion.
Changing scope/acceptance materially requires approval again. Discovered work
goes to `backlog`; do not turn a small task into a growing autonomous project.

Epics group child issues and are never dispatched to a worker. They may progress
as their children do, but cannot close until every child and dependency is done.
Never make a child depend on its parent: the parent's completion already waits
on that child.
An unapproved/blocked ancestor or an unfinished ancestor prerequisite prevents
child dispatch. Approval is still explicitly recorded on each executable child.

The validator checks the current records and basic evidence fields. It cannot
prove that approval is genuine, that a command was actually run, or that a claim
about quality is true. The orchestrator must inspect the evidence. Git history,
when committed, supplies the change history; Markdown is not an access-control
or distributed-lock mechanism.

## Orchestrator and workers

Profiles:

- `.github/agents/boundstoy-orchestrator.agent.md`
- `.github/agents/boundstoy-worker.agent.md`

Start Copilot in this repository and select `/agent boundstoy-orchestrator`.
Give a bounded request such as:

> Work on approved ready issues for the current milestone. Start with one issue;
> use at most two independent workers after the first successful integration.
> Stop when no approved work remains or a decision is needed.

The worker profile is intended for delegation, not an independent backlog sweep.
Models inherit the user's configuration; no model or paid workflow is pinned.
Do not use `/fleet` or a large dynamic workflow merely to run this tracker.

**Single writer:** only one orchestrator session coordinates this tracker at a
time. It alone changes issue files, assignments, approval, status and the index.
Workers return handoffs, not status edits. Direct human edits are fine while the
orchestrator is paused. If another coordinating session is active, do not race
it; reconcile ownership first. This is a procedural single-writer system, not
an automatic lock service.

Before dispatch:

1. Run `tasks:check`; read eligible records, not just the index.
2. Confirm the explicit approved scope, dependencies and required capabilities.
3. Check Git status, baseline and existing worktrees. Preserve unrelated work.
4. Record the assignment and `in_progress` state before starting the worker.
   Run `index` and `check` again.
5. Supply the complete issue/brief, accepted dependency results, absolute
   worktree path, baseline, branch, allowed files, commands, acceptance criteria,
   commit policy, and stopping condition.
6. Record the real worker ID as soon as launch succeeds. Recalculate `ready`
   before launching a second worker.

Default to **one worker for the first issue**, then **at most two simultaneous
implementation workers**. Parallelism is a ceiling, not a target. Do a small
direct task yourself rather than paying for an unnecessary agent. Use a fresh
worker for each unrelated issue; don't reuse a worker pool.

The ready list excludes conflicts with assigned `in_progress`, `review`, and
`blocked` issues. Two ready candidates can still conflict with each other.
Scope checks are based on declarations, not an OS sandbox or semantic analysis.
Shared physics/contracts/lockfiles usually need sequencing even across
different paths. Allowing parallel work is the orchestrator's decision.
Assignments must also use distinct owners, worktree paths and non-null branches.
Aliases/symlinks and actual process state still require Git/runtime inspection.

## Git/worktree discipline

Parallel workers require a **committed, approved baseline**. This project's
initial game source had not been committed when the tracker was introduced.
Creating the tracker does not authorize committing all existing files.
If `git rev-parse --verify HEAD` fails, do not launch a worktree worker: explain
the prerequisite and obtain approval for a baseline commit, or perform approved
work directly/sequentially in the existing tree.

**Explicit serial fallback:** when the user has approved worker implementation
but not a broad baseline commit, the orchestrator may assign exactly one worker
to the primary tree. Record `"branch": null`, `"worktree": "."`, and the
`serial-primary` mode in the issue brief/handoff. Snapshot the file inventory
and hashes first, stop all other code writers, and do not edit code while that
worker runs. Compare the changed paths to its scope before review. This is not
parallel isolation and must never be used with simultaneous workers. A clean,
committed baseline and separate worktrees remain mandatory for parallel work.

If the current runtime has not reloaded the repository's custom agent profiles,
use a general-purpose worker with the complete worker contract and explicit
assignment supplied in its prompt. Do not guess an unavailable agent tool name.
For synchronous dispatch, record the actual agent/run ID when the tool returns
it; until then label the assignment as dispatching, not as an invented runtime ID.

When a committed baseline is available and the user has authorized the Git work:

```sh
git worktree add -b task/bt-002 .worktrees/BT-002 <approved-baseline-commit>
```

Never execute an example placeholder literally. The orchestrator verifies the
actual root and branch with `git -C <worktree> ...` before dispatch. Worker tools
must be permitted to access that directory; do not bypass filesystem grants.
Each command uses an explicit working directory. A prompt alone does not change
a tool's default directory.

Workers must not copy/share mutable dependency directories between worktrees.
Use the locked install when dependencies are needed and missing. Browser jobs
use distinct local ports and isolated browser contexts. Record created server
handles/PIDs; stop only owned processes. Do not restart the preview because it
is convenient: start it only for an issue's verification, then stop it unless
the user explicitly requests otherwise.

Only issue-branch commits are allowed when the assignment authorizes commits.
Use the required Copilot co-author trailer. No pushing, rebasing shared work,
force operations, or worktree deletion without authorization. The orchestrator
alone integrates, checks the combined result, then marks `done`. Do not remove
the worker's branch/worktree before its changes are safely integrated.

## Handoff and recovery

Workers return the `Handoff` fields from `TEMPLATE.md`, including actual commands
and outcomes, changed files, commit or uncommitted-diff location, risks, and
owned resources. Missing evidence means review is incomplete, not success.
The orchestrator copies the report into the canonical issue and checks the
actual diff, scope, acceptance criteria and combined behaviour.

On restart, inspect all assigned `in_progress`, `review`, and `blocked` records
before dispatching anything. Check recorded worker IDs, branches, worktrees,
uncommitted changes and test/server processes. An old assignment is not
automatically abandoned. Never launch a replacement while the old worker may
still write. Preserve partial work; document the decision to resume, review,
block, or release the assignment.

Assigned blocked work continues to hold its declared scope. Clear `assignment`
only after confirming the worker is stopped and its work is preserved; keep the
old identifiers and reconciliation details in `Handoff`. Automatic retries,
unbounded new issues, and silent scope expansion are not part of this workflow.
