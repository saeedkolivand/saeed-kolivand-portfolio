"use client";
import dynamic from "next/dynamic";

// three.js touches WebGL/DOM at import, so the Canvas must be client-only.
// ssr:false is mandatory here (allowed because this is a Client Component).
const Canvas3D = dynamic(() => import("./Canvas3D").then((m) => m.Canvas3D), {
  ssr: false,
});

export function Experience() {
  return <Canvas3D />;
}
