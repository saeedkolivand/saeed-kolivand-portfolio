"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, EffectPass, NormalPass, RenderPass } from "postprocessing";
import { Color, HalfFloatType, type Texture } from "three";
import { PrintEffect } from "@/shaders/PrintEffect";
import { TransitionEffect } from "@/shaders/TransitionEffect";
import { evaluateTimeline, lerp } from "@/lib/shots";
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

    // S2.9 line boil: quantized jitter, amplitude grows with scroll speed
    const el = state.clock.elapsedTime;
    const boilAmp = c.boil * (1 + Math.min(Math.abs(velocity), 1.5) * 4);
    const jitter = print.u<{ x: number; y: number }>("uBoilJitter").value;
    jitter.x = stepNoise(el, 10, 1) * boilAmp;
    jitter.y = stepNoise(el, 10, 2) * boilAmp;
    print.u<number>("uStepSeed").value = stepNoise(el, 10, 3);

    // transition layer
    const tr = sample.transition;
    transition.u<number>("uVelocity").value = velocity;
    if (tr) {
      transition.setMode(tr.mode);
      transition.u<number>("uP").value = tr.p;
      transition
        .u<Color>("uFallback")
        .value.set(ISSUES[tr.fromIssue]!.recipe.paper);
      if (tr.mode === "dot-zoom") {
        const snap = snapshots.get(tr.fromIssue);
        transition.u<Texture | null>("uSnapshot").value = snap;
        transition.u<number>("uHasSnapshot").value = snap ? 1 : 0;
      }
    } else {
      transition.setMode("none");
    }

    composer.render(delta);

    // S2.11 -- refresh the outgoing issue's snapshot in the tail of a shot
    // that exits through a snapshot-driven transition (dot-zoom for now)
    if (sample.segment.type === "shot" && sample.shotP > 0.85) {
      const next = SEGMENTS[SEGMENTS.indexOf(sample.segment) + 1];
      if (next?.type === "gutter" && next.interIssue && next.mode === "dot-zoom") {
        snapshots.capture(gl, sample.segment.shot.issue);
      }
    }
  }, 1);

  return null;
}
