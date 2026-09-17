/**
 * Assembles the launch site: sky, lighting, terrain, the vehicle, the tower and
 * all of the launch effects.
 */
import { Color } from 'three';
import { MissionDriver } from '../mission/MissionDriver';
import { CameraRig } from './CameraRig';
import { Clouds } from './Clouds';
import { Exhaust } from './Exhaust';
import { LaunchPad } from './LaunchPad';
import { LaunchSite } from './LaunchSite';
import { LaunchTower } from './LaunchTower';
import { Rocket } from './Rocket';
import { RenderProbe } from './RenderProbe';
import { Sky } from './Sky';
import { Smoke } from './Smoke';
import { Ground, Hills } from './Terrain';
import { PALETTE, SUN_DIRECTION } from './palette';

/** Shadow frustum is kept tight around the pad for crisp contact shadows. */
const SHADOW_EXTENT = 95;

export function LaunchScene() {
  return (
    <>
      <MissionDriver />
      <CameraRig />
      <RenderProbe />

      <fog attach="fog" args={[new Color(PALETTE.haze).getHex(), 380, 7000]} />

      <ambientLight intensity={0.18} />
      <hemisphereLight args={['#cfe6ff', '#6f6b58', 0.55]} />
      <directionalLight
        position={[SUN_DIRECTION[0] * 260, SUN_DIRECTION[1] * 260, SUN_DIRECTION[2] * 260]}
        intensity={2.7}
        color="#fff4e2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={700}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-bias={-0.0006}
        shadow-normalBias={0.06}
      />

      <Sky />
      <Clouds />
      <Ground />
      <Hills />

      <LaunchPad />
      <LaunchTower />
      <LaunchSite />
      <Rocket />
      <Exhaust />
      <Smoke />
    </>
  );
}