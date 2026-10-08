# Common pitfalls

- Do not use frame delta or visual animation time for physics or hazards.
- Do not add acceleration, drag or reverse-input braking to soft ice: it has a
  fixed speed and a bounded heading turn. Reverse is a U-turn, not a stop.
- Do not make soft ice snap to input, or allow hard ice to steer while moving.
- Soft-ice curbs reflect momentum; hard-ice curbs stop it. Do not conflate them.
- Hard-ice lock ends on leaving the surface or hitting a wall, not on key release.
- Keep hazard meshes and collision radii/active phases aligned.
- A level validation pass proves structure, not solvability. Keep witness replays.
- Imported level names are text, never `innerHTML`.
- Preserve leading/trailing spaces in tile rows: spaces represent void.
- Do not save playtest times into built-in course records.
- Do not hide storage/import failures behind empty success-shaped values.
- Rebuild/dispose Three.js resources when editing; batch static markings.
- Clear held controls on blur, pause, pointer cancel and focus leaving the game.
- Never add network calls, analytics, remote fonts, or CDN imports.
- Do not vendor a large renderer fork to save a single declared dependency.
- Keep original license notices when copying open-source code or assets.
