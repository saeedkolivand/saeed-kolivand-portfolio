import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler is intentionally OFF: it can conflict with react-three-fiber's
  // mutation-heavy useFrame/ref patterns. Revisit once the 3D layer is proven stable.
  reactCompiler: false,
  // StrictMode OFF: its dev-only double-mount makes react-three-fiber create and
  // dispose a second WebGL context, churning GPU contexts and blanking the canvas.
  // Standard practice for a single persistent Canvas app.
  reactStrictMode: false,
};

export default nextConfig;
