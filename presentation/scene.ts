import * as THREE from 'three';
import { TERRAIN, GROUND_COLORS, type Tile } from '../data/terrain.ts';
import { RULES } from '../data/terrain.ts';
import { center, type Level, type Point } from '../core/level.ts';
import { hazardEnabled, hazardSample, hazardTick, type State } from '../core/simulation.ts';
import { createSpikes, createPulse, updatePulse, createPulseField, pulseFieldMode, createSawBlade, createSawPath, SAW_HALO_SIZE,
  type PulseView, type PulseField } from './hazard-visuals.ts';
import { createStrokeGeometry } from './stroke-visuals.ts';
import { createWalls, createContactShadeGeometry } from './wall-visuals.ts';
import { createPlayerLocator, placePlayerLocator, fitRouteSigns, createRouteSign, type RouteSign } from './readability.ts';
import { MOTION, PlayerMotion, clamp01, damp, dampAngle, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic } from './motion.ts';
import { createCheckpointZoneGeometry, createZoneTexture } from './marker-visuals.ts';
import { createMudPebbles, createFloorTexture } from './terrain-visuals.ts';
import { createPlayerModel, playerDetailsVisible } from './player-visuals.ts';
import { CheckpointCamera, selectWorldView, fitWorldFrame, type WorldView } from './world-camera.ts';

const UP = new THREE.Vector3(0, 1, 0);
/** Default terrain-glyph stroke: about 1 px at desktop world scale, wider when closer. */
const STROKE_WIDTH = 0.03;
/** Only the player, spikes and saws cast shadows now; walls use baked contact shading. */
export const SHADOW_MAP_SIZE = 1024;
const GEM_GEOMETRY = new THREE.OctahedronGeometry(0.15);
/** A recent player position, newest first; `fade` falls from 1 once its run stops. */
type TrailPoint = { position: THREE.Vector3; fade: number };

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  onInvalidate?: () => void;
  private disposed = false;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  private key = new THREE.DirectionalLight(0xe7faff, 2.8);
  private board = new THREE.Group();
  private decorations = new THREE.Group();
  private player = new THREE.Group();
  /** Body parts that squash, stretch and lean; the footprint ring stays rigid. */
  private rig!: THREE.Group;
  private antenna!: THREE.Mesh;
  private playerDetails!: THREE.Group;
  private motion = new PlayerMotion();
  private lastVisualTime = 0;
  private turnRate = 0;
  private winStart: number | null = null;
  private playerLocator = createPlayerLocator();
  private routeSigns: RouteSign[] = [];
  private headingArrow!: THREE.Group;
  private deathRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private trail: THREE.Mesh[] = [];
  private trailPoints: TrailPoint[] = [];
  private hazards: THREE.Group[] = [];
  private pulses = new Map<number, PulseView>();
  /** Idle pads share three batched draws; live pads switch to their own view. */
  private pulseField: PulseField | null = null;
  private pulseFieldIndex = new Map<number, number>();
  private checkpoints: THREE.Group[] = [];
  private goal = new THREE.Group();
  private hover: THREE.Mesh;
  private level!: Level;
  private worldView: WorldView | null = null;
  private checkpointCamera: CheckpointCamera | null = null;
  private cameraNeedsSnap = true;
  private levelBuilds = 0;
  private viewWidth = 0;
  private viewHeight = 0;
  private observer: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(UP, 0);
  private glow: THREE.CanvasTexture;
  private zoneTexture: THREE.CanvasTexture;
  private floorTexture: THREE.CanvasTexture;
  private environment: THREE.WebGLRenderTarget;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private boardGeometries = new Set<THREE.BufferGeometry>();
  private boardMaterials = new Set<THREE.Material>();
  private boardTextures = new Set<THREE.Texture>();
  private lines = new Map<string, { points: number[]; color: number; opacity: number; width: number; vertical: boolean }>();
  private grid: THREE.GridHelper | null = null;
  /** One emissive material per marker colour for the current level. */
  private markerMaterials = new Map<number, THREE.MeshStandardMaterial>();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.prepend(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xb8dfff, 0x172b42, 1.3));
    const key = this.key;
    key.position.set(3, 20, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    Object.assign(key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 65 });
    key.shadow.bias = -0.001;
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x6277ff, 1.3);
    rim.position.set(20, 6, -6); this.scene.add(rim);
    this.environment = this.createEnvironment();
    this.scene.environment = this.environment.texture;
    this.scene.add(this.board, this.decorations, this.player, this.playerLocator);
    this.playerLocator.traverse(object => {
      if (object instanceof THREE.Mesh) {
        this.geometries.add(object.geometry); this.materials.add(object.material);
      }
    });

    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is required to create the local glow texture.');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.25)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    this.glow = new THREE.CanvasTexture(canvas);
    this.zoneTexture = createZoneTexture();
    this.floorTexture = createFloorTexture();

    const model = createPlayerModel();
    this.rig = model.rig; this.antenna = model.antenna; this.playerDetails = model.details;
    this.headingArrow = model.headingArrow;
    for (const part of [model.rig, model.ring, model.headingArrow]) part.traverse(object => {
      if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material); }
    });
    this.player.add(this.rig);
    this.player.add(this.halo(0x58f3dc, 1.2, false));
    this.player.add(model.ring);
    this.scene.add(this.headingArrow);
    const deathGeometry = new THREE.TorusGeometry(0.32, 0.025, 6, 32);
    const deathMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b99, transparent: true, opacity: 0.7, depthWrite: false });
    this.geometries.add(deathGeometry); this.materials.add(deathMaterial);
    this.deathRing = new THREE.Mesh(deathGeometry, deathMaterial);
    this.deathRing.rotation.x = -Math.PI / 2; this.deathRing.visible = false; this.scene.add(this.deathRing);
    for (let i = 0; i < 14; i++) {
      const dot = this.mesh(new THREE.SphereGeometry(0.04, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0x58ffe0, transparent: true, opacity: 0 }), false);
      this.scene.add(dot); this.trail.push(dot);
    }
    this.hover = this.mesh(new THREE.BoxGeometry(0.96, 0.055, 0.96),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), false);
    this.hover.visible = false; this.scene.add(this.hover);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
  }

  private createEnvironment() {
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(0x25394b);
    const geometry = new THREE.PlaneGeometry(16, 12);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.6, 2), side: THREE.DoubleSide });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(-4, 8, 3); panel.lookAt(0, 0, 0); studio.add(panel);
    const generator = new THREE.PMREMGenerator(this.renderer);
    try { return generator.fromScene(studio, 0.04); }
    finally { generator.dispose(); geometry.dispose(); material.dispose(); }
  }
  releaseGraphics() {
    // Dispose while the context is lost, before Three replaces its caches.
    // This also removes old target disposal listeners holding stale GL objects.
    this.environment.dispose();
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
  }
  /** Rebuild GPU-only targets after Three resets its caches; CPU-backed assets
   * upload natively, without a level rebuild or a second renderer.
   */
  restoreGraphics() {
    if (this.disposed || this.renderer.getContext().isContextLost()) throw new Error('Graphics are still unavailable.');
    this.environment = this.createEnvironment();
    this.scene.environment = this.environment.texture;
    this.renderer.shadowMap.needsUpdate = true;
  }
  verifyGraphics() {
    const gl = this.renderer.getContext();
    const error = gl.getError();
    if (gl.isContextLost() || error !== gl.NO_ERROR) throw new Error(`Graphics resources could not be drawn (${error}).`);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, board = true) {
    (board ? this.boardGeometries : this.geometries).add(geometry);
    (board ? this.boardMaterials : this.materials).add(material);
    return new THREE.Mesh(geometry, material);
  }
  private track(group: THREE.Group) {
    group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        this.boardGeometries.add(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => this.boardMaterials.add(material));
      }
    });
    return group;
  }
  private addSpikes(cells: Point[]) {
    const template = this.track(createSpikes());
    template.updateMatrixWorld(true);
    const meshes = template.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    const geometries = new Set(meshes.map(mesh => mesh.geometry));
    const matrix = new THREE.Matrix4();
    for (const geometry of geometries) {
      const parts = meshes.filter(mesh => mesh.geometry === geometry);
      const instances = new THREE.InstancedMesh(geometry, parts[0].material, cells.length * parts.length);
      instances.castShadow = parts[0].castShadow; instances.receiveShadow = true;
      cells.forEach((point, cell) => parts.forEach((part, index) => {
        matrix.makeTranslation(point.x + 0.5, 0, point.y + 0.5).multiply(part.matrixWorld);
        instances.setMatrixAt(cell * parts.length + index, matrix);
      }));
      this.board.add(instances);
    }
  }
  private halo(color: number, size: number, board = true) {
    const material = new THREE.SpriteMaterial({ map: this.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    (board ? this.boardMaterials : this.materials).add(material);
    const sprite = new THREE.Sprite(material); sprite.scale.set(size, size, 1); sprite.position.y = 0.25;
    return sprite;
  }
  /** Batched world-unit strokes (see stroke-visuals); `vertical` strokes sit on side faces. */
  private line(points: THREE.Vector3[], color: number, opacity = 1, width = STROKE_WIDTH, vertical = false) {
    const key = `${color}/${opacity}/${width}/${vertical}`;
    const batch = this.lines.get(key) ?? { points: [], color, opacity, width, vertical };
    for (let i = 1; i < points.length; i++) batch.points.push(...points[i - 1].toArray(), ...points[i].toArray());
    this.lines.set(key, batch);
  }
  private marker(point: Point, color: number, goal = false, label = '', radius = goal ? 0.46 : 0.34,
    zone?: THREE.BufferGeometry): THREE.Group {
    const group = new THREE.Group();
    group.position.set(point.x + 0.5, 0, point.y + 0.5);
    const mat = this.markerMaterial(color);
    if (zone) {
      // Collection area painted on reachable floor only; walls can no longer cut it into arcs.
      const area = this.mesh(zone, new THREE.MeshBasicMaterial({ color, map: this.zoneTexture, transparent: true,
        depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      area.position.y = 0.004; group.add(area);
    } else {
      const ring = this.mesh(new THREE.TorusGeometry(radius, goal ? 0.055 : 0.022, 8, goal ? 6 : 32), mat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.055; group.add(ring);
    }
    if (goal) {
      const portal = this.mesh(new THREE.TorusGeometry(0.43, 0.075, 8, 6), mat);
      portal.position.y = 0.62; group.add(portal);
      group.add(this.halo(color, 2));
    } else {
      const gem = this.mesh(GEM_GEOMETRY, mat);
      gem.position.y = 0.4; group.add(gem);
    }
    if (label) {
      const { sprite, material, texture } = createRouteSign(label, color);
      this.boardTextures.add(texture); this.boardMaterials.add(material);
      group.add(sprite);
      this.routeSigns.push({ sprite, label });
    }
    return group;
  }
  private markerMaterial(color: number) {
    let material = this.markerMaterials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.4 });
      this.markerMaterials.set(color, material);
    }
    return material;
  }
  setLevel(level: Level) {
    this.levelBuilds++;
    if (this.worldView && level.version === 1) {
      this.key.position.set(3, 20, 7); this.key.target.position.set(0, 0, 0);
    }
    this.checkpointCamera = level.version === 2 ? new CheckpointCamera(level) : null;
    this.cameraNeedsSnap = true;
    this.worldView = this.checkpointCamera?.update(center(level.spawn), [], 0, true) ?? null;
    this.board.clear(); this.decorations.clear();
    for (const g of this.boardGeometries) g.dispose();
    for (const m of this.boardMaterials) m.dispose();
    for (const texture of this.boardTextures) texture.dispose();
    this.boardGeometries.clear(); this.boardMaterials.clear(); this.boardTextures.clear(); this.markerMaterials = new Map();
    this.pulses.clear(); this.motion.reset(); this.winStart = null;
    this.level = level; this.hazards = []; this.checkpoints = []; this.routeSigns = []; this.trailPoints = []; this.lines.clear();
    const matrix = new THREE.Object3D();
    for (const [char, terrain] of Object.entries(TERRAIN)) {
      if (char === ' ' || char === '#') continue;
      const cells: Point[] = [];
      level.tiles.forEach((row, y) => [...row].forEach((tile, x) => { if (tile === char) cells.push({ x, y }); }));
      if (!cells.length) continue;
      // Gapless slab from the wall base to the y = 0 play plane; the hairline texture draws the cells.
      const geometry = new THREE.BoxGeometry(1, 0.38, 1).translate(0, 0.19, 0);
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: char === '~' || char === '=' ? 0.17 : 0.65,
        metalness: char === '~' || char === '=' ? 0.35 : 0.15, envMapIntensity: 0.5,
        // Headless test views have no canvas texture.
        ...(this.floorTexture ? { map: this.floorTexture } : {}) });
      this.boardGeometries.add(geometry); this.boardMaterials.add(material);
      const instances = new THREE.InstancedMesh(geometry, material, cells.length);
      instances.receiveShadow = true;
      cells.forEach((point, i) => {
        matrix.position.set(point.x + 0.5, -0.38, point.y + 0.5); matrix.updateMatrix(); instances.setMatrixAt(i, matrix.matrix);
        const tint = char === '.' ? new THREE.Color(GROUND_COLORS[(point.x + point.y) % 2])
          : new THREE.Color(terrain.color).multiplyScalar(0.9 + ((point.x * 7 + point.y * 11) % 5) * 0.05);
        instances.setColorAt(i, tint);
      });
      this.board.add(instances);
      if (char === '!') this.addSpikes(cells);
      if (char === ':') this.board.add(this.track(new THREE.Group().add(createMudPebbles(cells))));
      for (const cell of cells) this.tileDetails(cell, char as Tile);
    }
    if (level.tiles.some(row => row.includes('#'))) {
      this.board.add(this.track(createWalls(level.tiles)));
      const shade = this.mesh(createContactShadeGeometry(level.tiles), new THREE.MeshBasicMaterial({ color: 0x000000,
        vertexColors: true, transparent: true, depthWrite: false }));
      shade.name = 'contact-shade'; this.board.add(shade);
    }
    const spawn = this.marker(level.spawn, 0x77ecd9, false, 'START'); this.board.add(spawn);
    this.goal = this.marker(level.goal, 0xffce85, true, 'EXIT'); this.board.add(this.goal);
    this.checkpoints = level.checkpoints.map((p, index) => {
      const radius = p.radius ?? RULES.markerRadius;
      const marker = this.marker(p, 0x86f2dd, false, String(index + 1).padStart(2, '0'), radius,
        createCheckpointZoneGeometry(level.tiles, p, radius));
      this.board.add(marker); return marker;
    });
    for (const hazard of level.hazards) {
      const group = new THREE.Group();
      if (hazard.kind === 'pulse') {
        const view = createPulse(hazard.style);
        group.add(this.track(view.group));
        this.pulses.set(this.hazards.length, view);
      } else {
        group.add(this.track(createSawBlade()));
        this.board.add(this.track(createSawPath(hazard.from, hazard.to)));
      }
      if (hazard.kind === 'saw') group.add(this.halo(0xff4477, SAW_HALO_SIZE));
      this.board.add(group); this.hazards.push(group);
    }
    const pads = level.hazards.flatMap((hazard, index) => hazard.kind === 'pulse' ? [{ hazard, index }] : []);
    this.pulseFieldIndex = new Map(pads.map(({ index }, fieldIndex) => [index, fieldIndex]));
    this.pulseField = pads.length ? createPulseField(pads.map(({ hazard }) => hazard)) : null;
    if (this.pulseField) this.board.add(this.track(this.pulseField.group));
    for (const batch of this.lines.values()) {
      const strokes = this.mesh(createStrokeGeometry(batch.points, batch.width, batch.vertical),
        new THREE.MeshBasicMaterial({ color: batch.color, transparent: true, opacity: batch.opacity,
          depthWrite: false, side: THREE.DoubleSide }));
      strokes.name = 'strokes';
      this.board.add(strokes);
    }
    // Editor-only workshop grid: shows empty cells while painting, hidden in play.
    const grid = new THREE.GridHelper(level.tiles[0].length, level.tiles[0].length, 0x1c3852, 0x122239);
    grid.name = 'editor-grid'; this.grid = grid;
    grid.position.set(level.tiles[0].length / 2, -0.48, level.tiles.length / 2);
    this.boardGeometries.add(grid.geometry);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach(m => { this.boardMaterials.add(m); m.transparent = true; m.opacity = 0.32; });
    this.board.add(grid);
    this.resize();
  }

  private tileDetails(point: Point, tile: Tile) {
    const x = point.x + 0.5, z = point.y + 0.5;
    const lines: THREE.Vector3[] = [];
    if (tile === '~') {
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        lines.push(new THREE.Vector3(x - 0.3 + t * 0.6, 0.012, z + Math.sin(t * Math.PI * 2 + point.y) * 0.1));
      }
      this.line(lines, 0x9effee, 0.45);
    } else if (tile === '=') {
      // Scored, diagonal streaks: frozen and locked, unlike the waves of soft ice.
      for (const offset of [-0.14, 0.14]) {
        this.line([new THREE.Vector3(x - 0.2 + offset, 0.012, z + 0.2), new THREE.Vector3(x + 0.08 + offset, 0.012, z - 0.2)],
          0x5f7fa8, 0.7);
      }
    }
    if (tile !== '#') {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (this.level.tiles[point.y + dy]?.[point.x + dx] !== ' ' && this.level.tiles[point.y + dy]?.[point.x + dx] !== undefined) continue;
        const horizontal = dy !== 0;
        // Lip along the tile's exposed side, just proud of the face so it is never z-fighting.
        const a = new THREE.Vector3(x + dx * 0.502 - (horizontal ? 0.45 : 0), -0.12, z + dy * 0.502 - (horizontal ? 0 : 0.45));
        const b = new THREE.Vector3(x + dx * 0.502 + (horizontal ? 0.45 : 0), -0.12, z + dy * 0.502 + (horizontal ? 0 : 0.45));
        this.line([a, b], 0x5798b9, 0.6, 0.035, true);
      }
    }
  }

  /** Editing aids that must never appear behind play. */
  private syncEditorAids(editing: boolean) {
    if (this.grid) this.grid.visible = editing;
  }

  resize(updateRenderer = true) {
    if (this.disposed || !this.level) return;
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    // View switches happen inside draw: do not resize the canvas or enqueue
    // another RAF merely because a follow/connector frame changed.
    if (updateRenderer || width !== this.viewWidth || height !== this.viewHeight) {
      this.renderer.setSize(width, height);
      this.viewWidth = width; this.viewHeight = height;
    }
    const aspect = width / height;
    const fit = this.level.version === 2 && this.worldView ? fitWorldFrame(this.worldView.frame, aspect) : null;
    const extent = fit?.extent ?? Math.max(this.level.tiles.length * 0.85 + 3, (this.level.tiles[0].length + 2) / aspect);
    this.camera.left = -extent * aspect / 2; this.camera.right = extent * aspect / 2;
    this.camera.top = extent / 2; this.camera.bottom = -extent / 2;
    const x = fit?.x ?? this.level.tiles[0].length / 2, z = fit?.z ?? this.level.tiles.length / 2;
    // A very long connector can fit in x/y yet cross the near plane. Pull
    // back along the same viewing angle; orthographic scale remains unchanged.
    const elevation = fit && this.worldView ? Math.max(25, this.worldView.frame.height / 2) : 25;
    this.camera.far = Math.max(100, elevation * 3);
    this.camera.position.set(x, elevation, z + elevation * 17 / 25);
    this.camera.lookAt(x, 0, z); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    if (fit) {
      this.key.position.set(x + 3, 20, z + 7);
      this.key.target.position.set(x, 0, z);
    }
    this.scene.updateMatrixWorld(true);
    fitRouteSigns(this.routeSigns, this.camera, height);
    if (updateRenderer) this.onInvalidate?.();
  }

  pick(clientX: number, clientY: number): Point | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!hit) return null;
    const point = { x: Math.floor(hit.x), y: Math.floor(hit.z) };
    return this.level.tiles[point.y]?.[point.x] !== undefined ? point : null;
  }
  project(point: Point) {
    const p = new THREE.Vector3(point.x + 0.5, 0, point.y + 0.5).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height };
  }
  highlight(point: Point | null) {
    const changed = this.hover.visible !== !!point || !!point
      && (this.hover.position.x !== point.x + 0.5 || this.hover.position.z !== point.y + 0.5);
    this.hover.visible = !!point;
    if (point) this.hover.position.set(point.x + 0.5, 0.04, point.y + 0.5);
    if (changed) this.onInvalidate?.();
  }
  /** Observe one simulation step for presentation-only motion cues. */
  record(before: State, after: State, input: Point) {
    this.motion.record(before, after, input);
  }
  /**
   * `alpha` is the fraction of a tick elapsed since the latest step (1 = exactly
   * the current state). Movement is interpolated from the previous tick, which
   * delays the drawn position by at most one 8.3 ms tick and never affects input.
   */
  draw(state: State, visualTime: number, editing: boolean, alpha = 1) {
    const reduced = this.reducedMotion;
    const time = reduced ? 0 : visualTime;
    const dt = Math.min(Math.max(visualTime - this.lastVisualTime, 0), 0.1);
    this.lastVisualTime = visualTime;
    this.syncEditorAids(editing);
    const dead = state.respawnTicks > 0;
    const deathProgress = 1 - state.respawnTicks / RULES.respawnTicks;
    const position = editing ? state.position : this.motion.position(state, alpha);
    if (this.level.version === 2) {
      const next = editing ? selectWorldView(this.level, position)
        : this.checkpointCamera!.update(position, state.visited, visualTime, reduced || this.cameraNeedsSnap);
      if (!editing) this.cameraNeedsSnap = false;
      const before = this.worldView?.frame;
      this.worldView = next;
      if (!before || before.x !== next.frame.x || before.y !== next.frame.y
        || before.width !== next.frame.width || before.height !== next.frame.height
        || this.viewWidth !== this.container.clientWidth || this.viewHeight !== this.container.clientHeight) this.resize(false);
    }
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const speedShare = Math.min(speed / MOTION.maxSpeed, 1);

    if (state.won && !editing) this.winStart ??= visualTime; else this.winStart = null;
    const win = this.winStart === null || reduced ? 0 : clamp01((visualTime - this.winStart) / MOTION.winSeconds);
    const winLift = clamp01((win - 0.15) / 0.85);
    const winSquash = win > 0 && win < 0.2 ? Math.sin(Math.PI * win / 0.2) * 0.7 : 0;

    let x = position.x, z = position.y, y = Math.sin(time * 3) * 0.025 + Math.sin(Math.PI * winLift) * 0.55, scale = 1;
    if (dead && state.deathCause === 'void') {
      // Arc: keep the pre-death drift while gravity accelerates the fall.
      y = -0.9 * deathProgress ** 2;
      if (!reduced) { x += this.motion.fall.x * 0.12 * deathProgress; z += this.motion.fall.y * 0.12 * deathProgress; }
    } else if (dead) scale = Math.max(0, 1 - easeInCubic(Math.min(deathProgress * 2, 1)));
    const pop = reduced ? 1 : 0.35 + 0.65 * easeOutBack(this.motion.spawn(state, alpha));
    scale *= 1 - easeInCubic(clamp01((win - 0.45) / 0.55));
    this.player.position.set(x, y, z);
    this.player.scale.setScalar(scale);
    this.player.visible = !editing && (!dead || state.respawnTicks > 12) && scale > 0.001;

    let turn = 0;
    if (speed > 0.1 && !dead) {
      const target = Math.atan2(state.velocity.x, state.velocity.y), before = this.player.rotation.y;
      this.player.rotation.y = reduced ? target : dampAngle(before, target, MOTION.yawRate, dt);
      if (dt > 0) turn = (this.player.rotation.y - before) / dt;
    }
    this.turnRate = damp(this.turnRate, turn, 10, dt);
    const squash = reduced ? 0 : this.motion.squash(state, alpha) + winSquash;
    const motionShare = reduced ? 0 : speedShare;
    this.rig.scale.set(1 + 0.14 * squash - 0.03 * motionShare, 1 - 0.24 * squash - 0.04 * motionShare,
      1 + 0.12 * motionShare + 0.08 * squash).multiplyScalar(pop);
    this.rig.rotation.set(0.08 * motionShare, reduced ? 0 : easeInOutCubic(winLift) * Math.PI * 2,
      reduced ? 0 : Math.max(-0.22, Math.min(0.22, -this.turnRate * 0.045)));
    // Follow-through: the antenna trails motion and whips forward on impact.
    this.antenna.position.set(0, 0.72 - 0.05 * squash, -0.06 * motionShare + 0.08 * squash);

    this.playerDetails.visible = playerDetailsVisible(this.container.clientHeight / (this.camera.top - this.camera.bottom));
    placePlayerLocator(this.playerLocator, this.camera, this.container.clientHeight, this.level, position);
    this.playerLocator.visible &&= !editing && !dead && !state.won;
    this.deathRing.visible = dead && !editing;
    this.deathRing.position.set(state.position.x, 0.06, state.position.y);
    this.deathRing.scale.setScalar(reduced ? 1 : 1 + easeOutCubic(deathProgress) * 2);
    this.deathRing.material.opacity = (1 - deathProgress) ** 1.5 * 0.75;
    this.headingArrow.visible = !editing && !dead && !state.won && speed > 0.1;
    this.headingArrow.position.set(position.x, 0.05, position.y);
    this.headingArrow.rotation.y = Math.atan2(state.velocity.x, state.velocity.y);
    // A run's dots stay lit while it moves; once it stops they fade out and are
    // dropped, and a relaunch starts a new run rather than relighting old dots.
    const moving = speed > 0.2, fading = dt / MOTION.trailFadeSeconds;
    for (const point of this.trailPoints) if (!moving || point.fade < 1) point.fade = Math.max(0, point.fade - fading);
    while (this.trailPoints.at(-1)?.fade === 0) this.trailPoints.pop();
    const head = this.trailPoints[0]?.position;
    if (moving && (!head || Math.hypot(head.x - position.x, head.z - position.y) > 0.09)) {
      this.trailPoints.unshift({ position: new THREE.Vector3(position.x, 0.08, position.y), fade: 1 });
      this.trailPoints.length = Math.min(this.trailPoints.length, this.trail.length);
    }
    if (dead || editing || state.event === 'checkpoint') this.trailPoints = [];
    this.trail.forEach((dot, i) => {
      const point = this.trailPoints[i];
      dot.visible = !reduced && !!point;
      if (point) dot.position.copy(point.position);
      (dot.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - i / this.trail.length) * (point?.fade ?? 0);
    });
    // Saws share the player's interpolated moment; pulses stay on exact ticks.
    const sawTick = hazardTick(state) - (this.motion.previous?.patternOffset === state.patternOffset
      && !dead && !editing ? 1 - Math.min(alpha, 1) : 0);
    this.hazards.forEach((group, index) => {
      const hazard = this.level.hazards[index];
      const enabled = editing || hazardEnabled(this.level, hazard, state);
      group.userData.enabled = enabled;
      if (hazard.kind === 'pulse') {
        const sample = hazardSample(hazard, hazardTick(state)), view = this.pulses.get(index)!;
        group.position.set(sample.position.x, 0, sample.position.y);
        updatePulse(view, hazard, hazardTick(state), reduced, enabled);
        const mode = pulseFieldMode(sample, enabled);
        view.group.visible = mode === 'hidden' || !this.pulseField;
        this.pulseField?.setMode(this.pulseFieldIndex.get(index)!, mode);
      } else {
        group.visible = enabled;
        const sample = hazardSample(hazard, enabled ? sawTick : 0);
        group.position.set(sample.position.x, 0, sample.position.y);
        group.rotation.y = enabled ? time * 6 : 0;
      }
    });
    this.checkpoints.forEach((group, i) => {
      const p = this.level.checkpoints[i];
      const visited = state.visited.includes(`${p.x},${p.y}`);
      const collect = reduced ? 1 : this.motion.collect(`${p.x},${p.y}`, state);
      const gem = group.children[1];
      if (visited && collect < 1) {
        // Collected: pop up and out instead of vanishing.
        gem.visible = true;
        gem.position.y = 0.4 + easeOutCubic(collect) * 0.35;
        gem.scale.setScalar(collect < 0.4 ? 1 + 0.5 * easeOutCubic(collect / 0.4) : 1.5 * (1 - easeInCubic((collect - 0.4) / 0.6)));
      } else {
        gem.visible = !visited; gem.scale.setScalar(1);
        gem.position.y = 0.4 + Math.sin(time * 2 + i) * 0.09;
      }
      gem.rotation.y = time;
      const area = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      // On collection the zone fades from full strength to a faint trace.
      area.material.opacity = visited ? 0.3 + 0.7 * (1 - collect) : 1;
    });
    this.goal.children[1].rotation.z = Math.sin(time * 0.7) * 0.08;
    this.goal.children[1].scale.setScalar(1 + 0.3 * Math.sin(Math.PI * win));
    this.goal.children[2].scale.setScalar(2 + 0.6 * Math.sin(Math.PI * win));
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true; this.onInvalidate = undefined;
    this.observer.disconnect();
    for (const g of [...this.geometries, ...this.boardGeometries]) g.dispose();
    for (const m of [...this.materials, ...this.boardMaterials]) m.dispose();
    for (const texture of this.boardTextures) texture.dispose();
    this.glow.dispose(); this.zoneTexture.dispose(); this.floorTexture.dispose(); this.environment.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
  /** Read-only observability for opt-in production browser fixtures. */
  inspectView() {
    return {
      view: this.worldView, levelBuilds: this.levelBuilds,
      extent: this.camera.top * 2,
      player: { x: this.player.position.x, y: this.player.position.z },
      hazards: this.hazards.map((group, index) => {
        const pulse = this.pulses.get(index);
        return { x: group.position.x, y: group.position.z,
          visible: group.visible, enabled: group.userData.enabled === true,
          warning: pulse?.warning.visible ?? false, burst: pulse?.burst.visible ?? false,
          glow: pulse?.warning.visible ? pulse.tint.material.opacity : 0 };
      }),
    };
  }
}
