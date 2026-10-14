// Original Boundstoy composition and patch, CC0 1.0.
setcps(0.5)
stack(
  note("c5").pan(0.40),
  note("f5").pan(0.50),
  note("a5").pan(0.60)
).s("triangle").vowel("o")
  .slow(16).legato(0.70)
  .attack(3.2).decay(0.7).sustain(0.75).release(4.2)
  .gain(0.10).lpf(2200).lpq(0.4)
  .room(0.28).roomsize(3).roomlp(2200)
