import { FramebufferTexture, Vector2, type WebGLRenderer } from "three";

/**
 * S2.11 snapshot pool -- frames copied off the canvas when the camera leaves
 * an issue, reused by snapshot-driven transitions (S5 library) and by issues
 * that quote another issue's frame. LRU-capped; textures sized in device
 * pixels. Snapshots are CPU-side framebuffer copies, NOT render targets --
 * the S2.10 budget of 3 live RTs is untouched by this pool.
 *
 * Generalized requests (Phase 2): any issue/transition may `retain(issue)` a
 * key -- retained snapshots are refreshed in that issue's exit tail by
 * PostPipeline even when the gutter's transition doesn't use one, and are
 * exempt from LRU eviction until `release(issue)`. Gutter transitions whose
 * mode passes usesSnapshot() (lib/shots.ts) are served automatically with no
 * registration.
 *
 * verified 2026-07 (three r185): copyFramebufferToTexture(texture, position,
 * level) -- texture is the FIRST argument (order flipped in r165), and it
 * copies from the currently bound framebuffer, so call right after render.
 */
const MAX_SNAPSHOTS = 4;

class SnapshotPool {
  private map = new Map<number, FramebufferTexture>();
  private retained = new Set<number>();
  private size = new Vector2();

  /** Keep `issue`'s snapshot fresh + evict-proof (e.g. Issue 10 spread pages). */
  retain(issue: number) {
    this.retained.add(issue);
  }

  release(issue: number) {
    this.retained.delete(issue);
  }

  isRetained(issue: number): boolean {
    return this.retained.has(issue);
  }

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
        // evict the oldest unretained key (retained ones only leave via release)
        for (const oldest of this.map.keys()) {
          if (oldest === issue || this.retained.has(oldest)) continue;
          this.map.get(oldest)?.dispose();
          this.map.delete(oldest);
          break;
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
