---
{
  "id": "BT-057",
  "title": "Measure and meet full-world performance and resource budgets",
  "type": "chore",
  "status": "ready",
  "priority": "P1",
  "depends_on": ["BT-055", "BT-056"],
  "parent": "BT-038",
  "scope": ["presentation/", "application/render-loop.ts", "tests/render-loop.test.ts", "tests/browser/scenarios.ts", "tests/browser/motion-clips.ts", "docs/TESTING.md", "docs/BROWSER_CHECKS.md"],
  "approval": "2026-10-10 user approved executing BT-038; collect actual measurements and preserve its explicit prerequisites.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-057: Measure and meet full-world performance and resource budgets

## Problem

Software-WebGL captures and small-course checks do not establish smooth hardware
performance for a complete world with section transitions and mixed effects.

## Scope

Measure representative hardware performance, scene transitions and resource
lifetime on the accepted world. Fix measured bottlenecks using existing
instancing/disposal patterns. Larger architecture changes need bounded
follow-ups, not speculative optimization. Never weaken hazard visibility,
input responsiveness or simulation correctness to meet a frame target.

## Acceptance criteria

- [ ] Hardware/browser, resolution/DPR, measurement method and sample durations are recorded.
- [ ] Initial desktop targets of 60 Hz, p95 intervals at most 20 ms and no routine transition stall over 100 ms are measured and explicitly accepted or revised with evidence.
- [ ] Densest play, camera movement, repeated deaths/reloads and a long session show no unbounded resource growth.
- [ ] Paused/hidden gameplay remains idle and supported 30/60/120/144 Hz schedules preserve simulation outcomes.
- [ ] Any quality adaptation preserves required cues and is justified by measured benefit.
- [ ] Software-renderer measurements and untested physical-device performance are clearly distinguished.

## Implementation context

Planning only; BT-038's numeric targets are proposed budgets, not established
guarantees. BT-037's software-rendering before/after measurements are useful
historical evidence, not a hardware acceptance pass. Preserve continuous
world clocks and the existing bounded-stall policy.

BT-052 rough-world baseline: `artifacts/bt052/motion/frame-pacing.json`,
browser run `run-Ydf9jh`, Linux Chromium 151 with SwiftShader, 1280x900,
four seconds of live world play. Observed 21 intervals: mean 189.67 ms,
p95 283.3 ms, maximum 616.7 ms. This is poor software-renderer performance,
not an accepted budget or a hardware measurement. The reporting-only clip
command exits successfully without a pacing threshold. Inspect actual Brave
hardware behavior before treating the rough candidate as smooth; preserve
this baseline when profiling/fixing the accepted world's rendering.

## Verification

Run `npm test`, `npm run build`, `npm run test:browser` and the relevant
motion/world-browser scenarios. Collect hardware frame intervals and repeated
resource counts on the same frozen candidate. Record exact test conditions,
before/after improvements and remaining supported-device limitations.

## Handoff

Pending.

## Result

Pending.
