"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Vector3, type PerspectiveCamera } from "three";
import { evaluateTimeline, type TimelineSample } from "@/lib/shots";
import { SEGMENTS, ISSUES } from "@/issues/registry";
import { useScrollStore } from "@/lib/scrollStore";
import { BeatRunner, makeDemoBeats } from "@/lib/beats";

/**
 * S2.3 -- evaluates the shot list from t and drives the camera: pose lerp
 * with small smoothing inside a segment, hard snap across cuts, pointer
 * parallax (S2.15) inside hold/dolly shots only.
 */
export default function ShotDirector({
  onSample,
}: {
  onSample?: (s: TimelineSample) => void;
}) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const beats = useMemo(() => new BeatRunner(makeDemoBeats()), []);

  const pos = useRef(new Vector3());
  const tgt = useRef(new Vector3());
  const smoothedPos = useRef<Vector3 | null>(null);
  const smoothedTgt = useRef(new Vector3());
  const bg = useRef(new Color(ISSUES[0]!.recipe.bg));
  const bgTarget = useRef(new Color());
  const lastSegment = useRef<object | null>(null);

  useFrame((_, delta) => {
    const { t, reducedMotion, pointerX, pointerY, activeIssue, setActiveIssue } =
      useScrollStore.getState();
    const sample = evaluateTimeline(t, SEGMENTS);

    beats.update(t, reducedMotion);
    if (sample.activeIssue !== activeIssue) setActiveIssue(sample.activeIssue);

    pos.current.set(...sample.pose.position);
    tgt.current.set(...sample.pose.target);

    // pointer parallax: only inside settled shots, never in gutters/beats
    const parallaxOk =
      !reducedMotion &&
      sample.transition === null &&
      (sample.shotKind === "hold" || sample.shotKind === "dolly");
    if (parallaxOk) {
      const amp = 0.035; // ~ +/-2deg at target distance
      const d = pos.current.distanceTo(tgt.current);
      pos.current.x += pointerX * amp * d * 0.35;
      pos.current.y += -pointerY * amp * d * 0.25;
    }

    // small lerp smoothing within a segment, hard snap across segments (cuts)
    const sp = smoothedPos.current ?? (smoothedPos.current = new Vector3().copy(pos.current));
    const snap = lastSegment.current !== sample.segment;
    lastSegment.current = sample.segment;
    if (snap) {
      sp.copy(pos.current);
      smoothedTgt.current.copy(tgt.current);
    } else {
      const k = 1 - Math.exp(-14 * delta);
      sp.lerp(pos.current, k);
      smoothedTgt.current.lerp(tgt.current, k);
    }

    camera.position.copy(sp);
    camera.lookAt(smoothedTgt.current);
    if (sample.pose.roll) camera.rotateZ(sample.pose.roll);
    const fov = sample.pose.fov ?? 45;
    const cam = camera as PerspectiveCamera;
    if (cam.isPerspectiveCamera && cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    // scene background follows the filmed issue's paper tone
    bgTarget.current.set(ISSUES[sample.filmIssue]!.recipe.bg);
    bg.current.lerp(bgTarget.current, 1 - Math.exp(-8 * delta));
    scene.background = bg.current;

    onSample?.(sample);
  });

  return null;
}
