// Original Boundstoy composition and patch, CC0 1.0.
setcps(0.5)
stack(note("g4").pan(0.35), note("d5").pan(0.65))
  .s("triangle").lpf(1350).lpq(0.4)
  .slow(16).legato(0.70).attack(2.4).decay(0.8).sustain(0.8).release(4.2)
  .gain(0.12).room(0.12).roomsize(2).roomlp(2000)
