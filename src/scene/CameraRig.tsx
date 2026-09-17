/**
 * Applies the shot list to the render camera each frame. Also nudges the field
 * of view on narrow viewports so the vehicle stays comfortably framed.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { directCamera } from '../mission/cameraDirector';
import { useMission } from '../mission/MissionContext';

const target = new Vector3();

export function CameraRig() {
  const mission = useMission();
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useFrame(() => {
    const state = directCamera(mission.sample);

    camera.position.set(state.position[0], state.position[1], state.position[2]);
    target.set(state.lookAt[0], state.lookAt[1], state.lookAt[2]);
    camera.lookAt(target);

    if (camera instanceof PerspectiveCamera) {
      const aspect = size.width / Math.max(1, size.height);
      // Portrait and very narrow windows get a slightly wider field of view.
      const narrowBoost = aspect < 1.25 ? 1 + (1.25 - aspect) * 0.4 : 1;
      camera.fov = state.fov * narrowBoost;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}