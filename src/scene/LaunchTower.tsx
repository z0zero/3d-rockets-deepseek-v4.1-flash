/**
 * Service tower: an instanced lattice with umbilical arms that retract at
 * ignition, a hammerhead crane at the top, and a lightning mast alongside.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { smoothstep } from '../lib/math';
import { useMission } from '../mission/MissionContext';
import { boxFrameSegments, Lattice, pipe, type Segment } from './Lattice';
import { PALETTE } from './palette';

const TOWER = {
  height: 54,
  width: 11,
  depth: 11,
  bays: 18,
  /** Distance from the vehicle centreline to the tower centreline. */
  offset: 12.5,
};

/** Tower centre sits off to one side of the pad. */
const CX = 0;
const CZ = -TOWER.offset;

export function LaunchTower() {
  const armUpper = useRef<Group>(null);
  const armLower = useRef<Group>(null);
  const mission = useMission();

  const frame = useMemo(
    () =>
      boxFrameSegments({
        width: TOWER.width,
        depth: TOWER.depth,
        height: TOWER.height,
        bays: TOWER.bays,
        thickness: 0.42,
        taper: 0.86,
        origin: [CX, 1.0, CZ],
      }),
    [],
  );

  const details = useMemo(() => {
    const segments: Segment[] = [];

    // Hammerhead crane jib and counterweight at the top of the tower.
    const top = 1.0 + TOWER.height;
    segments.push(pipe([CX, top, CZ], [CX - 15, top, CZ], 0.5));
    segments.push(pipe([CX, top, CZ], [CX + 7, top, CZ], 0.5));
    segments.push(pipe([CX - 15, top, CZ], [CX - 15, top + 3.4, CZ], 0.4));
    segments.push(pipe([CX - 15, top + 3.4, CZ], [CX + 1, top + 3.4, CZ], 0.4));
    segments.push(pipe([CX + 7, top, CZ], [CX + 1, top + 3.4, CZ], 0.35));

    // Diagonal bracing for the jib.
    for (let i = 0; i < 6; i++) {
      const x0 = CX - 15 + i * 2.4;
      segments.push(pipe([x0, top, CZ], [x0 + 2.4, top + 3.4, CZ], 0.22));
    }

    // Stairway spines on two faces.
    for (let level = 0; level < TOWER.bays; level += 2) {
      const y0 = 1.0 + (TOWER.height * level) / TOWER.bays;
      const y1 = 1.0 + (TOWER.height * (level + 2)) / TOWER.bays;
      segments.push(pipe([CX + 6.2, y0, CZ - 5.6], [CX + 6.2, y1, CZ - 5.6], 0.3));
      segments.push(pipe([CX + 6.2, y0, CZ - 4.4], [CX + 6.2, y1, CZ - 4.4], 0.3));
    }

    // Elevator shaft.
    segments.push(pipe([CX + 5.9, 1.0, CZ + 5.9], [CX + 5.9, top, CZ + 5.9], 0.28));
    segments.push(pipe([CX + 5.9, 1.0, CZ + 4.7], [CX + 5.9, top, CZ + 4.7], 0.28));

    return segments;
  }, []);

  useFrame(() => {
    const t = mission.sample.t;
    // Umbilicals pull back just before release.
    const retract = smoothstep(-2.4, 0.9, t);
    if (armUpper.current) armUpper.current.rotation.y = -retract * 1.25;
    if (armLower.current) armLower.current.rotation.y = -retract * 1.35;
  });

  const armMaterial = (
    <meshStandardMaterial color={PALETTE.steel} roughness={0.7} metalness={0.35} />
  );

  return (
    <group>
      <Lattice segments={frame}>{armMaterial}</Lattice>
      <Lattice segments={details}>{armMaterial}</Lattice>

      {/* Umbilical arms reaching toward the vehicle */}
      <group ref={armUpper} position={[CX, 36.5, CZ]}>
        <mesh position={[0, 0, 3.2]} castShadow>
          <boxGeometry args={[2.2, 1.6, 7.5]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.7} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0, 6.4]} castShadow>
          <boxGeometry args={[1.5, 2.2, 1.5]} />
          <meshStandardMaterial color={PALETTE.accent} roughness={0.65} metalness={0.25} />
        </mesh>
      </group>

      <group ref={armLower} position={[CX, 18.5, CZ]}>
        <mesh position={[0, 0, 3.0]} castShadow>
          <boxGeometry args={[2.6, 1.9, 7]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.7} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0, 6.0]} castShadow>
          <boxGeometry args={[2, 2.6, 1.6]} />
          <meshStandardMaterial color={PALETTE.steel} roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Cryogenic feed lines running down the arm */}
        <mesh position={[0, -1.5, 2.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 7.5, 8]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.8} metalness={0.4} />
        </mesh>
      </group>

      {/* Lightning mast, guyed to the deck */}
      <group position={[CX + 16, 0, CZ - 12]}>
        <mesh position={[0, 32, 0]} castShadow>
          <cylinderGeometry args={[0.35, 1.1, 64, 8]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.75} metalness={0.3} />
        </mesh>
        <mesh position={[0, 65.5, 0]}>
          <coneGeometry args={[0.4, 3.4, 6]} />
          <meshStandardMaterial color={PALETTE.steel} roughness={0.6} metalness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export { TOWER };