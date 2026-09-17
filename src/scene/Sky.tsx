/**
 * Gradient sky dome with a sun disc and halo. A single inverted sphere with a
 * bespoke shader is cheaper and more controllable than a physical sky model,
 * and gives the flat, stylised look of the reference.
 */
import { BackSide, Color, ShaderMaterial } from 'three';
import { useMemo } from 'react';
import { PALETTE, SUN_DIRECTION } from './palette';

const VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uHazeHeight;

  varying vec3 vDirection;

  void main() {
    vec3 dir = normalize(vDirection);

    // Vertical gradient with a compressed horizon band so the haze reads thin.
    float h = clamp(dir.y, -1.0, 1.0);
    float t = pow(clamp(h, 0.0, 1.0), 0.55);
    vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.42, t));
    sky = mix(sky, uZenith, smoothstep(0.34, 1.0, t));

    // Below the horizon the dome fades into the ground haze colour.
    sky = mix(uGround, sky, smoothstep(-0.09, 0.015, h));

    float sun = max(dot(dir, normalize(uSunDirection)), 0.0);
    sky += uSunColor * pow(sun, 340.0) * 2.4;          // disc
    sky += uSunColor * pow(sun, 14.0) * 0.16;          // near halo
    sky += uSunColor * pow(sun, 3.5) * 0.05;           // broad bloom

    // A touch of brightening right at the horizon, as in the reference.
    sky += uHorizon * (1.0 - smoothstep(0.0, uHazeHeight, abs(h))) * 0.18;

    gl_FragColor = vec4(sky, 1.0);
    #include <colorspace_fragment>
  }
`;

export function Sky() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uZenith: { value: PALETTE.skyZenith.clone() },
          uMid: { value: PALETTE.skyMid.clone() },
          uHorizon: { value: PALETTE.skyHorizon.clone() },
          uGround: { value: new Color('#a9bcc4') },
          uSunColor: { value: PALETTE.sun.clone() },
          uSunDirection: { value: SUN_DIRECTION.slice() },
          uHazeHeight: { value: 0.16 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[6000, 32, 20]} />
    </mesh>
  );
}