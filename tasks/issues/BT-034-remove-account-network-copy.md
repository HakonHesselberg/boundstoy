---
{
  "id": "BT-034",
  "title": "Remove account network and local-record promotional copy",
  "type": "chore",
  "status": "ready",
  "priority": "P2",
  "depends_on": [],
  "parent": "BT-038",
  "scope": ["index.html", "presentation/", "tests/"],
  "approval": "2026-10-10 user approved implementation of the entire BT-038 plan, including reused presentation issues.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-034: Remove account network and local-record promotional copy

## Problem

The user wants "No account. No network. Records stay on this device." and
similar text removed. The player-facing interface should focus on playing.

## Scope

Remove the quoted menu note and equivalent promotional statements throughout
the player-facing UI, including the noscript fallback. Remove styling made
unused by this change. Keep necessary capability and storage-failure messages;
do not change persistence, networking or account behavior.

## Acceptance criteria

- [ ] The quoted text and equivalent account/offline/local-only promotional copy are absent from player-facing UI.
- [ ] Menus and fallbacks have no empty copy containers or leftover spacing.
- [ ] The JavaScript/WebGL2 requirement and actionable errors remain clear.
- [ ] Local records and all existing game behavior are unchanged.

## Implementation context

Requested on 2026-10-10 as issue creation, not implementation approval.
`index.html` contains the exact `.menu-note` text and a noscript statement:
"No account or internet connection is needed after loading."
Audit runtime-generated copy as well as static HTML.

## Verification

Run `npm test` and `npm run build`.
Search static and runtime UI sources for the quoted text and semantic variants.
Inspect the menu and JavaScript-disabled fallback at 1280x900 and 390x844;
record screenshots showing the resulting layout and retained capability text.

## Handoff

Pending.

## Result

Pending.
