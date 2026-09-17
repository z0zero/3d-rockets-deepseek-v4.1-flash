/// <reference types="vite/client" />

import type { MissionRuntime } from './mission/runtime';

declare global {
  interface Window {
    /**
     * Development-only handle used by the browser verification harness to seek
     * the mission clock and read render state. Not present in production builds.
     */
    __ascent?: {
      runtime: MissionRuntime;
      /** Reports renderer counters for automated checks. */
      stats: () => {
        fps: number;
        calls: number;
        triangles: number;
        particles: number;
        phase: string;
        shot: string;
        clock: number;
        playing: boolean;
      };
    };
  }
}

export {};