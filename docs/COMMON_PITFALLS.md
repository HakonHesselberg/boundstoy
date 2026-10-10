# Common pitfalls

- Do not use frame delta or visual animation time for physics or hazards.
- Do not add acceleration, drag or reverse-input braking to soft ice: it has a
  fixed speed and a bounded heading turn. Reverse is a U-turn, not a stop.
- Do not make soft ice snap to input, or allow hard ice to steer while moving.
- Soft-ice curbs reflect momentum; hard-ice curbs stop it. Do not conflate them.
- Hard-ice lock ends on leaving the surface or hitting a wall, not on key release.
- Keep hazard footprints aligned with collision radii. Pulse danger lasts one
  simulation tick; its 36-tick visual aftermath is deliberately harmless.
  Derive effect age from the cycle, not just `active`, or skipped render frames
  will hide detonations. Do not reintroduce looping flames.
  Check the entire effect lifetime in camera projection, not only world-space
  radii: tall shells and particles can obscure neighboring warning tiles.
- A level validation pass proves structure, not solvability. Keep witness replays.
- A winning fresh-start witness does not prove checkpoint recovery or human
  readability. Checkpoints belong between puzzles, never next to the exit;
  single-puzzle maps need none. Each checkpoint needs an input-driven
  death/continuation check. Larger triggers must not collect
  through walls or before the puzzle's hazardous sequence is finished.
- Imported level names are text, never `innerHTML`.
- Preserve leading/trailing spaces in tile rows: spaces represent void.
- Do not save playtest times into built-in course records.
- Do not hide storage/import failures behind empty success-shaped values.
- Rebuild/dispose Three.js resources when editing; batch static markings.
- A depth-test-free locator in the opaque pass can still be covered by later
  transparent explosions. Queue it after effects and check actual colored pixels
  during crossings, not only projected geometry or spawn positions.
- Clear held controls on blur, pause, pointer cancel and focus leaving the game.
- Never add network calls, analytics, remote fonts, or CDN imports.
- Do not vendor a large renderer fork to save a single declared dependency.
- Keep original license notices when copying open-source code or assets.
