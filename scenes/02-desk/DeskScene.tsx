"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { insideBuilding } from "@/lib/insideBuilding";
import { COLOR, LAYOUT } from "./config";
import { Monitor } from "./Monitor";
import { useAssetTexture } from "@/lib/useAssetTexture";

// DESK — the warm, lamp-lit room, shown only once the camera is inside the building (insideBuilding).
// The room shell is an axis-aligned near-black box (occludes stars/exterior); the workspace is
// parented to `revealAnchor` — the camera's own pose at the reveal moment — so the monitor lands
// dead-centre and upright when the room appears, despite the camera's bank/pitch.
export function DeskScene() {
  const { room, desk, keyboard, lamp, revealAnchor } = LAYOUT;
  const wood = useAssetTexture("/textures/desk-wood.png", { repeat: [4, 3] });
  const root = useRef<Group>(null);
  const wallMid = (room.ceiling + room.floor) / 2;
  const wallH = room.ceiling - room.floor;
  const zMid = (room.front + room.back) / 2;
  const depth = room.front - room.back;

  useFrame(() => {
    if (root.current) root.current.visible = insideBuilding(useScrollStore.getState().t);
  });

  return (
    <group ref={root}>
      {/* Dark enclosing room shell (near-black, axis-aligned). */}
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

      {/* Workspace anchored to the camera's reveal pose so the monitor reads dead-centre. */}
      <group position={[...revealAnchor.pos]} rotation={[...revealAnchor.rot]}>
        {/* Desk slab the monitor sits on — real dark-walnut albedo. */}
        <mesh position={[0, desk.y, desk.z]}>
          <boxGeometry args={[desk.width, desk.thick, desk.depth]} />
          <meshStandardMaterial map={wood} roughness={0.65} metalness={0.05} />
        </mesh>

        <mesh position={[keyboard.pos[0], keyboard.pos[1], keyboard.pos[2]]}>
          <boxGeometry args={[keyboard.size[0], keyboard.size[1], keyboard.size[2]]} />
          <meshStandardMaterial color={COLOR.keyboard} roughness={0.6} metalness={0.2} />
        </mesh>

        {/* Desk lamp: warm bulb + warm point light. */}
        <mesh position={[lamp.pos[0], lamp.pos[1], lamp.pos[2]]}>
          <sphereGeometry args={[lamp.size, 16, 16]} />
          <meshBasicMaterial color={COLOR.warm} toneMapped={false} />
        </mesh>
        <pointLight position={[lamp.pos[0], lamp.pos[1], lamp.pos[2]]} color={COLOR.warm} intensity={lamp.intensity} distance={lamp.distance} decay={2} />

        <Monitor />
      </group>
    </group>
  );
}
