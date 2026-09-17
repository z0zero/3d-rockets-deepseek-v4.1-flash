/**
 * Drives the mission clock. Runs at a negative render priority so the sample is
 * up to date before any other subscriber reads it in the same frame.
 */
import { useFrame } from '@react-three/fiber';
import { advanceRuntime } from './runtime';
import { useMission } from './MissionContext';

export function MissionDriver() {
  const mission = useMission();

  useFrame((_, delta) => {
    advanceRuntime(mission, delta);
  }, -100);

  return null;
}