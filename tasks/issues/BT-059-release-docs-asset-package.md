---
{
  "id": "BT-059",
  "title": "Prepare accurate release documentation licenses and static artifacts",
  "type": "chore",
  "status": "ready",
  "priority": "P2",
  "depends_on": ["BT-054", "BT-055", "BT-056", "BT-057", "BT-058", "BT-062"],
  "parent": "BT-038",
  "scope": ["README.md", "CLAUDE.md", "docs/", "public/", "index.html", "package.json", "package-lock.json", "scripts/", ".github/workflows/"],
  "approval": "2026-10-10 user approved local implementation of BT-038; no paid services, account creation or publication authorized.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-059: Prepare accurate release documentation licenses and static artifacts

## Problem

The repository still contains obsolete campaign instructions, and a release
needs traceable licenses, truthful compatibility claims and reproducible bytes.

## Scope

Align runtime/authoring/release docs and package metadata with the accepted
launch scope. Audit external assets and bundle notices. Produce a versioned
static artifact and deployment/rollback instructions for the chosen destination.
Use existing build tools; CI is optional if already available at zero cost.
No spending, account creation or publication.

## Acceptance criteria

- [ ] Active documentation matches world structure, clock rules, exact continuation, records, editor behavior and actual inspection indices.
- [ ] Historical campaigns/evidence are clearly historical rather than active release promises.
- [ ] Every external asset has source, author, exact license and required credits bundled; game-icons.net assets are not mislabeled CC0/MIT.
- [ ] The versioned complete static artifact includes all assets/notices and identifies its source revision.
- [ ] Supported browsers, best-effort save recovery and storage-origin/revision limitations are truthful.
- [ ] HTTPS/MIME/cache/nested-path deployment requirements, atomic asset publication and rollback steps are documented.
- [ ] Instructions include a feasible feedback route without adding game telemetry or a backend.

## Implementation context

Planning only; BT-054 fixes the launch scope/destination and BT-057/058 provide
real compatibility evidence. Prefer original/CC0 assets. Game-icons.net's
official about page states CC BY 3.0 with author attribution.
Root artifact creation does not authorize a release commit, tag or upload.

## Verification

Run documentation checks that exist, `npm run tasks:check` and `npm run build`.
Inspect the artifact inventory, licenses, version identity and referenced
commands against current source. Verify zero additional runtime services.
If distributing the Astro wrapper, run `npm run test:astro` and document the
actual embedding policy; otherwise do not imply that check covers this host.

## Handoff

Pending.

## Result

Pending.
