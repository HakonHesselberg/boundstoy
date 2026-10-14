// V1 ceilings are compatibility constraints, including the historical JS string limit.
export const V1_LIMITS = Object.freeze({
  minWidth: 8, maxWidth: 40, minHeight: 6, maxHeight: 32,
  hazards: 80, checkpoints: 30, importCharacters: 100_000,
});

// Provisional defensive budgets, NOT hardware/performance certification.
// 20,480 cells (long thin worlds may be up to 320 wide); 8x the old hazard budget;
// bounded JSON before parsing.
export const V2_LIMITS = Object.freeze({
  minWidth: 8, maxWidth: 320, minHeight: 6, maxHeight: 128, maxCells: 20_480,
  hazards: 640, checkpoints: 63, sections: 64, importBytes: 1_000_000,
});
