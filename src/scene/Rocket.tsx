/**
 * The launch vehicle. Procedural stacked primitives at a stylised level of
 * detail: engine bells, two stages, interstage, and a payload fairing, with
 * livery bands and a raceway for scale.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, DoubleSide } from 'three';
import { fbm1 } from '../lib/math';
import { ROCKET } from '../mission/mission';
import { useMission } from '../mission/MissionContext';
import { PALETTE } from './palette';

const R = ROCKET.radius;

const ENGINES: [number, number][] = [
  [0.85, 0.85],
  [-0.85, 0.85],
  [-0.85, -0.85],
  [0.85, -0.85],
];

export function Rocket() {
  const group = useRef<Group>(null);
  const mission = useMission();

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { nozzleY, shudder, t } = mission.sample;

    // Structural shudder while the vehicle is held on the pad.
    const wobble = shudder * 0.09;
    const sx = (fbm1(t * 26) - 0.5) * 2 * wobble;
    const sz = (fbm1(t * 23 + 17) - 0.5) * 2 * wobble;
    const sy = (fbm1(t * 31 + 41) - 0.5) * 2 * wobble * 0.6;

    g.position.set(sx, nozzleY + sy, sz);
    g.rotation.z = sx * 0.012;
    g.rotation.x = -sz * 0.012;
  });

  return (
    <group ref={group}>
      {/* Engine bells */}
      {ENGINES.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.1, z]} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 1.05, 2.2, 16, 1, true]} />
          <meshStandardMaterial
            color="#4a4d52"
            roughness={0.42}
            metalness={0.85}
            side={DoubleSide}
            emissive={PALETTE.flameOuter}
            emissiveIntensity={0}
          />
        </mesh>
      ))}

      {/* Engine section / boat-tail */}
      <mesh position={[0, 3.0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, 1.6, 28]} />
        <meshStandardMaterial color={PALETTE.rocketDark} roughness={0.62} metalness={0.35} />
      </mesh>

      {/* Stage 1 */}
      <mesh position={[0, 10.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, 12.5, 28]} />
        <meshStandardMaterial color={PALETTE.rocketWhite} roughness={0.58} metalness={0.12} />
      </mesh>

      {/* Stage 1 accent band */}
      <mesh position={[0, 5.0, 0]} castShadow>
        <cylinderGeometry args={[R + 0.02, R + 0.02, 1.4, 28]} />
        <meshStandardMaterial color={PALETTE.accent} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Interstage */}
      <mesh position={[0, 17.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R + 0.03, R + 0.03, 1.8, 28]} />
        <meshStandardMaterial color={PALETTE.rocketDark} roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Stage 2 */}
      <mesh position={[0, 21.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R - 0.08, R - 0.08, 6.5, 28]} />
        <meshStandardMaterial color={PALETTE.rocketGrey} roughness={0.6} metalness={0.12} />
      </mesh>

      {/* Forward skirt */}
      <mesh position={[0, 25.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R - 0.04, R - 0.04, 0.9, 28]} />
        <meshStandardMaterial color={PALETTE.rocketDark} roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Payload fairing */}
      <mesh position={[0, 27.75, 0]} castShadow receiveShadow>
        <coneGeometry args={[R - 0.02, 4.5, 28]} />
        <meshStandardMaterial color={PALETTE.rocketWhite} roughness={0.5} metalness={0.14} />
      </mesh>

      {/* Grid fins */}
      {[
        [R + 0.45, 0],
        [-R - 0.45, 0],
        [0, R + 0.45],
        [0, -R - 0.45],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 16.0, z]} castShadow>
          <boxGeometry args={[0.9, 1.5, 1.9]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}

      {/* Raceway conduit running the length of the stack */}
      <mesh position={[R - 0.05, 13.5, 0.55]} castShadow>
        <boxGeometry args={[0.34, 21, 0.5]} />
        <meshStandardMaterial color={PALETTE.steelDark} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Interstage separation ring detail */}
      <mesh position={[0, 14.2, 0]}>
        <torusGeometry args={[R + 0.03, 0.09, 6, 28]} />
        <meshStandardMaterial color={PALETTE.steelDark} roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, 23.9, 0]}>
        <torusGeometry args={[R - 0.06, 0.08, 6, 28]} />
        <meshStandardMaterial color={PALETTE.steelDark} roughness={0.6} metalness={0.5} />
      </mesh>
    </group>
  );
}