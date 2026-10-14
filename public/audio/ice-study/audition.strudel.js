// Import public/audio/ice-study via Sounds > import-sounds > Import sounds folder.
// Four-second loops; no uploaded samples or external runtime dependency.
setcpm(15)
stack(
  s("wind").lpf(1800).gain(0.045),
  // Set the pad gain to 0 for wind only, or 0.011 for the quiet chord.
  s("pad").gain(0.011)
)
