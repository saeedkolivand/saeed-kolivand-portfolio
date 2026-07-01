"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { COLOR, LAYOUT } from "./config";
import { Monitor } from "./Monitor";
import { useAssetTexture } from "@/lib/useAssetTexture";

// DESK — the warm, lamp-lit room the OUTSIDE window belonged to. Camera flies in over the desk
// toward the glowing monitor. ~12 draw calls. Camera flies +Z entry -> origin -> -Z.
//
// The interior (desk / monitor / lamp) is hidden until the camera actually enters the DESK region
// on the scroll timeline — otherwise, because the ±1 mount budget co-mounts DESK while OUTSIDE is
// active, the computer would be visible from OUTSIDE (before you've "entered the building"). The
// dark room shell stays (it reads as near-black and never bleeds). Gated via t in one useFrame
// (getState, no re-render); this is a visibility toggle, not autonomous motion, so no a11y gating.
export function DeskScene() {
  const { room, desk, keyboard, lamp } = LAYOUT;
  const wood = useAssetTexture("/textures/desk-wood.png", { repeat: [4, 3] });
  const interior = useRef<Group>(null);
  const wallMid = (room.ceiling + room.floor) / 2;
  const wallH = room.ceiling - room.floor;
  const zMid = (room.front + room.back) / 2;
  const depth = room.front - room.back;

  useFrame(() => {
    // Reveal only once DESK (scene index 1) is the active scene — hidden while OUTSIDE is active,
    // so the computer isn't seen through the co-mounted OUTSIDE scene before you've entered.
    if (interior.current) interior.current.visible = useScrollStore.getState().activeIndex >= 1;
  });

  return (
    <>
      {/* Dark enclosing room shell (near-black, never bleeds into OUTSIDE). */}
      <mesh position={[0, wallMid, room.back]}>
        <planeGeometry args={[room.halfWidth * 2, wallH]} />
        <meshBasicMaterial color={COLOR.wall} />
      </mesh>
      <mesh position={[0, room.floor, zMid]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.halfWidth * 2, depth]} />
        <meshBasicMaterial color={COLOR.wall} />
      </mesh>
      <mesh position={[0, room.ceiling, zMid]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.halfWidth * 2, depth]} />
        <meshBasicMaterial color={COLOR.wall} />
      </mesh>
      <mesh position={[-room.halfWidth, wallMid, zMid]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, wallH]} />
        <meshBasicMaterial color={COLOR.wall} />
      </mesh>
      <mesh position={[room.halfWidth, wallMid, zMid]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth, wallH]} />
        <meshBasicMaterial color={COLOR.wall} />
      </mesh>

      {/* Interior — revealed only once the camera enters the DESK region (see useFrame above). */}
      <group ref={interior}>
        {/* Desk slab the camera skims over toward the monitor — real dark-walnut albedo. */}
        <mesh position={[0, desk.y, desk.z]}>
          <boxGeometry args={[desk.width, desk.thick, desk.depth]} />
          <meshStandardMaterial map={wood} roughness={0.65} metalness={0.05} />
        </mesh>

        <mesh position={[keyboard.pos[0], keyboard.pos[1], keyboard.pos[2]]}>
          <boxGeometry args={[keyboard.size[0], keyboard.size[1], keyboard.size[2]]} />
          <meshStandardMaterial color={COLOR.keyboard} roughness={0.6} metalness={0.2} />
        </mesh>

        {/* Desk lamp: warm bulb + warm point light — the OUTSIDE window's warmth, seen from within. */}
        <mesh position={[lamp.pos[0], lamp.pos[1], lamp.pos[2]]}>
          <sphereGeometry args={[lamp.size, 16, 16]} />
          <meshBasicMaterial color={COLOR.warm} toneMapped={false} />
        </mesh>
        <pointLight position={[lamp.pos[0], lamp.pos[1], lamp.pos[2]]} color={COLOR.warm} intensity={lamp.intensity} distance={lamp.distance} decay={2} />

        <Monitor />
      </group>
    </>
  );
}
