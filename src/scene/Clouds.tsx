/**
 * High altitude haze layers. The vehicle and the camera pass through these
 * during the ascent, which is what actually sells the sense of height.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, RepeatWrapping } from 'three';
import { cloudTexture } from '../fx/textures';

const LAYERS = [
  { y: 170, size: 7000, opacity: 0.22, repeat: 5, speed: 0.0035 },
  { y: 330, size: 8000, opacity: 0.26, repeat: 3.5, speed: -0.0026 },
  { y: 560, size: 9000, opacity: 0.2, repeat: 2.5, speed: 0.0018 },
];

export function Clouds() {
  const textures = useMemo(
    () =>
      LAYERS.map((layer) => {
        const texture = cloudTexture().clone();
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(layer.repeat, layer.repeat);
        texture.needsUpdate = true;
        return texture;
      }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    textures.forEach((texture, i) => {
      texture.offset.x = t * LAYERS[i].speed;
      texture.offset.y = t * LAYERS[i].speed * 0.4;
    });
  });

  return (
    <group>
      {LAYERS.map((layer, i) => (
        <mesh
          key={i}
          position={[0, layer.y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={-500}
        >
          <planeGeometry args={[layer.size, layer.size]} />
          <meshBasicMaterial
            map={textures[i]}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            side={DoubleSide}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}