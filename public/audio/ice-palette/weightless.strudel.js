// Original Boundstoy composition and patch, CC0 1.0.
setcps(0.5)
stack(
  note("f4").pan(0.43),
  note("c5").pan(0.57)
).s("sine")
  .slow(16).legato(0.70)
  .attack(2.4).decay(1).sustain(0.8).release(4.2)
  .gain(0.14).lpf(1800)
  .room(0.16).roomsize(2).roomlp(1800)
