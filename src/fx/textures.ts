/**
 * Procedural canvas textures. Keeping these generated at runtime avoids any
 * binary asset dependency while still giving the sprites soft, organic shapes.
 */
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { fbm1, hash1 } from '../lib/math';

const cache = new Map<string, Texture>();

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

function finish(key: string, canvas: HTMLCanvasElement, srgb = true): Texture {
  const texture = new CanvasTexture(canvas);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

/** Soft round falloff used for engine glow and flare sprites. */
export function glowTexture(): Texture {
  const hit = cache.get('glow');
  if (hit) return hit;

  const { canvas, ctx } = makeCanvas(256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,246,214,0.92)');
  g.addColorStop(0.3, 'rgba(255,186,96,0.45)');
  g.addColorStop(0.55, 'rgba(255,132,48,0.16)');
  g.addColorStop(0.8, 'rgba(255,110,40,0.04)');
  g.addColorStop(1.0, 'rgba(255,96,32,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  return finish('glow', canvas);
}

/** Blobby, slightly noisy puff for exhaust and deluge smoke. */
export function smokeTexture(): Texture {
  const hit = cache.get('smoke');
  if (hit) return hit;

  const size = 256;
  const { canvas, ctx } = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);

  // Cluster of soft lobes gives the puff an irregular silhouette.
  const lobes = 26;
  for (let i = 0; i < lobes; i++) {
    const a = hash1(i * 3.1) * Math.PI * 2;
    const r = hash1(i * 7.7 + 1.3) * 62;
    const cx = 128 + Math.cos(a) * r;
    const cy = 128 + Math.sin(a) * r;
    const radius = 34 + hash1(i * 11.9 + 5.1) * 46;
    const alpha = 0.1 + hash1(i * 17.3 + 2.2) * 0.16;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.5})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central mass so the puff reads as a volume rather than a ring of blobs.
  const core = ctx.createRadialGradient(128, 128, 0, 128, 128, 108);
  core.addColorStop(0, 'rgba(255,255,255,0.72)');
  core.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  core.addColorStop(0.75, 'rgba(255,255,255,0.14)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // Fade the border so sprites never show a hard square edge.
  const mask = ctx.createRadialGradient(128, 128, 96, 128, 128, 128);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  return finish('smoke', canvas);
}

/** Thin, streaky cirrus used for the high altitude haze layers. */
export function cloudTexture(): Texture {
  const hit = cache.get('cloud');
  if (hit) return hit;

  const size = 256;
  const { canvas, ctx } = makeCanvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Stretched noise reads as wind-sheared cirrus rather than blobs.
      const n = fbm1(u * 7.5 + v * 1.6) * 0.6 + fbm1(u * 17.3 + v * 3.1 + 40) * 0.4;
      let a = Math.max(0, n - 0.42) * 2.4;
      a *= Math.sin(Math.PI * u) * Math.sin(Math.PI * v); // fade edges
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  ctx.putImageData(image, 0, 0);

  return finish('cloud', canvas);
}

/** Vertical white-hot to transparent ramp used for the exhaust core. */
export function flameGradientTexture(): Texture {
  const hit = cache.get('flame');
  if (hit) return hit;

  const w = 64;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,246,205,0.95)');
  g.addColorStop(0.42, 'rgba(255,196,110,0.72)');
  g.addColorStop(0.68, 'rgba(250,138,60,0.34)');
  g.addColorStop(0.88, 'rgba(220,96,44,0.12)');
  g.addColorStop(1.0, 'rgba(200,80,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Horizontal falloff so the plume has soft sides.
  const side = ctx.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  return finish('flame', canvas);
}

/** Returns the full palette warm-to-cool ramp used by the smoke tinting. */
export function tintForHeat(heat: number, out: [number, number, number]) {
  const warmR = 1.0;
  const warmG = 0.62;
  const warmB = 0.34;
  const coolR = 0.86;
  const coolG = 0.88;
  const coolB = 0.9;
  out[0] = coolR + (warmR - coolR) * heat;
  out[1] = coolG + (warmG - coolG) * heat;
  out[2] = coolB + (warmB - coolB) * heat;
  return out;
}