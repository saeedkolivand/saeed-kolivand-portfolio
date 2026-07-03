"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, EffectPass, NormalPass, RenderPass } from "postprocessing";
import { Color, HalfFloatType, Matrix4, Vector3, type Texture } from "three";
import { PrintEffect } from "@/shaders/PrintEffect";
import { TransitionEffect } from "@/shaders/TransitionEffect";
import { colorWindow, spotRect } from "@/shaders/colorWindow";
import { evaluateTimeline, lerp, poseAt, usesSnapshot, type Pose, type Vec3 } from "@/lib/shots";
import { ISSUES, SEGMENTS } from "@/issues/registry";
import { useScrollStore } from "@/lib/scrollStore";
import { fx } from "@/lib/fx";
import { snapshots } from "@/lib/snapshots";
import { stepNoise } from "@/lib/steppedClock";

/**
 * S2.6 -- ONE composer built once, all passes present, recipes swap
 * uniforms with a short cross-fade. Render order: scene -> normals ->
 * merged EffectPass (print + transition, compiled to a single fullscreen
 * shader by postprocessing).
 *
 * verified 2026-07 (R3F v9 docs): a numeric useFrame priority disables
 * R3F's automatic render; the composer owns the frame at priority 1.
 */

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l < 1e-6 ? [1, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
};
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Screen-space whip axis for the directional smear: yaw/pitch delta between
 * the outgoing and incoming poses; falls back to the position delta
 * projected onto the camera basis for purely translational whips.
 */
function whipAxis(a: Pose, b: Pose): [number, number] {
  const fa = norm3(sub3(a.target, a.position));
  const fb = norm3(sub3(b.target, b.position));
  let x = wrapPi(Math.atan2(fb[0], -fb[2]) - Math.atan2(fa[0], -fa[2]));
  let y = Math.asin(Math.max(-1, Math.min(1, fb[1]))) - Math.asin(Math.max(-1, Math.min(1, fa[1])));
  if (Math.hypot(x, y) < 1e-3) {
    const dp = sub3(b.position, a.position);
    const right = norm3(cross3(fa, [0, 1, 0]));
    x = dot3(dp, right);
    y = dot3(dp, cross3(right, fa));
  }
  const l = Math.hypot(x, y);
  return l < 1e-4 ? [1, 0] : [x / l, y / l];
}

export default function PostPipeline() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const { composer, print, transition } = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType });
    composer.addPass(new RenderPass(scene, camera));
    const normalPass = new NormalPass(scene, camera);
    composer.addPass(normalPass);
    const print = new PrintEffect(normalPass.texture);
    const transition = new TransitionEffect();
    composer.addPass(new EffectPass(camera, print, transition));
    return { composer, print, transition };
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useEffect(() => () => {
    composer.dispose();
    snapshots.dispose();
  }, [composer]);

  // cross-fade state for recipe swaps (S2.6)
  const cur = useRef({ ...ISSUES[0]!.recipe });
  const paper = useRef(new Color(ISSUES[0]!.recipe.paper));
  const edgeColor = useRef(new Color(ISSUES[0]!.recipe.edgeColor));
  const target = useRef({ paper: new Color(), edgeColor: new Color() });
  // velocity derived from t deltas each frame: ScrollTrigger's getVelocity
  // only updates while scroll events fire, so its last value sticks after
  // the scroll settles and speed lines would never fade out
  const lastT = useRef<number | null>(null);
  const vel = useRef(0);

  useFrame((state, delta) => {
    const { t } = useScrollStore.getState();
    const dt = Math.max(delta, 1e-4);
    const rawVel = lastT.current === null ? 0 : ((t - lastT.current) / dt) * 8;
    lastT.current = t;
    const kv = 1 - Math.exp(-(Math.abs(rawVel) > Math.abs(vel.current) ? 10 : 4) * dt);
    vel.current += (Math.max(-1.5, Math.min(1.5, rawVel)) - vel.current) * kv;
    // deterministic settle: the decay is asymptotic, so snap the residual to
    // a hard 0 once it is sub-visual -- rest frames are then bit-identical
    // from either scrub direction (mirrors the ScrollProxy velocity ruling)
    if (Math.abs(vel.current) < 1e-3) vel.current = 0;
    const velocity = vel.current;
    const sample = evaluateTimeline(t, SEGMENTS);
    const recipe = ISSUES[sample.filmIssue]!.recipe;

    // ~0.2s uniform cross-fade toward the filmed issue's recipe
    const k = Math.min(1, 1 - Math.exp(-12 * delta));
    const c = cur.current;
    c.mono = lerp(c.mono, recipe.mono, k);
    c.edge = lerp(c.edge, recipe.edge, k);
    c.halftone = lerp(c.halftone, recipe.halftone, k);
    c.halftoneScale = lerp(c.halftoneScale, recipe.halftoneScale, k);
    c.grain = lerp(c.grain, recipe.grain, k);
    c.paperTex = lerp(c.paperTex, recipe.paperTex, k);
    c.vignette = lerp(c.vignette, recipe.vignette, k);
    c.boil = lerp(c.boil, recipe.boil, k);
    c.hatch = lerp(c.hatch, recipe.hatch, k);
    c.hatchScale = lerp(c.hatchScale, recipe.hatchScale, k);
    paper.current.lerp(target.current.paper.set(recipe.paper), k);
    edgeColor.current.lerp(target.current.edgeColor.set(recipe.edgeColor), k);

    print.u<Color>("uPaper").value = paper.current;
    print.u<Color>("uEdgeColor").value = edgeColor.current;
    print.u<number>("uMono").value = c.mono;
    print.u<number>("uEdge").value = c.edge;
    print.u<number>("uHalftone").value = c.halftone;
    print.u<number>("uHalftoneScale").value = c.halftoneScale;
    print.u<number>("uGrain").value = c.grain;
    print.u<number>("uPaperTex").value = c.paperTex;
    print.u<number>("uVignette").value = c.vignette;
    print.u<number>("uImpact").value = fx.impact;
    // Phase 4: halftone dot-scale breathe -- envelope is smoothed by the
    // audio director and is exactly 0 whenever audio is off (no fallback)
    print.u<number>("uAudioPulse").value = Math.min(1, Math.max(0, fx.audioPulse));
    print.u<number>("uHatch").value = c.hatch;
    print.u<number>("uHatchScale").value = c.hatchScale;

    // color window (noir): world-space rect positioned by the issue via
    // shaders/colorWindow.ts; mask reconstructs world pos from depth
    print.u<number>("uWindow").value = colorWindow.enabled;
    if (colorWindow.enabled > 0) {
      print.u<Vector3>("uWinCenter").value.fromArray(colorWindow.center);
      print.u<Vector3>("uWinU").value.fromArray(colorWindow.halfU);
      print.u<Vector3>("uWinV").value.fromArray(colorWindow.halfV);
      print.u<number>("uWinDepth").value = colorWindow.depth;
    }
    // spot rect (mascot tracker): second mono-exempt rect, scene-driven
    // per-frame via shaders/colorWindow.ts spotRect/setSpotRect; strength
    // rides enabled so scenes can fade without losing partial exemption
    print.u<number>("uSpotStrength").value = spotRect.enabled * spotRect.strength;
    if (spotRect.enabled > 0) {
      print.u<Vector3>("uSpotCenter").value.fromArray(spotRect.center);
      print.u<Vector3>("uSpotU").value.fromArray(spotRect.halfU);
      print.u<Vector3>("uSpotV").value.fromArray(spotRect.halfV);
      print.u<number>("uSpotDepth").value = spotRect.depth;
    }
    if (colorWindow.enabled > 0 || spotRect.enabled > 0) {
      camera.updateMatrixWorld();
      print
        .u<Matrix4>("uInvViewProjection")
        .value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    }

    // S2.9 line boil: quantized jitter, amplitude grows with scroll speed
    const el = state.clock.elapsedTime;
    const boilAmp = c.boil * (1 + Math.min(Math.abs(velocity), 1.5) * 4);
    const jitter = print.u<{ x: number; y: number }>("uBoilJitter").value;
    jitter.x = stepNoise(el, 10, 1) * boilAmp;
    jitter.y = stepNoise(el, 10, 2) * boilAmp;
    print.u<number>("uStepSeed").value = stepNoise(el, 10, 3);

    // transition layer -- uSmear* feed the shader's pjtPrint approximation
    // of the print pass for displaced inputBuffer taps (PR #22 ruling 3)
    const tr = sample.transition;
    transition.u<number>("uVelocity").value = velocity;
    transition.u<number>("uSmearMono").value = c.mono;
    transition.u<number>("uSmearHalftone").value = c.halftone;
    transition.u<number>("uSmearScale").value = c.halftoneScale;
    transition.u<Color>("uSmearPaper").value.copy(paper.current);
    if (tr) {
      transition.setMode(tr.mode);
      transition.u<number>("uP").value = tr.p;
      transition
        .u<Color>("uFallback")
        .value.set(ISSUES[tr.fromIssue]!.recipe.paper);
      if (tr.mode === "whip" && sample.segment.type === "gutter") {
        const g = sample.segment;
        const [wx, wy] = whipAxis(poseAt(g.fromShot, 1), poseAt(g.toShot, 0));
        const wd = transition.u<{ x: number; y: number }>("uWhipDir").value;
        wd.x = wx;
        wd.y = wy;
      }
      if (usesSnapshot(tr.mode)) {
        const snap = snapshots.get(tr.fromIssue);
        transition.u<Texture | null>("uSnapshot").value = snap;
        transition.u<number>("uHasSnapshot").value = snap ? 1 : 0;
      }
    } else {
      transition.setMode("none");
    }

    composer.render(delta);

    // S2.11 -- refresh the outgoing issue's snapshot in the tail of a shot
    // that exits through a snapshot-driven transition, or whenever any
    // consumer has retained this issue's snapshot (lib/snapshots.ts)
    if (sample.segment.type === "shot" && sample.shotP > 0.85) {
      const issue = sample.segment.shot.issue;
      const next = SEGMENTS[SEGMENTS.indexOf(sample.segment) + 1];
      const gutterWants =
        next?.type === "gutter" && next.interIssue && usesSnapshot(next.mode);
      if (gutterWants || snapshots.isRetained(issue)) snapshots.capture(gl, issue);
    }
  }, 1);

  return null;
}
