---
{
  "id": "BT-058",
  "title": "Accept Brave Chromium input readability and presentation comfort",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-055", "BT-056"],
  "parent": "BT-038",
  "scope": ["presentation/", "index.html", "tests/browser/", "tests/mobile-readability.test.ts", "docs/BROWSER_CHECKS.md", "docs/PLATFORM.md"],
  "approval": "2026-10-10 user approved executing BT-038; collect actual browser/user acceptance and preserve its explicit prerequisites.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-058: Accept Brave Chromium input readability and presentation comfort

## Problem

Emulated Chromium viewports do not certify the user's Brave setup, physical
touch, other browser engines or comfortable presentation of combined flashes.

## Scope

Accept mandatory Chromium and actual user Brave play, input/focus, responsive
layout, reduced-motion behavior, contrast/state cues and combined flashing.
Check other browsers/devices only when actually available, recording limitations.
Fix tightly bounded presentation/input defects; no gameplay assistance,
new control system or mandatory gamepad support.

## Acceptance criteria

- [ ] The complete world is usable in the user's Brave browser, including Continue, audio gesture, checkpoint recovery and completion.
- [ ] Keyboard/pointer/touch, focus, pause, held-input clearing and controls work across the specified responsive layouts.
- [ ] Reduced-motion preference changes during a session work without removing essential timing cues.
- [ ] Mixed hazard states are recognizable without relying only on colour; full-world flashing/comfort is explicitly assessed.
- [ ] Context loss, storage denial and unsupported startup produce truthful recovery UI on supported browsers.
- [ ] A browser/device matrix states tested version/hardware and unverified cases; emulation is not reported as physical-device testing.

## Implementation context

Planning only; the user prioritizes playable gameplay and accessibility that
does not weaken it. Chromium is mandatory and the user usually uses Brave.
Do not claim Safari/Firefox/mobile support from a resized Chromium screenshot.
Large discovered fixes need separate bounded issues and acceptance reruns.

## Verification

Run `npm run release:check`, the new continuation/storage/graphics/world-editor
runners and `npm run test:motion`. Inspect 1280x900, 390x844 and 844x390 plus
DPR 1/2 and reduced-space cases. Record actual Brave/manual-device results
and full/reduced-motion flash observations; do not equate a setting with
formal photosensitivity certification.

## Handoff

Pending.

## Result

Pending.
