---
name: portfolio-standards
description: >-
  Canonical review + build knowledge for this scroll-driven 3D portfolio
  (Next.js 16 / React 19 / react-three-fiber 9 / three r185 / TypeScript strict).
  The R3F/three review checklist, 60fps performance rules, Next 16 + React 19
  correctness, the security checklist (+ exclusions), reviewer craft + severity
  rubric, and scene-build conventions. Consult when reviewing a diff, building
  a scene, profiling performance, or before a PR. Backs the grumpy-reviewer,
  security-reviewer, and the r3f/scene/perf author agents.
---

# Portfolio review & build standards

Hardened from current (2025–2026) best-practice research. Every item is a concrete, checkable rule: red-flag → how to verify → fix.

## R3F / Three.js review checklist
- **No allocations in `useFrame`.** Verify: grep frame callbacks for `new Vector3(`, `new Color(`, `new THREE.`, array literals, object spreads. Fix: hoist to module scope / `useRef` / `useMemo`, mutate with `.set()`, `.copy()`, `.lerp()`.
- **Delta-based motion, not fixed increments.** Verify: `+=`/`-=` in `useFrame` with no `delta`. Fix: `x += speed * delta` (units/sec, rad/sec). Test at 30fps and 144fps for equal speed.
- **`<primitive object={} />` disposes manually.** It does NOT auto-dispose on unmount (only `attach` does). Fix: `useEffect(() => () => { obj.geometry?.dispose(); obj.material?.dispose(); }, [])`.
- **Materials/geometries created in render must be `useMemo`'d** (or module scope) — check same reference across renders.
- **Use `useLoader`, not `new TextureLoader().load()`** in effects/render (cross-instance caching; one fetch per URL).
- **Texture colorSpace.** three r16x dropped auto-sRGB: color/albedo textures need `tex.colorSpace = SRGBColorSpace`; do NOT set it on data/normal/roughness maps.
- **Camera prop mutations need `updateProjectionMatrix()`** — but only when the value actually changed (guard with an epsilon; don't call it blindly every frame).
- **Toggle `visible`, don't mount/unmount** expensive static subtrees; reserve unmount for genuinely gone objects.
- **Read store in-frame via `getState()`, never a live selector** (zero re-renders). Don't bind rapidly-changing store values to `position={[...]}`; mutate `ref.current.position` in-frame.
- **Watch stale closures in `useFrame`** — outer vars captured at definition; use refs or `getState()`.
- **StrictMode + Canvas** double-mounts effects (WebGL ctx, RAF, store init); they must be idempotent with correct cleanup. (This project keeps StrictMode OFF for that reason — if re-enabled, audit for this.)
- **Instance repeated geometry** — `InstancedMesh` / drei `<Instances>` instead of `array.map(<mesh/>)` (N draw calls → 1).

## Performance rules (60fps budget)
- **Draw calls < 100 desktop / < 50 mobile.** Verify `renderer.info.render.calls`; no visible metric = red flag.
- **Share materials; batch static geometry** (`mergeGeometries`, `BatchedMesh` for varied static geometry sharing a material; `InstancedMesh` for per-instance dynamic transforms).
- **Clamp DPR** (`dpr={[1,1.5]}`); drei `<PerformanceMonitor onDecline/onIncline>` to drop DPR / disable post when FPS falls. A quality ladder with a recovery path must exist.
- **Renderer flags:** `powerPreference:'high-performance'`; disable unused buffers when post owns depth; `antialias` only at DPR ≥ 1.5.
- **Shadows:** ≤ 1–3 casters; PointLight shadow = 6× render; start at 512/1024, tighten frustum, fix acne with `bias`/`normalBias` not huge maps; `light.shadow.autoUpdate=false` for static.
- **Bloom selectively** (layer-based); no full-scene bloom on mobile.
- **Transparent particles:** `depthWrite=false`, sort or `renderOrder`; `AdditiveBlending` for glow. GPU particles (GPGPU) only past ~50k.
- **LOD** (`THREE.LOD` / drei `<Detailed>`) for high-poly at distance.
- **Compress assets:** KTX2/Basis textures + Draco meshes (`gltfjsx -S -T -t`); uncompressed PNG/JPEG ≈ 10× VRAM.
- **Dispose on removal** (geometry, material array-aware, texture, ImageBitmap `.close()`); watch VRAM across add/remove.
- **Pause on hidden tab** (`visibilitychange`); ship a perf monitor (r3f-perf/stats.js) in dev.

## Next.js 16 + React 19 correctness
- **`'use client'` at the leaf, not the root/layout** (it cascades and kills RSC). Push the boundary down.
- **Serializable props across the RSC→Client boundary** (no functions/class instances/Symbols/raw Promises); pass server components as `children`, a resolved promise to `use()`, or a Server Action.
- **Browser-only libs (three/WebGL) need `dynamic(..., {ssr:false})`** in a client wrapper — else `window is not defined` / hydration mismatch.
- **No render-time nondeterminism** (`Math.random()`, `Date.now()`, `typeof window` driving markup) — move to `useEffect`, server-safe fallback first.
- **Valid HTML nesting** (no `<div>` in `<p>`, no `<button>` in `<a>`) — server/client parse differently → hydration break.
- **Fetch in Server Components, not `useEffect`.** Guard env/window access; `import 'server-only'` on secret modules; non-`NEXT_PUBLIC_` vars are empty client-side.
- **`next/font` (not `<link>`), Metadata API (not hand-rolled tags), add JSON-LD** for rich results.
- **React 19:** `ref` is a plain prop (drop `forwardRef`); `use()` for conditional context/promises (promise created outside render); forms via `useActionState`/`useFormStatus`/`useOptimistic`.
- **Server Action hygiene:** `redirect()` outside try/catch; `revalidatePath`/`revalidateTag` after mutations; verify on-demand revalidation in `next build && next start`, not just dev.

## Security checklist (and explicit exclusions)
- **Unsafe HTML sinks** (`dangerouslySetInnerHTML`/`innerHTML`/`insertAdjacentHTML`/`eval`/`Function`) fed by user/API/URL data → `textContent`/DOMPurify.
- **No string-concatenated DB queries** — parameterized / typed ORM + zod validation.
- **No secrets in client bundles/repo** (grep key-shaped strings, `bearer`); rotate leaked-then-removed keys.
- **Server endpoints:** authenticate at the top AND verify resource ownership (IDOR); validate `query`/`body`/`params` before DB/fs/API.
- **Session cookies** `httpOnly`+`Secure`+`SameSite`; no JWT in `localStorage`.
- **SSRF** — allowlist host + `https` only. **Path traversal** — resolve + confine to base dir. **Deserialization** — schema-validate after `JSON.parse`.
- **`next/image`** explicit `remotePatterns` (no `*`), `dangerouslyAllowSVG` false. **Supply chain** — pin exact versions, commit lockfile, scrutinize `postinstall`.
- **Do NOT flag** (not PR blockers): theoretical DoS, rate limiting, client-side authz as the gate, outdated-dependency noise, speculative races, log spoofing.

## Reviewer craft & severity rubric
- **Verify before flagging** — read surrounding code, confirm the path is reachable, check for a comment explaining the "weird" pattern. Only surface MEDIUM+ confidence; keep false positives < 15%.
- **4–8 findings per PR**; don't mix P0 bugs with P3 style (delegate pure style to linters).
- **Severity:** P0 = breaks functionality or WCAG AA (blocks); P1 = logic/off-by-one/security must-fix; P2 = perf/naming (merge if otherwise OK); P3 = style. Format: `[SEVERITY] [file:line] Title | Problem | Fix | Confidence`.
- **Every finding ships a concrete minimal fix**, not "this is wrong."
- **Boundary bugs:** off-by-one; test empty/single/full and animation `t=0`/`t=1` (first/last frame, no stick/glitch); division by ~0 → `if (len < 1e-10) return fallback`.
- **Type/unit confusion:** don't mix screen/world/normalized space; tag units (ms vs s, deg vs rad, device px vs CSS px).
- **Motion accessibility (WCAG 2.2):** any parallax/zoom/scale/3D transform without a `prefers-reduced-motion` guard is a red flag — provide a reduced/final-state path.

## Build conventions (for author agents)
- Canvas host is a client component, dynamic-imported `{ssr:false}`; never in a Server Component or root layout.
- Frame loop: zero allocations, all motion `* delta`, read store via `getState()`, mutate refs (no per-frame React state).
- Resource lifecycle: geometries/materials in `useMemo`/module scope; assets via `useLoader`; `colorSpace` on color textures only; unmount disposal for every manual THREE object and `<primitive>`.
- Scale from the start: `InstancedMesh`/`<Instances>`, shared materials, `<Detailed>` LOD, KTX2 + Draco, ≤ 3 shadow casters, selective bloom.
- Named constants with units for every timing/speed/threshold. Every animation respects `prefers-reduced-motion`.
