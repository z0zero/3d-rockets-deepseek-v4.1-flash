/**
 * Engine exhaust: a shader-driven plume, a hot inner core, billboard flare
 * sprites, and the point light that throws the ignition glow across the pad and
 * tower.
 *
 * The plume geometry is authored as a unit-length cylinder translated so that
 * local y = 0 is the nozzle exit and y = -1 is the tip. Scaling the mesh on Y
 * therefore stretches the plume without touching the shader's falloff.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  PointLight,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
} from 'three';
import { fbm1 } from '../lib/math';
import { useMission } from '../mission/MissionContext';
import { glowTexture } from '../fx/textures';
import { PALETTE } from './palette';

const PLUME_VERTEX = /* glsl */ `
  varying vec3 vLocal;
  varying float vFacing;

  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Facing term: 1 where the surface faces the camera, 0 at the silhouette.
    vFacing = abs(normalize(normalMatrix * normal).z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PLUME_FRAGMENT = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uOuter;
  uniform float uIntensity;
  uniform float uFlicker;
  uniform float uSoftness;

  varying vec3 vLocal;
  varying float vFacing;

  void main() {
    // 0 at the nozzle, 1 at the tip of the plume.
    float u = clamp(-vLocal.y, 0.0, 1.0);

    vec3 color = mix(uCore, uMid, smoothstep(0.0, 0.22, u));
    color = mix(color, uOuter, smoothstep(0.35, 0.9, u));

    // The plume fades and breaks up toward the tip.
    float body = 1.0 - smoothstep(0.2, 1.0, u);
    float breakup = 0.78 + 0.22 * sin(u * 26.0 - uFlicker * 6.0);

    // Soften the silhouette so the cylinder does not read as a hard tube.
    float edge = mix(0.5, 1.0, pow(vFacing, uSoftness));

    float alpha = body * breakup * edge * uIntensity;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color * (1.0 + body * 0.9), alpha);
    #include <colorspace_fragment>
  }
`;

function plumeMaterial(core: string, mid: string, outer: string, softness: number) {
  return new ShaderMaterial({
    uniforms: {
      uCore: { value: new Color(core) },
      uMid: { value: new Color(mid) },
      uOuter: { value: new Color(outer) },
      uIntensity: { value: 0 },
      uFlicker: { value: 0 },
      uSoftness: { value: softness },
    },
    vertexShader: PLUME_VERTEX,
    fragmentShader: PLUME_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/** Unit cylinder: spans local y in [-1, 0] with the nozzle at y = 0. */
function plumeGeometry(topRadius: number, bottomRadius: number, segments: number) {
  const geometry = new CylinderGeometry(topRadius, bottomRadius, 1, segments, 1, true);
  geometry.translate(0, -0.5, 0);
  return geometry;
}

export function Exhaust() {
  const group = useRef<Group>(null);
  const outerMesh = useRef<Mesh>(null);
  const innerMesh = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const flareA = useRef<Sprite>(null);
  const flareB = useRef<Sprite>(null);
  const mission = useMission();

  const glow = useMemo(() => glowTexture(), []);

  const outerMaterial = useMemo(() => plumeMaterial('#fff3cf', '#ff9a45', '#c8441c', 1.5), []);
  const innerMaterial = useMemo(() => plumeMaterial('#ffffff', '#fff0c0', '#ffb057', 2.6), []);

  const outerGeometry = useMemo(() => plumeGeometry(1.3, 0.5, 20), []);
  const innerGeometry = useMemo(() => plumeGeometry(0.75, 0.3, 16), []);

  const flareMaterials = useMemo(
    () => [
      new SpriteMaterial({
        map: glow,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        color: new Color('#ffc078'),
        opacity: 0,
      }),
      new SpriteMaterial({
        map: glow,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        color: new Color('#ff9a4a'),
        opacity: 0,
      }),
    ],
    [glow],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    const { nozzleY, flame, altitude } = mission.sample;

    g.position.set(0, nozzleY, 0);
    g.visible = flame > 0.008;

    const time = state.clock.elapsedTime;
    const flicker = fbm1(time * 14.0) * 0.6 + fbm1(time * 37.0) * 0.4;

    // Plumes stretch and widen as ambient pressure falls with altitude.
    const vacuum = Math.min(1, altitude / 300);
    const length = (6 + flame * 16) * (1 + vacuum * 0.7);
    const width = 1 + vacuum * 0.45;

    if (outerMesh.current) {
      outerMesh.current.scale.set(width, length, width);
    }
    if (innerMesh.current) {
      innerMesh.current.scale.set(width * 0.95, length * 0.6, width * 0.95);
    }

    outerMaterial.uniforms.uIntensity.value = flame * (0.9 + flicker * 0.3);
    outerMaterial.uniforms.uFlicker.value = time;
    innerMaterial.uniforms.uIntensity.value = flame * (1.15 + flicker * 0.4);
    innerMaterial.uniforms.uFlicker.value = time * 1.6;

    if (light.current) {
      light.current.intensity = flame * (520 + flicker * 220);
      light.current.position.y = -2.5;
    }

    const pulse = 1 + flicker * 0.22;
    if (flareA.current) {
      const s = (9 + flame * 11) * pulse;
      flareA.current.scale.set(s, s, 1);
      flareA.current.position.y = -1.6;
      flareMaterials[0].opacity = flame * 0.9;
    }
    if (flareB.current) {
      const s = (18 + flame * 30) * (1 + flicker * 0.12);
      flareB.current.scale.set(s, s, 1);
      flareB.current.position.y = -5;
      flareMaterials[1].opacity = flame * 0.45;
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color={PALETTE.flameMid} distance={300} decay={1.7} intensity={0} />

      <mesh ref={outerMesh} geometry={outerGeometry} material={outerMaterial} renderOrder={10} frustumCulled={false} />
      <mesh ref={innerMesh} geometry={innerGeometry} material={innerMaterial} renderOrder={11} frustumCulled={false} />

      {/* Billboard flare that fakes the bloom around a very bright source. */}
      <sprite ref={flareA} material={flareMaterials[0]} renderOrder={12} />
      <sprite ref={flareB} material={flareMaterials[1]} renderOrder={9} />
    </group>
  );
}