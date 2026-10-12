/**
 * Cosmetic explosion styles. A style never changes timing, footprint or
 * lethality; puzzles use it to colour rhythm groups. Colours are sRGB hex.
 *
 * - frame:  idle hazard frame and the fuse's starting colour
 * - hot:    the fuse's burning colour near ignition
 * - core:   near white-hot ignition centre (brighter than `hot`)
 * - burst:  saturated eruption colour
 * - scorch: spent ground mark
 * - debris: cooled, desaturated aftermath
 */
export type ExplosionMotif = 'petals' | 'ring' | 'cloud' | 'swirl';
export type ExplosionStyleDefinition = Readonly<{
  id: string; name: string; inspiration: string; motif: ExplosionMotif;
  frame: number; hot: number; core: number; burst: number; scorch: number; debris: number;
}>;

export const EXPLOSION_STYLES = Object.freeze({
  ember: Object.freeze({ id: 'ember', name: 'Ember', inspiration: 'Scourge burst', motif: 'petals',
    frame: 0xff9a2e, hot: 0xffc66b, core: 0xfff4d6, burst: 0xff7a1e, scorch: 0x3a2416, debris: 0x9fa9b4 }),
  plasma: Object.freeze({ id: 'plasma', name: 'Plasma', inspiration: 'Protoss flash', motif: 'ring',
    frame: 0x4d7dff, hot: 0x8fb4ff, core: 0xeef4ff, burst: 0x3f6dff, scorch: 0x18213d, debris: 0x9ea7b8 }),
  toxic: Object.freeze({ id: 'toxic', name: 'Toxic', inspiration: 'Zerg cloud', motif: 'cloud',
    frame: 0x8fe03a, hot: 0xc4f27a, core: 0xf6ffe0, burst: 0x6fd12a, scorch: 0x22301a, debris: 0xa2ab9b }),
  psionic: Object.freeze({ id: 'psionic', name: 'Psionic', inspiration: 'Dark Archon swirl', motif: 'swirl',
    frame: 0xc06bff, hot: 0xdcaaff, core: 0xfaf0ff, burst: 0xa84dff, scorch: 0x2c1a3a, debris: 0xaaa2b6 }),
} satisfies Record<string, ExplosionStyleDefinition>);

export type ExplosionStyleId = keyof typeof EXPLOSION_STYLES;
export const EXPLOSION_STYLE_IDS = Object.freeze(Object.keys(EXPLOSION_STYLES) as ExplosionStyleId[]);
export const DEFAULT_EXPLOSION_STYLE: ExplosionStyleId = 'ember';
/** Dark line around every frame band so it separates from light and dark floors alike. */
export const FRAME_KEYLINE = 0x0b1118;
/** Pads outside the running puzzle: same frame, no style colour. */
export const DORMANT_FRAME = 0x6f7d88;

export const isExplosionStyle = (value: unknown): value is ExplosionStyleId =>
  typeof value === 'string' && Object.hasOwn(EXPLOSION_STYLES, value);
export const explosionStyle = (pulse: Readonly<{ style?: ExplosionStyleId }>): ExplosionStyleDefinition =>
  EXPLOSION_STYLES[pulse.style ?? DEFAULT_EXPLOSION_STYLE];
