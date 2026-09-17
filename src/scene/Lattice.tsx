/**
 * Instanced truss builder plus the segment generators used by the launch tower
 * and the service structures. One draw call per structure keeps the scene light.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';

export interface Segment {
  from: [number, number, number];
  to: [number, number, number];
  thickness: number;
}

const UP = new Vector3(0, 1, 0);

export function Lattice({
  segments,
  children,
  castShadow = true,
}: {
  segments: Segment[];
  children: ReactNode;
  castShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const direction = new Vector3();
    const midpoint = new Vector3();
    const scale = new Vector3();
    const a = new Vector3();
    const b = new Vector3();

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      a.set(segment.from[0], segment.from[1], segment.from[2]);
      b.set(segment.to[0], segment.to[1], segment.to[2]);

      direction.subVectors(b, a);
      const length = direction.length();
      if (length < 1e-5) {
        scale.set(0, 0, 0);
        midpoint.copy(a);
      } else {
        direction.divideScalar(length);
        quaternion.setFromUnitVectors(UP, direction);
        midpoint.addVectors(a, b).multiplyScalar(0.5);
        scale.set(segment.thickness, length, segment.thickness);
      }

      matrix.compose(midpoint, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [segments]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, segments.length]} castShadow={castShadow}>
      <boxGeometry args={[1, 1, 1]} />
      {children}
    </instancedMesh>
  );
}

/**
 * A four-legged square truss: vertical legs, horizontal rungs at every bay and
 * alternating diagonals on each face.
 */
export function boxFrameSegments(options: {
  width: number;
  depth: number;
  height: number;
  bays: number;
  thickness?: number;
  /** Optional taper applied to the leg spacing at the top. */
  taper?: number;
  origin?: [number, number, number];
}): Segment[] {
  const { width, depth, height, bays, thickness = 0.34, taper = 1, origin = [0, 0, 0] } = options;
  const segments: Segment[] = [];
  const [ox, oy, oz] = origin;

  const halfAt = (level: number) => {
    const t = bays === 0 ? 0 : level / bays;
    const s = 1 + (taper - 1) * t;
    return { w: (width / 2) * s, d: (depth / 2) * s };
  };

  const corners = (level: number): [number, number, number][] => {
    const { w, d } = halfAt(level);
    return [
      [ox + w, oy, oz + d],
      [ox - w, oy, oz + d],
      [ox - w, oy, oz - d],
      [ox + w, oy, oz - d],
    ];
  };

  const yAt = (level: number) => oy + (height * level) / bays;

  for (let level = 0; level < bays; level++) {
    const lower = corners(level);
    const upper = corners(level + 1);
    const y0 = yAt(level);
    const y1 = yAt(level + 1);

    // Legs.
    for (let c = 0; c < 4; c++) {
      segments.push({
        from: [lower[c][0], y0, lower[c][2]],
        to: [upper[c][0], y1, upper[c][2]],
        thickness,
      });
    }

    // Rungs and diagonals on each of the four faces.
    for (let c = 0; c < 4; c++) {
      const n = (c + 1) % 4;
      segments.push({
        from: [upper[c][0], y1, upper[c][2]],
        to: [upper[n][0], y1, upper[n][2]],
        thickness: thickness * 0.8,
      });
      if (level % 2 === 0) {
        segments.push({
          from: [lower[c][0], y0, lower[c][2]],
          to: [upper[n][0], y1, upper[n][2]],
          thickness: thickness * 0.6,
        });
      } else {
        segments.push({
          from: [lower[n][0], y0, lower[n][2]],
          to: [upper[c][0], y1, upper[c][2]],
          thickness: thickness * 0.6,
        });
      }
    }
  }

  // Top rail.
  const top = corners(bays);
  for (let c = 0; c < 4; c++) {
    const n = (c + 1) % 4;
    segments.push({
      from: [top[c][0], yAt(bays), top[c][2]],
      to: [top[n][0], yAt(bays), top[n][2]],
      thickness: thickness * 0.8,
    });
  }

  return segments;
}

/** A straight run of pipe or conduit built as a single segment. */
export function pipe(
  from: [number, number, number],
  to: [number, number, number],
  thickness: number,
): Segment {
  return { from, to, thickness };
}