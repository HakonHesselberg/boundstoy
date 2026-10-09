import * as THREE from 'three';
import { TERRAIN, type Tile } from '../data/terrain.ts';
import { RULES } from '../data/terrain.ts';
import { center, type Level, type Point } from '../core/level.ts';
import { hazardSample, type State } from '../core/simulation.ts';
import { createSpikes, createPulse, updatePulse, WALL_HEIGHT, type PulseView } from './hazard-visuals.ts';
import { createPlayerLocator, placePlayerLocator, fitRouteSigns, type RouteSign } from './readability.ts';

const UP = new THREE.Vector3(0, 1, 0);

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  onInvalidate?: () => void;
  private disposed = false;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  private board = new THREE.Group();
  private decorations = new THREE.Group();
  private player = new THREE.Group();
  private playerLocator = createPlayerLocator();
  private routeSigns: RouteSign[] = [];
  private headingArrow = new THREE.Group();
  private deathRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private trail: THREE.Mesh[] = [];
  private trailPoints: THREE.Vector3[] = [];
  private hazards: THREE.Group[] = [];
  private pulses = new Map<number, PulseView>();
  private checkpoints: THREE.Group[] = [];
  private goal = new THREE.Group();
  private hover: THREE.Mesh;
  private level!: Level;
  private observer: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(UP, 0);
  private glow: THREE.CanvasTexture;
  private environment: THREE.WebGLRenderTarget;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private boardGeometries = new Set<THREE.BufferGeometry>();
  private boardMaterials = new Set<THREE.Material>();
  private boardTextures = new Set<THREE.Texture>();
  private lines = new Map<string, { points: number[]; color: number; opacity: number }>();
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
    const key = new THREE.DirectionalLight(0xe7faff, 2.8);
    key.position.set(3, 20, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 65 });
    key.shadow.bias = -0.001;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6277ff, 1.3);
    rim.position.set(20, 6, -6); this.scene.add(rim);
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(0x25394b);
    const lightGeometry = new THREE.PlaneGeometry(16, 12);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.6, 2), side: THREE.DoubleSide });
    const panel = new THREE.Mesh(lightGeometry, lightMaterial);
    panel.position.set(-4, 8, 3); panel.lookAt(0, 0, 0); studio.add(panel);
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environment = generator.fromScene(studio, 0.04);
    this.scene.environment = this.environment.texture;
    generator.dispose(); lightGeometry.dispose(); lightMaterial.dispose();
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

    const body = this.mesh(new THREE.CapsuleGeometry(0.23, 0.12, 5, 12),
      new THREE.MeshStandardMaterial({ color: 0xecfaff, roughness: 0.22, metalness: 0.25 }), false);
    body.position.y = 0.37; body.castShadow = true; this.player.add(body);
    const visor = this.mesh(new THREE.BoxGeometry(0.34, 0.12, 0.085),
      new THREE.MeshStandardMaterial({ color: 0x081a29, roughness: 0.2 }), false);
    visor.position.set(0, 0.41, 0.2); this.player.add(visor);
    for (const x of [-0.09, 0.09]) {
      const eye = this.mesh(new THREE.SphereGeometry(0.031, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x6bffe0 }), false);
      eye.position.set(x, 0.415, 0.25); this.player.add(eye);
    }
    const antenna = this.mesh(new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd28e }), false);
    antenna.position.set(0, 0.72, 0); this.player.add(antenna);
    this.player.add(this.halo(0x58f3dc, 1.2, false));
    const ring = this.mesh(new THREE.TorusGeometry(0.32, 0.024, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x79ffe4 }), false);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; this.player.add(ring);
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.12, 0); arrowShape.lineTo(0, -0.24); arrowShape.lineTo(0.12, 0); arrowShape.closePath();
    const arrowGeometry = new THREE.ShapeGeometry(arrowShape); arrowGeometry.rotateX(-Math.PI / 2);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xb0ffe4, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const tip = this.mesh(arrowGeometry, arrowMaterial, false); tip.position.z = 0.62; this.headingArrow.add(tip);
    const stem = this.mesh(new THREE.BoxGeometry(0.04, 0.014, 0.24), arrowMaterial, false);
    stem.position.z = 0.52; this.headingArrow.add(stem); this.scene.add(this.headingArrow);
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
  private line(points: THREE.Vector3[], color: number, opacity = 1) {
    const key = `${color}/${opacity}`;
    const batch = this.lines.get(key) ?? { points: [], color, opacity };
    for (let i = 1; i < points.length; i++) batch.points.push(...points[i - 1].toArray(), ...points[i].toArray());
    this.lines.set(key, batch);
  }
  private marker(point: Point, color: number, goal = false, label = ''): THREE.Group {
    const group = new THREE.Group();
    group.position.set(point.x + 0.5, 0, point.y + 0.5);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.4 });
    const ring = this.mesh(new THREE.TorusGeometry(goal ? 0.46 : 0.34, goal ? 0.055 : 0.022, 8, goal ? 6 : 32), mat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.055; group.add(ring);
    if (goal) {
      const portal = this.mesh(new THREE.TorusGeometry(0.43, 0.075, 8, 6), mat);
      portal.position.y = 0.62; group.add(portal);
      group.add(this.halo(color, 2));
    } else {
      const gem = this.mesh(new THREE.OctahedronGeometry(0.15), mat);
      gem.position.y = 0.4; group.add(gem);
    }
    if (label) {
      const canvas = document.createElement('canvas'); canvas.width = label.length > 2 ? 192 : 96; canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D is required for route markers.');
      context.fillStyle = '#0d1925'; context.fillRect(2, 4, canvas.width - 4, 56);
      context.strokeStyle = `#${new THREE.Color(color).getHexString()}`; context.lineWidth = 3; context.strokeRect(2, 4, canvas.width - 4, 56);
      context.fillStyle = context.strokeStyle; context.font = '600 40px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(label, canvas.width / 2, 33);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.boardTextures.add(texture);
      const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
      this.boardMaterials.add(material);
      const sign = new THREE.Sprite(material); sign.position.y = 1.05;
      sign.scale.set(label.length > 2 ? 1.7 : 0.95, 0.45, 1); group.add(sign);
      this.routeSigns.push({ sprite: sign, label });
    }
    return group;
  }
  setLevel(level: Level) {
    this.board.clear(); this.decorations.clear();
    for (const g of this.boardGeometries) g.dispose();
    for (const m of this.boardMaterials) m.dispose();
    for (const texture of this.boardTextures) texture.dispose();
    this.boardGeometries.clear(); this.boardMaterials.clear(); this.boardTextures.clear();
    this.pulses.clear();
    this.level = level; this.hazards = []; this.checkpoints = []; this.routeSigns = []; this.trailPoints = []; this.lines.clear();
    const matrix = new THREE.Object3D();
    for (const [char, terrain] of Object.entries(TERRAIN)) {
      if (char === ' ') continue;
      const cells: Point[] = [];
      level.tiles.forEach((row, y) => [...row].forEach((tile, x) => { if (tile === char) cells.push({ x, y }); }));
      if (!cells.length) continue;
      const shape = new THREE.Shape();
      shape.moveTo(-0.43, -0.43); shape.lineTo(0.43, -0.43); shape.lineTo(0.43, 0.43); shape.lineTo(-0.43, 0.43); shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: char === '#' ? 0.345 + WALL_HEIGHT : 0.34,
        bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.045, bevelThickness: 0.035 });
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: char === '~' || char === '=' ? 0.17 : 0.65,
        metalness: char === '~' || char === '=' ? 0.35 : 0.15, envMapIntensity: 0.5 });
      this.boardGeometries.add(geometry); this.boardMaterials.add(material);
      const instances = new THREE.InstancedMesh(geometry, material, cells.length);
      instances.receiveShadow = true; instances.castShadow = char === '#';
      cells.forEach((point, i) => {
        matrix.position.set(point.x + 0.5, -0.38, point.y + 0.5); matrix.updateMatrix(); instances.setMatrixAt(i, matrix.matrix);
        const tint = new THREE.Color(terrain.color).multiplyScalar(0.9 + ((point.x * 7 + point.y * 11) % 5) * 0.05);
        instances.setColorAt(i, tint);
      });
      this.board.add(instances);
      if (char === '!') this.addSpikes(cells);
      for (const cell of cells) this.tileDetails(cell, char as Tile);
    }
    const spawn = this.marker(level.spawn, 0x77ecd9, false, 'START'); this.board.add(spawn);
    this.goal = this.marker(level.goal, 0xffce85, true, 'EXIT'); this.board.add(this.goal);
    this.checkpoints = level.checkpoints.map((p, index) => {
      const marker = this.marker(p, 0x86f2dd, false, String(index + 1).padStart(2, '0')); this.board.add(marker); return marker;
    });
    for (const hazard of level.hazards) {
      const group = new THREE.Group();
      if (hazard.kind === 'pulse') {
        const view = createPulse();
        group.add(this.track(view.group));
        this.pulses.set(this.hazards.length, view);
      } else {
        const blade = this.mesh(new THREE.CylinderGeometry(RULES.sawRadius, RULES.sawRadius, 0.14, 12),
          new THREE.MeshStandardMaterial({ color: 0xff80a0, emissive: 0xe63764, emissiveIntensity: 1, metalness: 0.6, roughness: 0.25 }));
        blade.position.y = 0.24; group.add(blade);
        for (let i = 0; i < 8; i++) {
          const tooth = this.mesh(new THREE.ConeGeometry(0.11, 0.22, 3), blade.material);
          const angle = i * Math.PI / 4;
          tooth.position.set(Math.cos(angle) * 0.31, 0.24, Math.sin(angle) * 0.31);
          tooth.rotation.set(0, -angle, Math.PI / 2); group.add(tooth);
        }
        const a = center(hazard.from), b = center(hazard.to);
        this.line([new THREE.Vector3(a.x, 0.06, a.y), new THREE.Vector3(b.x, 0.06, b.y)], 0xfa7298, 0.7);
      }
      if (hazard.kind === 'saw') group.add(this.halo(0xff4477, 1.7));
      this.board.add(group); this.hazards.push(group);
    }
    for (const batch of this.lines.values()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.points, 3));
      const material = new THREE.LineBasicMaterial({ color: batch.color, transparent: true, opacity: batch.opacity });
      this.boardGeometries.add(geometry); this.boardMaterials.add(material);
      this.board.add(new THREE.LineSegments(geometry, material));
    }
    // The faint workshop grid also makes empty cells targetable in the editor.
    const grid = new THREE.GridHelper(level.tiles[0].length, level.tiles[0].length, 0x1c3852, 0x122239);
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
      for (let i = -1; i <= 1; i++) {
        this.line([new THREE.Vector3(x - 0.23, 0.012, z + i * 0.17),
          new THREE.Vector3(x + 0.23, 0.012, z + i * 0.17)], 0xc6e3ff, 0.55);
      }
    } else if (tile === ':') {
      this.line([new THREE.Vector3(x - 0.15, 0.015, z - 0.13), new THREE.Vector3(x + 0.08, 0.015, z + 0.02),
        new THREE.Vector3(x - 0.02, 0.015, z + 0.19)], 0xdfb584, 0.55);
    } else if (tile === '#') {
      const y = WALL_HEIGHT + 0.004;
      this.line([new THREE.Vector3(x - 0.4, y, z - 0.4), new THREE.Vector3(x + 0.4, y, z - 0.4),
        new THREE.Vector3(x + 0.4, y, z + 0.4), new THREE.Vector3(x - 0.4, y, z + 0.4),
        new THREE.Vector3(x - 0.4, y, z - 0.4)], 0xffd684);
      for (const offset of [-0.21, 0, 0.21]) {
        this.line([new THREE.Vector3(x + offset - 0.09, y, z - 0.23),
          new THREE.Vector3(x + offset + 0.09, y, z + 0.23)], 0x20252d);
      }
    }
    if (tile !== '#') {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (this.level.tiles[point.y + dy]?.[point.x + dx] !== ' ' && this.level.tiles[point.y + dy]?.[point.x + dx] !== undefined) continue;
        const horizontal = dy !== 0;
        const a = new THREE.Vector3(x + dx * 0.47 - (horizontal ? 0.4 : 0), -0.12, z + dy * 0.47 - (horizontal ? 0 : 0.4));
        const b = new THREE.Vector3(x + dx * 0.47 + (horizontal ? 0.4 : 0), -0.12, z + dy * 0.47 + (horizontal ? 0 : 0.4));
        this.line([a, b], 0x5798b9, 0.6);
      }
    }
  }

  resize() {
    if (this.disposed || !this.level) return;
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const aspect = width / height;
    const extent = Math.max(this.level.tiles.length * 0.85 + 3, (this.level.tiles[0].length + 2) / aspect);
    this.camera.left = -extent * aspect / 2; this.camera.right = extent * aspect / 2;
    this.camera.top = extent / 2; this.camera.bottom = -extent / 2;
    const x = this.level.tiles[0].length / 2, z = this.level.tiles.length / 2;
    this.camera.position.set(x, 25, z + 17);
    this.camera.lookAt(x, 0, z); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld(true);
    fitRouteSigns(this.routeSigns, this.camera, height);
    this.onInvalidate?.();
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
  draw(state: State, visualTime: number, editing: boolean) {
    const time = this.reducedMotion ? 0 : visualTime;
    const dead = state.respawnTicks > 0;
    const deathProgress = 1 - state.respawnTicks / RULES.respawnTicks;
    this.player.position.set(state.position.x, dead && state.deathCause === 'void' ? -0.7 * deathProgress : Math.sin(time * 3) * 0.025, state.position.y);
    this.player.scale.setScalar(dead && state.deathCause !== 'void' ? Math.max(0, 1 - deathProgress * 2) : 1);
    this.player.visible = !editing && (!dead || state.respawnTicks > 12);
    placePlayerLocator(this.playerLocator, this.camera, this.container.clientHeight, this.level, state.position);
    this.playerLocator.visible &&= !editing && !dead && !state.won;
    this.deathRing.visible = dead && !editing;
    this.deathRing.position.set(state.position.x, 0.06, state.position.y);
    this.deathRing.scale.setScalar(this.reducedMotion ? 1 : 1 + deathProgress * 2);
    this.deathRing.material.opacity = (1 - deathProgress) * 0.7;
    this.headingArrow.visible = !editing && !dead && !state.won && Math.hypot(state.velocity.x, state.velocity.y) > 0.1;
    this.headingArrow.position.set(state.position.x, 0.05, state.position.y);
    this.headingArrow.rotation.y = Math.atan2(state.velocity.x, state.velocity.y);
    if (Math.hypot(state.velocity.x, state.velocity.y) > 0.1) {
      const target = Math.atan2(state.velocity.x, state.velocity.y);
      this.player.rotation.y += Math.atan2(Math.sin(target - this.player.rotation.y), Math.cos(target - this.player.rotation.y)) * 0.18;
    }
    const tail = this.trailPoints[0];
    if (!tail || Math.hypot(tail.x - state.position.x, tail.z - state.position.y) > 0.09) {
      this.trailPoints.unshift(new THREE.Vector3(state.position.x, 0.08, state.position.y));
      this.trailPoints.length = Math.min(this.trailPoints.length, this.trail.length);
    }
    if (dead || editing || state.event === 'checkpoint') this.trailPoints = [];
    this.trail.forEach((dot, i) => {
      dot.visible = !this.reducedMotion && !!this.trailPoints[i] && Math.hypot(state.velocity.x, state.velocity.y) > 0.2;
      if (this.trailPoints[i]) dot.position.copy(this.trailPoints[i]);
      (dot.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - i / this.trail.length);
    });
    this.hazards.forEach((group, index) => {
      const hazard = this.level.hazards[index], sample = hazardSample(hazard, state.tick);
      group.position.set(sample.position.x, 0, sample.position.y);
      if (hazard.kind === 'pulse') {
        updatePulse(this.pulses.get(index)!, hazard, state.tick, this.reducedMotion);
      } else group.rotation.y = time * 6;
    });
    this.checkpoints.forEach((group, i) => {
      const p = this.level.checkpoints[i];
      const visited = state.visited.includes(`${p.x},${p.y}`);
      group.children[1].position.y = 0.4 + Math.sin(time * 2 + i) * 0.09;
      group.children[1].rotation.y = time;
      group.children[1].visible = !visited;
      const ring = group.children[0] as THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
      ring.material.emissiveIntensity = visited ? 0.2 : 0.7;
    });
    this.goal.children[1].rotation.z = Math.sin(time * 0.7) * 0.08;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true; this.onInvalidate = undefined;
    this.observer.disconnect();
    for (const g of [...this.geometries, ...this.boardGeometries]) g.dispose();
    for (const m of [...this.materials, ...this.boardMaterials]) m.dispose();
    for (const texture of this.boardTextures) texture.dispose();
    this.glow.dispose(); this.environment.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
