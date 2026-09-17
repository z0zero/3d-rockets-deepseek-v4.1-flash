/**
 * Supporting launch complex: propellant tanks, a pipe rack, the blockhouse, a
 * water tower and perimeter masts. These exist to give the pad scale and to
 * catch the warm light of ignition.
 */
import { useMemo } from 'react';
import { Lattice, pipe, type Segment } from './Lattice';
import { PALETTE } from './palette';

const TANKS: { position: [number, number, number]; radius: number }[] = [
  { position: [54, 0, 44], radius: 8 },
  { position: [55, 0, 66], radius: 8 },
  { position: [32, 0, 62], radius: 6.5 },
];

export function LaunchSite() {
  const pipeRack = useMemo(() => {
    const segments: Segment[] = [];
    // Rack spine between the tanks and the pad.
    for (let i = 0; i < 7; i++) {
      const x = 26 + i * 5;
      segments.push(pipe([x, 0, 52], [x, 7, 52], 0.5));
      if (i < 6) {
        segments.push(pipe([x, 7, 52], [x + 5, 7, 52], 0.45));
        segments.push(pipe([x, 7, 52], [x + 5, 0, 52], 0.3));
      }
    }
    // Three product lines running along the rack.
    const lines: [number, number][] = [
      [6.4, 51.2],
      [6.4, 52.8],
      [5.4, 52],
    ];
    for (const [y, z] of lines) {
      segments.push(pipe([26, y, z], [56, y, z], 0.32));
    }
    // Drop line toward the pad.
    segments.push(pipe([26, 6.4, 51.2], [26, 1.5, 34], 0.32));
    return segments;
  }, []);

  const masts = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 + 0.6;
        const radius = 96;
        return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
      }),
    [],
  );

  return (
    <group>
      {/* Spherical propellant tanks on skirt supports */}
      {TANKS.map((tank, i) => (
        <group key={i} position={tank.position}>
          <mesh position={[0, tank.radius + 5, 0]} castShadow receiveShadow>
            <sphereGeometry args={[tank.radius, 24, 16]} />
            <meshStandardMaterial color="#e6e7e4" roughness={0.55} metalness={0.15} />
          </mesh>
          <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[tank.radius * 0.62, tank.radius * 0.7, 5, 20]} />
            <meshStandardMaterial color={PALETTE.concreteDark} roughness={0.9} />
          </mesh>
          {/* Equatorial band */}
          <mesh position={[0, tank.radius + 5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[tank.radius + 0.05, 0.22, 6, 32]} />
            <meshStandardMaterial color={PALETTE.steelDark} roughness={0.7} metalness={0.4} />
          </mesh>
        </group>
      ))}

      <Lattice segments={pipeRack}>
        <meshStandardMaterial color={PALETTE.steel} roughness={0.7} metalness={0.35} />
      </Lattice>

      {/* Blockhouse */}
      <group position={[-52, 0, 40]}>
        <mesh position={[0, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[22, 8, 16]} />
          <meshStandardMaterial color={PALETTE.concrete} roughness={0.95} />
        </mesh>
        <mesh position={[0, 8.4, 0]} castShadow>
          <boxGeometry args={[23.5, 0.9, 17.5]} />
          <meshStandardMaterial color={PALETTE.concreteDark} roughness={0.95} />
        </mesh>
        {/* Window band facing the pad */}
        <mesh position={[0, 5.6, 8.1]}>
          <boxGeometry args={[18, 1.6, 0.3]} />
          <meshStandardMaterial color="#4d5a63" roughness={0.25} metalness={0.6} />
        </mesh>
      </group>

      {/* Water tower */}
      <group position={[-34, 0, -46]}>
        <mesh position={[0, 13, 0]} castShadow>
          <cylinderGeometry args={[0.7, 1.1, 26, 8]} />
          <meshStandardMaterial color={PALETTE.steelDark} roughness={0.8} metalness={0.3} />
        </mesh>
        <mesh position={[0, 30, 0]} castShadow receiveShadow>
          <sphereGeometry args={[7, 20, 14]} />
          <meshStandardMaterial color="#dfe0dc" roughness={0.7} metalness={0.1} />
        </mesh>
      </group>

      {/* Perimeter lightning masts */}
      {masts.map((mast, i) => (
        <group key={i} position={[mast.x, 0, mast.z]}>
          <mesh position={[0, 24, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.9, 48, 8]} />
            <meshStandardMaterial color={PALETTE.steelDark} roughness={0.78} metalness={0.3} />
          </mesh>
          <mesh position={[0, 49, 0]}>
            <coneGeometry args={[0.35, 2.6, 6]} />
            <meshStandardMaterial color={PALETTE.steel} roughness={0.6} metalness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Crawlerway leading away from the pad */}
      <mesh position={[0, 0.05, 150]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 260]} />
        <meshStandardMaterial color={PALETTE.asphalt} roughness={1} />
      </mesh>
    </group>
  );
}