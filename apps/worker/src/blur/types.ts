/** Axis-aligned box in pixel coordinates of the frame it was detected on. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

/** Packed RGB24 frame (row-major, 3 bytes per pixel). */
export interface Frame {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * A detector of things to blur (faces, licence plates…). Implementations must favour recall:
 * a missed face is a privacy incident, an extra blurred patch is not.
 */
export interface Detector {
  readonly name: string;
  readonly enabled: boolean;
  detect(frame: Frame, settings?: { minScore: number }): Promise<Box[]>;
}

/** Detector used when a capability is switched off or no reliable model is available. */
export class DisabledDetector implements Detector {
  readonly enabled = false;
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  async detect(): Promise<Box[]> {
    return [];
  }
}
