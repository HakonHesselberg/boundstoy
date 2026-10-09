---
{
  "id": "BT-019",
  "title": "Integrate and accept the pre-playtest hardening batch",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-003", "BT-004", "BT-017", "BT-018"],
  "parent": null,
  "scope": ["README.md", "CLAUDE.md", "docs/", "package.json", "package-lock.json", "tasks/"],
  "approval": "User directed autonomous completion of the proposed four-part pre-playtest batch on 2026-10-09.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-019: Integrate and accept the pre-playtest hardening batch

## Problem

Independent readability, integration and robustness work must remain compatible
and be documented without implying that automated checks prove enjoyment.

## Scope

Integrate reviewed scoped changes, wire the optional Astro check into root npm
scripts, update related release/verification documents, and close accepted issues.
Keep the game static and dependency-light, with nine unchanged course definitions
and no difficulty changes. Do not expand into more levels or unrelated features.

## Acceptance criteria

- [ ] The four accepted issues are integrated with no conflicting changes or lost existing behaviour.
- [ ] All exact course witnesses, full evaluation, production browser stress checks and real Astro consumer checks pass.
- [ ] Readability evidence includes actual screen-space measurements and desktop/mobile inspection.
- [ ] Documentation distinguishes verified integration/robustness from remaining human and physical-device questions.
- [ ] Owned resources are stopped, commits are clean, tracker evidence is complete and no remote deployment is performed.

## Implementation context

Baseline is release 0.4.0 at cd2b04a. Use at most two isolated workers, with
direct orchestrator work on the primary tree. Only the orchestrator changes
canonical tasks. Version/scripts changes do not authorize new runtime dependencies.

## Verification

Review scoped diffs and actual evidence, run combined checks and inspect the
rendered result. Verify cleanup using recorded process/profile/port identities.

## Handoff

Pending.

## Result

Pending.
