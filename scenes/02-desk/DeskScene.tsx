"use client";
import { COLOR, LAYOUT } from "./config";
import { Monitor } from "./Monitor";

// DESK — the warm, lamp-lit room the OUTSIDE window belonged to. Camera flies in over the desk
// toward the glowing monitor. No autonomous animation (motion is the scroll-driven camera), so
// nothing to gate for reduced motion. ~12 draw calls. Camera flies +Z entry -> origin -> -Z.
export function DeskScene() {
  const { room, desk, keyboard, lamp } = LAYOUT;
  const wallMid = (room.ceiling + room.floor) / 2;
  const wallH = room.ceiling - room.floor;
  const zMid = (room.front + room.back) / 2;
  const depth = room.front - room.back;

  return (
    <>
      {/* Open-fronted dark tunnel so the interior reads enclosed (no starfield leak forward). */}
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

      {/* Desk slab the camera skims over toward the monitor. */}
      {/* TODO(asset): real wood albedo/normal/roughness maps for the desk surface. */}
      <mesh position={[0, desk.y, desk.z]}>
        <boxGeometry args={[desk.width, desk.thick, desk.depth]} />
        <meshStandardMaterial color={COLOR.desk} roughness={0.7} metalness={0.05} />
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
    </>
  );
}
