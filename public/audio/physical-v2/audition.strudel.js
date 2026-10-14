// Strudel: Sounds > import-sounds > Import sounds folder.
// Select public/audio/physical-v2. Its subfolders become the eleven sound names.
// No upload, sample server, stock drums or external sample URLs are needed.
// Historical palette: blast is the retired pressure crack, not the approved Airy puff.
// Retry and buttons are also historical, not the approved Falling feather and Soft tick.
setcpm(5)

// One cue per second at the original physical-palette relative levels.
s("step mud soft hard bump warning blast death checkpoint win ui ~")
  .gain("0.06 0.055 0.035 0.0325 0.095 0.075 0.12 0.095 0.09 0.10 0.045 0")

// Replace the pattern above with this to audition a busier gameplay mix:
// setcpm(30)
// stack(
//   s("step*4").gain(0.06),
//   s("~ warning blast ~").gain(0.075),
//   s("~ ~ ~ checkpoint").gain(0.09)
// )
