---
{
  "id": "BT-061",
  "title": "Publish the authorized static release and verify rollback",
  "type": "chore",
  "status": "backlog",
  "priority": "P2",
  "depends_on": ["BT-060"],
  "parent": "BT-038",
  "scope": ["docs/PLATFORM.md", "docs/TESTING.md", "scripts/", ".github/workflows/", "tasks/issues/BT-061-publish-static-release.md"],
  "approval": null,
  "assignment": null,
  "blocked_reason": null
}
---
# BT-061: Publish the authorized static release and verify rollback

## Problem

A verified local artifact is not a released game until the intended website
serves it correctly and the exact prior release can be restored.

## Scope

After explicit deployment authorization, publish the approved complete static
artifact to the destination chosen in BT-054. Verify the hosted game, version,
asset behavior and rollback procedure. Do not create paid services/accounts,
change unrelated site content or add runtime network dependencies.
Local metadata scope does not by itself authorize remote mutations.

## Acceptance criteria

- [ ] The user has explicitly authorized the destination, release artifact and any needed remote changes.
- [ ] All artifact bytes/notices are published consistently under the correct HTTPS path and asset cache/MIME rules.
- [ ] A clean browser loads the expected release and supports play, continuation, sound opt-in, completion and reload after deployment.
- [ ] Nested paths/embedding are checked when used; changed origin or incompatible content saves are handled as documented.
- [ ] The previous complete artifact is retained and rollback is rehearsed safely or explicitly verified without an unauthorized live rollback.
- [ ] Published URL/version, production observations and feedback route are recorded.

## Implementation context

Planning only; BT-060 identifies the frozen accepted artifact. Approval to
create this issue or implement local code is not approval to deploy.
Use an existing/zero-cost website and keep the game static. Record real
publication evidence rather than marking done from a localhost screenshot.

## Verification

Check actual hosted asset requests, clean-cache boot, gameplay and save/reload
in Chromium/Brave. Compare the hosted release identity to BT-060. Inspect
rollback bytes/procedure and any host-specific policies. Record exact actions,
owned resources and production outcome in the handoff/result.

## Handoff

Pending.

## Result

Pending.
