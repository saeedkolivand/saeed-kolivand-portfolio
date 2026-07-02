import { FramebufferTexture, Vector2, type WebGLRenderer } from "three";

/**
 * S2.11 snapshot pool -- frames copied off the canvas when the camera leaves
 * an issue, reused by snapshot-driven transitions (dot-zoom now; tear/flip/
 * spread later). LRU-capped; textures sized in device pixels.
 *
 * verified 2026-07 (three r185): copyFramebufferToTexture(texture, position,
 * level) -- texture is the FIRST argument (order flipped in r165), and it
 * copies from the currently bound framebuffer, so call right after render.
 */
const MAX_SNAPSHOTS = 4;

class SnapshotPool {
  private map = new Map<number, FramebufferTexture>();
  private size = new Vector2();

  capture(renderer: WebGLRenderer, issue: number) {
    renderer.getDrawingBufferSize(this.size);
    let tex = this.map.get(issue);
    if (tex && (tex.image.width !== this.size.x || tex.image.height !== this.size.y)) {
      tex.dispose();
      this.map.delete(issue);
      tex = undefined;
    }
    if (!tex) {
      tex = new FramebufferTexture(this.size.x, this.size.y);
      this.map.set(issue, tex);
      if (this.map.size > MAX_SNAPSHOTS) {
        const oldest = this.map.keys().next().value;
        if (oldest !== undefined && oldest !== issue) {
          this.map.get(oldest)?.dispose();
          this.map.delete(oldest);
        }
      }
    } else {
      // refresh LRU order
      this.map.delete(issue);
      this.map.set(issue, tex);
    }
    renderer.copyFramebufferToTexture(tex);
  }

  get(issue: number): FramebufferTexture | null {
    return this.map.get(issue) ?? null;
  }

  dispose() {
    for (const tex of this.map.values()) tex.dispose();
    this.map.clear();
  }
}

export const snapshots = new SnapshotPool();
