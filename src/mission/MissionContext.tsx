/**
 * Shares the mutable mission runtime with the 3D scene. The runtime object is
 * stable for the lifetime of the app, so consumers can read `runtime.sample`
 * inside `useFrame` without causing React re-renders.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { MissionRuntime } from './runtime';

const MissionContext = createContext<MissionRuntime | null>(null);

export function MissionProvider({
  runtime,
  children,
}: {
  runtime: MissionRuntime;
  children: ReactNode;
}) {
  return <MissionContext.Provider value={runtime}>{children}</MissionContext.Provider>;
}

export function useMission() {
  const runtime = useContext(MissionContext);
  if (!runtime) throw new Error('useMission must be used inside a MissionProvider');
  return runtime;
}