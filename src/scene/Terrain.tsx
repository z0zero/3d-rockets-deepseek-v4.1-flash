/**
 * Terrain: one displaced ground plane with per-vertex colour variation, plus a
 * ring of low-poly hills on the horizon for depth. The area around the pad is
 * kept flat so the launch complex sits naturally on the site.
 */
import { useMemo } from 'react';
import { BufferAttribute, Color, PlaneGeometry } from 'three';
import { fbm1 } from '../lib/math';
import { PALETTE } from './palette';

const GROUND_SIZE = 9000;
const SEGMENTS = 110;
const FLAT_RADIUS = 130;

export function Ground() {
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const position = geo.attributes.position;
    const colors = new Float32Array(position.count * 3);

    const near = PALETTE.terrainNear.clone();
    const dry = PALETTE.terrainDry.clone();
    const far = PALETTE.terrainFar.clone();
    const scratch = new Color();

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const r = Math.hypot(x, z);

      // Rolling ground, flattened around the launch complex.
      const flatten = Math.min(1, Math.max(0, (r - FLAT_RADIUS) / 280));
      const broad = (fbm1(x * 0.0009 + 11.2) - 0.5) * 46 + (fbm1(z * 0.0011 + 5.4) - 0.5) * 40;
      const fine = (fbm1(x * 0.006 + z * 0.004) - 0.5) * 4.5;
      const y = (broad + fine) * flatten;
      position.setY(i, y);

      // Patchy scrub: greener in the hollows, drier on the rises.
      const mix = Math.min(1, Math.max(0, (y + 14) / 40));
      scratch.copy(near).lerp(dry, mix * 0.55);

      // Aerial perspective toward the horizon.
      const distanceFade = Math.min(1, Math.max(0, (r - 1400) / 3200));
      scratch.lerp(far, distanceFade);

      colors[i * 3] = scratch.r;
      colors[i * 3 + 1] = scratch.g;
      colors[i * 3 + 2] = scratch.b;
    }

    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

/** A distant ring of hills, hazed out by the scene fog. */
export function Hills() {
  const hills = useMemo(() => {
    const list: { x: number; z: number; radius: number; height: number; rotation: number }[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + fbm1(i * 3.7) * 0.2;
      const distance = 1900 + fbm1(i * 5.1 + 2.2) * 1100;
      list.push({
        x: Math.cos(angle) * distance,
        z: Math.sin(angle) * distance,
        radius: 320 + fbm1(i * 2.3 + 7.7) * 420,
        height: 70 + fbm1(i * 4.4 + 1.1) * 165,
        rotation: fbm1(i * 8.8) * Math.PI,
      });
    }
    return list;
  }, []);

  return (
    <group>
      {hills.map((hill, i) => (
        <mesh
          key={i}
          position={[hill.x, hill.height / 2 - 20, hill.z]}
          rotation={[0, hill.rotation, 0]}
        >
          <coneGeometry args={[hill.radius, hill.height, 5]} />
          <meshStandardMaterial color={PALETTE.terrainFar} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}