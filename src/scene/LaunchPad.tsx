/**
 * The launch pad: concrete deck, flame trench, launch mount with hold-down
 * clamps, and the deluge plumbing that feeds the smoke at ignition.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { smoothstep } from '../lib/math';
import { ROCKET } from '../mission/mission';
import { useMission } from '../mission/MissionContext';
import { PALETTE } from './palette';

const DECK_RADIUS = 36;
const MOUNT_TOP = ROCKET.padTop;

const MOUNT_BEAMS: { size: [number, number, number]; position: [number, number, number] }[] = [
    { size: [11, 0.8, 1.1], position: [0, MOUNT_TOP - 0.1, 5.2] },
    { size: [11, 0.8, 1.1], position: [0, MOUNT_TOP - 0.1, -5.2] },
    { size: [1.1, 0.8, 11], position: [5.2, MOUNT_TOP - 0.1, 0] },
    { size: [1.1, 0.8, 11], position: [-5.2, MOUNT_TOP - 0.1, 0] },
  ];

const CLAMP_POSITIONS: [number, number][] = [
    [2.7, 2.7],
    [-2.7, 2.7],
    [-2.7, -2.7],
    [2.7, -2.7],
  ];

const MOUNT_LEGS: [number, number][] = [
    [4.8, 4.8],
    [-4.8, 4.8],
    [-4.8, -4.8],
    [4.8, -4.8],
  ];

export function LaunchPad() {
  const clamps = useRef<Group>(null);
  const mission = useMission();

  const delugeRing = useMemo(() => {
    const nozzles: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      nozzles.push([Math.cos(angle) * 21, 1.1, Math.sin(angle) * 21]);
    }
    return nozzles;
  }, []);

  useFrame(() => {
    const group = clamps.current;
    if (!group) return;
    // Hold-downs release shortly after liftoff and swing clear.
    const release = smoothstep(0, 0.75, mission.sample.t);
    group.children.forEach((child, i) => {
      const direction = i % 2 === 0 ? 1 : -1;
      child.rotation.y = direction * release * 1.15;
      child.position.y = MOUNT_TOP + 0.2 + release * 0.5;
    });
  });

  return (
    <group>
      {/* Concrete deck */}
      <mesh position={[0, 0.35, 0]} receiveShadow>
        <cylinderGeometry args={[DECK_RADIUS, DECK_RADIUS + 1.5, 0.7, 56]} />
        <meshStandardMaterial color={PALETTE.concrete} roughness={0.95} metalness={0} />
      </mesh>

      {/* Asphalt apron around the deck */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[DECK_RADIUS + 13, DECK_RADIUS + 14, 0.12, 56]} />
        <meshStandardMaterial color={PALETTE.asphalt} roughness={1} metalness={0} />
      </mesh>

      {/* Flame trench opening and deflector */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[15, 1.1, 15]} />
        <meshStandardMaterial color="#2b2c2b" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 1.7, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[9.5, 2.6, 4]} />
        <meshStandardMaterial color="#3a3b39" roughness={1} metalness={0.1} />
      </mesh>

      {/* Launch mount: four legs and a table ring */}
      {MOUNT_LEGS.map(([x, z], i) => (
        <mesh key={i} position={[x, MOUNT_TOP / 2 + 0.5, z]} castShadow>
          <boxGeometry args={[0.85, MOUNT_TOP - 0.5, 0.85]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.7} metalness={0.35} />
        </mesh>
      ))}

      {MOUNT_BEAMS.map((beam, i) => (
        <mesh key={i} position={beam.position} castShadow>
          <boxGeometry args={beam.size} />
          <meshStandardMaterial color={PALETTE.steel} roughness={0.65} metalness={0.4} />
        </mesh>
      ))}

      {/* Hold-down clamps */}
      <group ref={clamps}>
        {CLAMP_POSITIONS.map(([x, z], i) => (
          <group key={i} position={[x, MOUNT_TOP + 0.2, z]}>
            <mesh position={[0, 0.75, 0]} castShadow>
              <boxGeometry args={[0.7, 1.5, 0.7]} />
              <meshStandardMaterial color={PALETTE.accent} roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[0, 1.6, 0]} castShadow>
              <boxGeometry args={[1.5, 0.5, 1.1]} />
              <meshStandardMaterial color={PALETTE.steelDark} roughness={0.6} metalness={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Deluge ring and nozzles */}
      <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[21, 0.55, 8, 48]} />
        <meshStandardMaterial color={PALETTE.steelDark} roughness={0.7} metalness={0.4} />
      </mesh>
      {delugeRing.map((position, i) => (
        <mesh key={i} position={position} castShadow>
          <cylinderGeometry args={[0.42, 0.55, 1.6, 8]} />
          <meshStandardMaterial color={PALETTE.steel} roughness={0.7} metalness={0.45} />
        </mesh>
      ))}

      {/* Supply pipes running off the deck */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 30, 1.2, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.75, 0.75, 24, 10]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.75} metalness={0.4} />
        </mesh>
      ))}

      {/* Hazard markings across the deck edge */}
      {Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const radius = DECK_RADIUS - 2.2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * radius, 0.72, Math.sin(angle) * radius]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[3.1, 0.05, 1.1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? PALETTE.accent : '#f0efe9'}
              roughness={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** Convenience export so scenes can offset effects relative to the mount. */
export const PAD = { deckRadius: DECK_RADIUS, mountTop: MOUNT_TOP };