// Original Boundstoy composition and patch, CC0 1.0.
setcps(0.5)
stack(
  note("f4").s("sine").gain(0.10).pan(0.48),
  note("[c6,a6]").s("sine").fm(0.08).fmh(3).gain(0.014).pan(0.52)
).lpf(3200)
  .slow(16).legato(0.70).attack(3).decay(0.8).sustain(0.8).release(4.2)
  .room(0.20).roomsize(2.5).roomlp(2500)
