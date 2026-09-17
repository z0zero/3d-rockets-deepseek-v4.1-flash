/**
 * DOM overlay: mission telemetry, phase progression, camera shot readout and
 * playback controls. Deliberately outside the canvas so it does not affect the
 * 3D render loop, and updated at a low rate so it never costs a re-render per
 * frame.
 */
import { useEffect, useState } from 'react';
import { directCamera } from '../mission/cameraDirector';
import { PHASES } from '../mission/mission';
import {
  CLOCK_START,
  loopProgress,
  progressToClock,
  restartRuntime,
  seekRuntime,
  type MissionRuntime,
} from '../mission/runtime';
import { formatAltitude, formatSpeed } from './format';

const REFRESH_MS = 90;

export function Hud({ runtime }: { runtime: MissionRuntime }) {
  const [, setFrame] = useState(0);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let frames = 0;
    let fpsWindow = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      frames++;
      if (now - fpsWindow >= 500) {
        setFps(Math.round((frames * 1000) / (now - fpsWindow)));
        frames = 0;
        fpsWindow = now;
      }
      if (now - last >= REFRESH_MS) {
        last = now;
        setFrame((value) => value + 1);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        runtime.playing = !runtime.playing;
        setFrame((value) => value + 1);
      } else if (event.key === 'r' || event.key === 'R') {
        restartRuntime(runtime);
        setFrame((value) => value + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runtime]);

  const sample = runtime.sample;
  const shot = directCamera(sample).shotLabel;
  const progress = loopProgress(runtime);
  const clockSign = sample.t < 0 ? 'T−' : 'T+';
  const absolute = Math.abs(sample.t);
  const clockValue = `${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(
    Math.floor(absolute % 60),
  ).padStart(2, '0')}`;

  return (
    <div className="hud">
      <header className="hud__title">
        <h1>Ascent</h1>
        <p>Stylized launch sequence · procedural scene</p>
      </header>

      <section className="hud__telemetry" aria-label="Mission telemetry">
        <div className="hud__clock">
          <span className="hud__clock-sign">{clockSign}</span>
          <span className="hud__clock-value">{clockValue}</span>
        </div>

        <div className="hud__phase">
          <span className="hud__phase-name">{sample.phase.label}</span>
          <span className="hud__phase-bar">
            <span
              className="hud__phase-fill"
              style={{ transform: `scaleX(${Math.min(1, Math.max(0, sample.phaseProgress))})` }}
            />
          </span>
        </div>

        <dl className="hud__stats">
          <div>
            <dt>Altitude</dt>
            <dd>{formatAltitude(sample.altitudeMeters)}</dd>
          </div>
          <div>
            <dt>Velocity</dt>
            <dd>{formatSpeed(sample.speedKmh)}</dd>
          </div>
          <div>
            <dt>Throttle</dt>
            <dd>{Math.round(sample.throttle * 100)}%</dd>
          </div>
          <div>
            <dt>Camera</dt>
            <dd className="hud__stats-wide">{shot}</dd>
          </div>
        </dl>

        <div className="hud__meters" aria-hidden="true">
          <span>Thrust</span>
          <span className="hud__meter">
            <span className="hud__meter-fill" style={{ transform: `scaleX(${sample.throttle})` }} />
          </span>
          <span>{fps} fps</span>
        </div>
      </section>

      <div className="hud__controls">
        <button
          type="button"
          onClick={() => {
            runtime.playing = !runtime.playing;
            setFrame((value) => value + 1);
          }}
        >
          {runtime.playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => {
            restartRuntime(runtime);
            setFrame((value) => value + 1);
          }}
        >
          Replay
        </button>

        <label className="hud__scrub">
          <span className="sr-only">Sequence position</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(event) => {
              seekRuntime(runtime, progressToClock(Number(event.target.value)));
              setFrame((value) => value + 1);
            }}
          />
        </label>

        <div className="hud__jumps">
          {PHASES.map((phase) => (
            <button
              key={phase.id}
              type="button"
              className={phase.id === sample.phase.id ? 'is-active' : undefined}
              onClick={() => {
                seekRuntime(runtime, Math.max(CLOCK_START, phase.start));
                runtime.playing = true;
                setFrame((value) => value + 1);
              }}
            >
              {phase.label}
            </button>
          ))}
        </div>
      </div>

      <p className="hud__hint">
        Space to pause · R to replay · scrub to inspect any phase
      </p>
    </div>
  );
}
