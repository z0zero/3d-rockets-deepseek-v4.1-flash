/**
 * A pooled, instanced billboard particle field.
 *
 * Billboards are built from a quad that is offset in view space, so particles
 * have no point-size ceiling and can grow to tens of world units when the
 * camera is close to the pad. Per-particle colour, size and alpha live in
 * instanced attributes, giving each puff its own life cycle.
 */
import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  type Blending,
  type Texture,
} from 'three';

const VERTEX = /* glsl */ `
  attribute vec3 iOffset;
  attribute vec3 iColor;
  attribute float iSize;
  attribute float iAlpha;
  attribute float iRot;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vColor = iColor;
    vAlpha = iAlpha;

    vec4 mv = modelViewMatrix * vec4(iOffset, 1.0);

    float c = cos(iRot);
    float s = sin(iRot);
    vec2 corner = position.xy * iSize;
    vec2 rotated = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);

    // Offsetting in view space billboards the quad toward the camera.
    mv.xy += rotated;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec3 uTint;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float a = tex.a * vAlpha * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * uTint * tex.rgb, a);
    #include <colorspace_fragment>
  }
`;

export interface SpawnConfig {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Lifetime in seconds. */
  life: number;
  /** Billboard size in world units at birth and at death. */
  size: [number, number];
  /** Linear-space RGB at birth and at death. */
  color: [Color, Color];
  alpha: [number, number];
  /** Velocity damping per second (0 = no drag). */
  drag?: number;
  /** Upward acceleration, for buoyant smoke. */
  buoyancy?: number;
  /** Random walk strength. */
  turbulence?: number;
  rotation?: number;
  spin?: number;
}

interface FieldOptions {
  capacity: number;
  texture: Texture;
  blending?: Blending;
  opacity?: number;
  depthWrite?: boolean;
}

/** Live instance registry, used by the development render probe. */
const registry = new Set<ParticleField>();

export function totalLiveParticles() {
  let total = 0;
  registry.forEach((field) => {
    total += field.liveCount;
  });
  return total;
}

export class ParticleField {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;

  private readonly capacity: number;
  private cursor = 0;

  private readonly offset: Float32Array;
  private readonly velocity: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  // Live values, uploaded to the GPU every frame.
  private readonly sizeStart: Float32Array;
  private readonly sizeEnd: Float32Array;
  private readonly alphaStart: Float32Array;
  private readonly alphaEnd: Float32Array;
  private readonly colorStart: Float32Array;
  private readonly colorEnd: Float32Array;

  // Values at birth, kept separate so the live arrays can be interpolated.
  private readonly sizeBirth: Float32Array;
  private readonly alphaBirth: Float32Array;
  private readonly colorBirth: Float32Array;
  private readonly drag: Float32Array;
  private readonly buoyancy: Float32Array;
  private readonly turbulence: Float32Array;
  private readonly rotation: Float32Array;
  private readonly spin: Float32Array;
  private readonly seed: Float32Array;

  private readonly offsetAttr: InstancedBufferAttribute;
  private readonly colorAttr: InstancedBufferAttribute;
  private readonly sizeAttr: InstancedBufferAttribute;
  private readonly alphaAttr: InstancedBufferAttribute;
  private readonly rotAttr: InstancedBufferAttribute;

  private readonly material: ShaderMaterial;

  constructor({ capacity, texture, blending = NormalBlending, opacity = 1, depthWrite = false }: FieldOptions) {
    this.capacity = capacity;
    this.offset = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.sizeStart = new Float32Array(capacity);
    this.sizeEnd = new Float32Array(capacity);
    this.alphaStart = new Float32Array(capacity);
    this.alphaEnd = new Float32Array(capacity);
    this.colorStart = new Float32Array(capacity * 3);
    this.colorEnd = new Float32Array(capacity * 3);

    this.sizeBirth = new Float32Array(capacity);
    this.alphaBirth = new Float32Array(capacity);
    this.colorBirth = new Float32Array(capacity * 3);
    this.drag = new Float32Array(capacity);
    this.buoyancy = new Float32Array(capacity);
    this.turbulence = new Float32Array(capacity);
    this.rotation = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.seed = new Float32Array(capacity);

    const quad = new PlaneGeometry(1, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.attributes.position = quad.attributes.position;
    geometry.attributes.uv = quad.attributes.uv;
    geometry.instanceCount = capacity;

    this.offsetAttr = new InstancedBufferAttribute(this.offset, 3);
    this.colorAttr = new InstancedBufferAttribute(this.colorStart, 3);
    this.sizeAttr = new InstancedBufferAttribute(this.sizeStart, 1);
    this.alphaAttr = new InstancedBufferAttribute(this.alphaStart, 1);
    this.rotAttr = new InstancedBufferAttribute(this.rotation, 1);

    this.offsetAttr.setUsage(DynamicDrawUsage);
    this.colorAttr.setUsage(DynamicDrawUsage);
    this.sizeAttr.setUsage(DynamicDrawUsage);
    this.alphaAttr.setUsage(DynamicDrawUsage);
    this.rotAttr.setUsage(DynamicDrawUsage);

    geometry.setAttribute('iOffset', this.offsetAttr);
    geometry.setAttribute('iColor', this.colorAttr);
    geometry.setAttribute('iSize', this.sizeAttr);
    geometry.setAttribute('iAlpha', this.alphaAttr);
    geometry.setAttribute('iRot', this.rotAttr);

    this.material = new ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uOpacity: { value: opacity },
        uTint: { value: new Color(1, 1, 1) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite,
      depthTest: true,
      blending,
      side: DoubleSide,
    });

    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    registry.add(this);
  }

  get liveCount() {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.life[i] > 0) n++;
    return n;
  }

  setTint(color: Color) {
    this.material.uniforms.uTint.value.copy(color);
  }

  setOpacity(value: number) {
    this.material.uniforms.uOpacity.value = value;
  }

  /** Kills every live particle; used when the mission clock jumps. */
  clear() {
    this.life.fill(0);
    this.alphaStart.fill(0);
    this.cursor = 0;
    this.alphaAttr.needsUpdate = true;
  }

  /** Adds one particle, recycling the oldest slot when the pool is full. */
  spawn(cfg: SpawnConfig) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const i3 = i * 3;

    this.offset[i3] = cfg.x;
    this.offset[i3 + 1] = cfg.y;
    this.offset[i3 + 2] = cfg.z;

    this.velocity[i3] = cfg.vx ?? 0;
    this.velocity[i3 + 1] = cfg.vy ?? 0;
    this.velocity[i3 + 2] = cfg.vz ?? 0;

    this.life[i] = cfg.life;
    this.maxLife[i] = cfg.life;

    this.sizeStart[i] = cfg.size[0];
    this.sizeEnd[i] = cfg.size[1];
    this.sizeBirth[i] = cfg.size[0];

    this.alphaStart[i] = cfg.alpha[0];
    this.alphaEnd[i] = cfg.alpha[1];
    this.alphaBirth[i] = cfg.alpha[0];

    cfg.color[0].toArray(this.colorStart, i3);
    cfg.color[1].toArray(this.colorEnd, i3);
    cfg.color[0].toArray(this.colorBirth, i3);

    this.drag[i] = cfg.drag ?? 0;
    this.buoyancy[i] = cfg.buoyancy ?? 0;
    this.turbulence[i] = cfg.turbulence ?? 0;
    this.rotation[i] = cfg.rotation ?? 0;
    this.spin[i] = cfg.spin ?? 0;
    this.seed[i] = Math.random() * 1000;
  }

  update(dt: number, time: number) {
    const { capacity } = this;
    let anyAlive = false;

    for (let i = 0; i < capacity; i++) {
      if (this.life[i] <= 0) continue;
      anyAlive = true;

      const remaining = (this.life[i] -= dt);
      if (remaining <= 0) {
        this.life[i] = 0;
        this.alphaStart[i] = 0;
        continue;
      }

      const i3 = i * 3;
      const age = 1 - remaining / this.maxLife[i];

      const drag = this.drag[i];
      if (drag > 0) {
        const damping = Math.exp(-drag * dt);
        this.velocity[i3] *= damping;
        this.velocity[i3 + 1] *= damping;
        this.velocity[i3 + 2] *= damping;
      }

      if (this.buoyancy[i] !== 0) this.velocity[i3 + 1] += this.buoyancy[i] * dt;

      const turb = this.turbulence[i];
      if (turb > 0) {
        const s = this.seed[i];
        this.velocity[i3] += Math.sin(time * 1.4 + s) * turb * dt;
        this.velocity[i3 + 1] += Math.sin(time * 1.1 + s * 1.7) * turb * 0.6 * dt;
        this.velocity[i3 + 2] += Math.cos(time * 1.3 + s * 2.3) * turb * dt;
      }

      this.offset[i3] += this.velocity[i3] * dt;
      this.offset[i3 + 1] += this.velocity[i3 + 1] * dt;
      this.offset[i3 + 2] += this.velocity[i3 + 2] * dt;

      // Puffs expand quickly then settle.
      const grow = 1 - (1 - age) * (1 - age);
      this.sizeStart[i] = this.sizeBirth[i] + (this.sizeEnd[i] - this.sizeBirth[i]) * grow;

      // Opacity holds early and falls away late.
      const fade = age * age;
      this.alphaStart[i] = this.alphaBirth[i] + (this.alphaEnd[i] - this.alphaBirth[i]) * fade;

      // Heat bleeds off faster than opacity.
      const cool = Math.pow(age, 0.7);
      this.colorStart[i3] = this.colorBirth[i3] + (this.colorEnd[i3] - this.colorBirth[i3]) * cool;
      this.colorStart[i3 + 1] = this.colorBirth[i3 + 1] + (this.colorEnd[i3 + 1] - this.colorBirth[i3 + 1]) * cool;
      this.colorStart[i3 + 2] = this.colorBirth[i3 + 2] + (this.colorEnd[i3 + 2] - this.colorBirth[i3 + 2]) * cool;

      if (this.spin[i] !== 0) this.rotation[i] += this.spin[i] * dt;
    }

    if (anyAlive) {
      this.offsetAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
      this.sizeAttr.needsUpdate = true;
      this.alphaAttr.needsUpdate = true;
      this.rotAttr.needsUpdate = true;
    }
  }

  dispose() {
    registry.delete(this);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}