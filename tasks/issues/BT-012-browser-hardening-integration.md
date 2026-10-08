---
{
  "id": "BT-012",
  "title": "Accept the combined browser hardening batch",
  "type": "chore",
  "status": "done",
  "priority": "P1",
  "depends_on": ["BT-002", "BT-011"],
  "parent": "BT-010",
  "scope": ["README.md", "docs/TESTING.md", "docs/ARCHITECTURE.md", "tasks/"],
  "approval": "Approved as bounded integration/acceptance of BT-010 under the user's follow-up issue-fixing request.",
  "assignment": {
    "owner": "orchestrator-hardening",
    "run": "ae1df791-ee88-45da-87ca-bc2da2630c7d",
    "branch": "master",
    "worktree": "."
  },
  "blocked_reason": null
}
---
# BT-012: Accept the combined browser hardening batch

## Problem

The new browser runner and idle-aware render loop must work together, not merely
pass separately in their worktrees. Their acceptance and usage need durable
documentation and issue evidence.

## Scope

The orchestrator reviews scoped commits, integrates them, runs the new browser
command against the combined production build, verifies idle/wake-up behaviour,
updates README/testing/architecture guidance, and closes accepted issues.

Do not expand into other backlog candidates or change gameplay. Reopen the
relevant worker issue for any integration defect rather than silently widening
this documentation/integration scope.

## Acceptance criteria

- [x] The actual browser command succeeds against the integrated build and surfaces a real failing assertion as a nonzero failure.
- [x] All current level witnesses and input/editor/save behaviour remain valid.
- [x] Settled pause/hidden states stop drawing, and resize/resume/debug stepping redraw correctly without simulation drift.
- [x] Commands, prerequisites, cleanup guarantees and untested limitations are documented accurately.
- [x] Full evaluation passes, the tree is clean after authorized commits, and no owned test server/browser is left running.

## Implementation context

Native Node tests remain the default portable evaluation path. The browser
command may require an installed compatible Chromium executable; absence must
be an explicit error, not a silent pass. No global browser/profile may be reused.

## Verification

Run each worker's documented checks and npm run evaluate on master after
integration. Inspect real browser output/artifacts and compare the paused-frame
measurement with the recorded baseline. Record commit IDs and cleanup evidence.

## Handoff

- Summary: Accepted the combined browser hardening batch; gameplay and the six-level curriculum are unchanged.
- Changes: Integrated BT-002 and BT-011, added the small CLI entrypoint guard/regression during review, and updated README/testing/architecture guidance.
- Verification: npm run evaluate passed 116 tests/typecheck/build. npm run test:browser passed twice on the integrated renderer, with all six exact witnesses, real input, editor isolation, saves and offline operation. The deliberate assertion fixture exited 1 and reported passed=false/cleaned=true; the next real run passed. Exact recorded profiles, PIDs/groups and preview/debug ports were verified absent for both outcomes.
- Risks: Linux software-WebGL browser checks are not hardware energy, physical-mobile, or cross-browser certification. Uncatchable SIGKILL/OS failure cannot guarantee cleanup. Remaining manual coverage is documented in docs/BROWSER_CHECKS.md.
- Commit: Integrated a5d9d7a and f9ecc6a; the final acceptance commit records the entrypoint review fix, documentation and issue closure.
- Resources: Native runner profiles/listeners/process groups were cleaned. Orchestrator preview 4331 stopped and its owned browser page closed; worker preview 4333 was already stopped. Retained ignored report directories contain evidence, not running profiles.
- Decisions: No new dependencies, levels, mechanics, remote services or deployment. BT-003 and BT-004 remain unapproved backlog candidates.

## Result

- Summary: All approved follow-up work is accepted.
- Verification: The orchestrator independently observed zero paused draw/frame growth over 650 ms, a one-frame correct portrait resize with no tick advance, and a fresh resume anchor before normal progression. Combined automated acceptance and cleanup checks pass.
- Integration: Both scoped worker changes and the reviewed CLI guard are present in master. The normal Node evaluation remains Chromium-independent; browser acceptance is an explicit local command.
