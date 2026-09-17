import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { LaunchScene } from './scene/LaunchScene';
import { MissionProvider } from './mission/MissionContext';
import { createRuntime } from './mission/runtime';
import { Hud } from './ui/Hud';
import { supportsWebGL } from './lib/webgl';

export default function App() {
  const runtime = useMemo(() => createRuntime(), []);
  const webgl = useMemo(() => supportsWebGL(), []);

  return (
    <div className="app">
      {webgl ? (
        <Canvas
          className="app__canvas"
          flat
          shadows="percentage"
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ position: [62, 24, 92], fov: 38, near: 0.5, far: 12000 }}
        >
          <MissionProvider runtime={runtime}>
            <LaunchScene />
          </MissionProvider>
        </Canvas>
      ) : (
        <div className="app__fallback" role="alert">
          <h1>WebGL unavailable</h1>
          <p>This experience needs a WebGL-capable browser to render the launch scene.</p>
        </div>
      )}

      <Hud runtime={runtime} />
    </div>
  );
}