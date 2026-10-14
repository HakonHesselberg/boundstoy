---
{
  "id": "BT-091",
  "title": "Repair restored Chromium playback mute",
  "type": "bug",
  "status": "done",
  "priority": "P1",
  "depends_on": [],
  "parent": null,
  "scope": ["docs/AUDIO.md", "tasks/issues/BT-091-chromium-playback-mute.md"],
  "approval": "User reports inaudible explosion listening page and requests autonomous resolution; repair playback without audible automated previews or raising speaker volume.",
  "assignment": null,
  "blocked_reason": null
}
---
# BT-091: Repair restored Chromium playback mute

## Problem

The explosion listening page was inaudible despite the shared +12 dB output
correction. Chromium playback was restored muted at 100% application volume.

## Scope

Repair the local saved output mute through the supported mixer API and document
the distinction between playback gain and application mute. No new gain changes,
sound selection, microphone changes, persistent services or browser configuration.

## Acceptance criteria

- [x] Confirm the system mute independently of the page's playback status.
- [x] Clear the saved Chromium output mute without changing channel volume.
- [x] A fresh Chromium-identity stream restores unmuted at unchanged volume.
- [x] Check whether existing muted browser automation reproduces the problem.
- [x] Remove owned verification streams without audible previews.

## Implementation context

The actual Chromium playback stream was muted at 100%, and WirePlumber's
`stream-properties` contained `Output/Audio:application.name:Chromium` with
`"mute":true`. A digital-zero `pacat` stream using `application.name=Chromium`
and an identifying `boundstoy.purpose` property inherited the same mute and
`sink-input-by-application-name:Chromium` restore identity.

## Verification

- `pactl set-sink-input-mute 75459 0` unmuted only the identified, owned silent
  repair stream. Both channel values stayed 65536 (100%).
- WirePlumber saved `"mute":false`; no direct state-file editing was used.
- `node tests/browser/audio-output.ts` passed: all 42 individual choices gained
  12 dB, with 110 output measurements and maximum peak 0.850000024.
  Evidence: `artifacts/browser-check/run-IiNWx6/report.json` and
  `artifacts/audio-output/run-HuOsP8/measurements.json`.
- Saved Chromium mute remained false after that muted browser check.
- A newly created digital-zero stream (75487) with the same Chromium restore
  identity started unmuted at 100% on both channels.
- Both owned streams were stopped; `pactl` confirmed no repair streams remained.
- The existing listening-page server still returned HTTP 200 on port 4321.

## Handoff

- Summary: Saved application mute repaired and its restoration verified.
- Changes: Local Chromium output mute; audio troubleshooting documentation.
- Verification: Live stream state, saved state, fresh-stream restoration and
  existing muted browser output check, as recorded above.
- Risks: The original cause of the saved mute is unknown. The automation check
  did not reproduce it, so no speculative launcher changes were made. Speaker
  audibility and subjective sound acceptance were not claimed from silent checks.
- Commit: Uncommitted documentation in the primary working tree.
- Resources: `boundstoy-mute-repair` and `boundstoy-mute-verify` stopped. Browser
  check cleaned its owned browser, profile and preview. Existing server untouched.
- Decisions: Preserve speaker volume, source files and the calibrated audio graph.

## Result

- Summary: Accepted the verified saved-mute repair, not a new sound palette.
- Verification: The mixer restores new Chromium playback unmuted; the existing
  audio-output check passed without restoring the mute.
- Integration: Local mixer repair applied; documentation integrated directly.
