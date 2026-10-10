export const TERRAIN = Object.freeze({
  '.': Object.freeze({ id: 'normal', model: 'walk', name: 'Normal ground', short: 'WALK', color: '#34576b', speed: 3.6, turnRate: 0, solid: false, lethal: false, hint: 'Full control. Release to stop and plan your next launch.' }),
  '~': Object.freeze({ id: 'soft', model: 'steer', name: 'Soft ice', short: 'GLIDE', color: '#41cbbb', speed: 4.4, turnRate: 3.2, solid: false, lethal: false, hint: 'Always moving. Hold a direction to turn; there are no brakes.' }),
  '=': Object.freeze({ id: 'hard', model: 'locked', name: 'Hard ice', short: 'SLIDE', color: '#6698ff', speed: 4.8, turnRate: 0, solid: false, lethal: false, hint: 'Direction locked. A curb stops you so you can launch again.' }),
  ':': Object.freeze({ id: 'mud', model: 'walk', name: 'Mud', short: 'SLOW', color: '#ac7652', speed: 1.5, turnRate: 0, solid: false, lethal: false, hint: 'Full control, less speed. Wait for a clear crossing.' }),
  '#': Object.freeze({ id: 'wall', model: 'walk', name: 'Low barrier', short: 'WALL', color: '#8c939b', speed: 0, turnRate: 0, solid: true, lethal: false, hint: 'Stops hard ice; bounces soft ice. Not a brake on green ice.' }),
  ' ': Object.freeze({ id: 'void', model: 'walk', name: 'Void', short: 'VOID', color: '#0b1023', speed: 0, turnRate: 0, solid: false, lethal: true, hint: 'No floor. Stay on the course.' }),
  '!': Object.freeze({ id: 'spikes', model: 'walk', name: 'Spikes', short: 'DANGER', color: '#e35b80', speed: 0, turnRate: 0, solid: false, lethal: true, hint: 'Always dangerous. Go around.' }),
});

export type Tile = keyof typeof TERRAIN;
export type Terrain = (typeof TERRAIN)[Tile];

// Even coordinate parity is the lighter group; both shades remain ordinary ground.
export const GROUND_COLORS = Object.freeze([0x486578, 0x2e414f]);
export const GROUND_WARNING_COLORS = Object.freeze([0x675039, 0x402f22]);

export const RULES = Object.freeze({
  tickRate: 120,
  radius: 0.20,
  respawnTicks: 54,
  pulseWarningTicks: 27,
  pulseEffectTicks: 36,
  pulseFlashTicks: 6,
  pulseRadius: 0.43,
  sawRadius: 0.31,
  markerRadius: 0.42,
  checkpointRadius: 1.4,
  maxCheckpointRadius: 3,
  collisionStep: 0.07,
});
