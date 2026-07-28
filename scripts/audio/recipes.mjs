/**
 * Sound recipes for the bake. Each exports (sr, seed) -> Float32Array (mono)
 * or [L, R] (stereo). Deterministic: all randomness comes from rng(seed).
 *
 * Every recipe here follows the same law that separates AAA foley from a
 * synth blip: TRANSIENT + BODY + TAIL. The transient tells you what hit what,
 * the body tells you what it is made of and how big it is, the tail tells you
 * what room you are standing in. The current runtime synthesis has only ever
 * had the transient, which is exactly why it reads as cheap.
 */

import {
  applyBiquad, biquad, brown, buf, fade, mixInto, modal, modesFor,
  normalize, pink, rng, scatter, secs, white,
} from "./dsp.mjs";

// ---------------------------------------------------------------- keystroke

/**
 * Mechanical keyboard keypress, down-stroke.
 *
 * Replaces `p.uiTick.triggerAttackRelease(1400 + hash % 120, 0.008, ...)` --
 * a single 8 ms bare square wave that fires on EVERY character typed in the
 * terminal scene. It is the most-heard sound on the site and the cheapest.
 *
 * A real switch is four events inside 100 ms:
 *   1. leaf contact snap   -- 1.5 ms, bright, broadband
 *   2. keycap bottom-out   -- the "thock". Plastic shell on plate. THE body.
 *   3. plate/case ring     -- metal, quieter, slightly later
 *   4. spring ping         -- steel coil, high and long, very quiet
 * Leave out any one of them and it stops sounding like a keyboard.
 */
export function keyThock(sr, seed) {
  const r = rng(seed);
  const out = buf(secs(0.18, sr));

  // 1. leaf contact snap. Band-limited on BOTH sides: a real switch has
  // nothing at 20 kHz, and full-scale content up there reads as digital
  // harshness and burns bitrate for something nobody can hear.
  const cn = secs(0.0016, sr);
  const click = white(cn, r);
  applyBiquad(click, biquad("bandpass", r.logRange(3400, 5400), 1.2, sr));
  applyBiquad(click, biquad("lowpass", 11000, 0.7, sr));
  for (let i = 0; i < cn; i++) click[i] *= Math.pow(1 - i / cn, 1.5);
  mixInto(out, click, 0, 0.42);

  // 2. keycap bottom-out -- the thock. This is the BODY and it should
  // dominate; if the highs win, you get the plastic tick this replaces.
  const capF = r.range(148, 205);
  const cap = modal(
    secs(0.12, sr), sr,
    modesFor("wood", capF, 5, 1).map((m) => ({ ...m, t60: m.t60 * 0.42 })),
    r, 14,
  );
  mixInto(out, cap, secs(0.0009, sr), 1.0);

  // 3. plate ring -- aluminium, quiet, gone quickly
  const plate = modal(
    secs(0.05, sr), sr,
    modesFor("aluminium", r.range(880, 1320), 4, 1).map((m) => ({ ...m, t60: m.t60 * 0.035 })),
    r, 20,
  );
  mixInto(out, plate, secs(0.0012, sr), 0.09);

  // 4. spring ping. Barely there on purpose -- audible as texture, never as a
  // pitch. Louder than this and every keystroke sounds like a toy xylophone.
  const ping = modal(
    secs(0.09, sr), sr,
    modesFor("steel", r.range(2600, 4200), 3, 1).map((m) => ({ ...m, t60: m.t60 * 0.035 })),
    r, 30,
  );
  mixInto(out, ping, secs(0.0018, sr), 0.018);

  // A keyboard 60 cm away has no meaningful energy above ~14 kHz. This fires
  // on every character typed, so any harshness here compounds fast.
  applyBiquad(out, biquad("lowpass", 14000, 0.7, sr));
  fade(out, sr, 0.0002, 0.02);
  normalize(out, 0.95);
  return out;
}

/** Spacebar: bigger cap, stabiliser rattle, lower. */
export function keySpace(sr, seed) {
  const r = rng(seed);
  const out = buf(secs(0.2, sr));

  const cn = secs(0.002, sr);
  const click = white(cn, r);
  applyBiquad(click, biquad("bandpass", r.logRange(2400, 3800), 1.1, sr));
  for (let i = 0; i < cn; i++) click[i] *= Math.pow(1 - i / cn, 1.4);
  mixInto(out, click, 0, 0.45);

  const cap = modal(
    secs(0.14, sr), sr,
    modesFor("wood", r.range(88, 122), 5, 1).map((m) => ({ ...m, t60: m.t60 * 0.42 })),
    r, 14,
  );
  mixInto(out, cap, secs(0.001, sr), 1.0);

  // stabiliser rattle: 2-4 tiny secondary contacts, the giveaway of a big key
  const rattles = 2 + (r.u32() % 3);
  for (let i = 0; i < rattles; i++) {
    const rn = secs(0.0012, sr);
    const tick = white(rn, r);
    applyBiquad(tick, biquad("bandpass", r.logRange(1800, 4200), 2.0, sr));
    for (let j = 0; j < rn; j++) tick[j] *= 1 - j / rn;
    mixInto(out, tick, secs(r.range(0.004, 0.03), sr), r.range(0.05, 0.14));
  }

  fade(out, sr, 0.0002, 0.02);
  normalize(out, 0.95);
  return out;
}

// --------------------------------------------------------------------- paper

/**
 * Paper tear -- a stick-slip fracture cascade, not a noise sweep.
 *
 * Fibres snap one at a time. The inter-event gaps are heavy-tailed (Pareto),
 * and the mean gap SHRINKS then GROWS as the tear accelerates and runs out.
 * That acceleration profile is the whole sound; a uniform grain rate gives
 * you a hiss, which is what the current bandpass-swept noise produces.
 */
export function paperTear(sr, seed, dur = 0.7) {
  const r = rng(seed);
  const n = secs(dur, sr);
  const out = buf(n);

  // Tear speed. Every layer is driven off this one curve, which is what keeps
  // them moving as a single gesture instead of three unrelated noises.
  // Asymmetric: a tear starts the instant the fibres give, then trails off as
  // it runs out of sheet. A symmetric bell fades IN, which sounds like a
  // crossfade rather than something being ripped.
  const speed = (u) => {
    const p = Math.min(1, u * 1.02);
    return p < 0.12
      ? Math.pow(p / 0.12, 0.55)
      : Math.pow(1 - (p - 0.12) / 0.88, 1.15);
  };

  // 1. SHEAR -- the continuous sound of the sheet separating. Tearing paper is
  // mostly this; the crackle rides on top of it. Leaving it out is what made
  // the first attempt read as static rather than paper.
  const shear = white(n, r);
  applyBiquad(shear, biquad("bandpass", 2600, 0.55, sr));
  applyBiquad(shear, biquad("highpass", 700, 0.7, sr));
  // A real tear catches and releases rather than running smooth, so the shear
  // stutters irregularly. A steady envelope here is instantly recognisable as
  // synthetic.
  const holdN = Math.max(1, Math.round(sr * 0.009));
  let stut = 1;
  let target = 1;
  for (let i = 0; i < n; i++) {
    if (i % holdN === 0) target = 0.12 + 0.88 * r.f();
    stut += (target - stut) * 0.006;
    shear[i] *= speed(i / n) * stut * 0.45;
  }
  mixInto(out, shear, 0, 1);

  // 2. FIBRE RUPTURES -- discrete, and each one RINGS. A 0.4 ms burst is just
  // a click; at 2-5 ms with a real Q it becomes a snap with a pitch, and the
  // ear hears individual fibres letting go.
  const crackle = scatter(n, sr, (u) => 140 + 820 * speed(u), (rr) => {
    const gn = secs(rr.range(0.002, 0.006), sr);
    const g = white(gn, rr);
    applyBiquad(g, biquad("bandpass", rr.logRange(1400, 6500), 7, sr));
    // Attack, not a bare decay. A grain that starts at full amplitude is a
    // step discontinuity, and 800 of them per tear sum into the broadband
    // wash that swamped the first two attempts. 0.4 ms is enough to fix it
    // and short enough that the snap still reads as instantaneous.
    const na = Math.max(2, Math.round(gn * 0.14));
    for (let i = 0; i < gn; i++) {
      const atk = i < na ? 0.5 - 0.5 * Math.cos((Math.PI * i) / na) : 1;
      g[i] *= atk * Math.exp(-i / (gn * 0.3));
    }
    return g;
  }, r);
  mixInto(out, crackle, 0, 1.15);

  // 3. SHEET BODY -- paper is a large thin membrane and it moves air.
  const body = pink(n, r);
  applyBiquad(body, biquad("bandpass", 480, 0.7, sr));
  for (let i = 0; i < n; i++) body[i] *= speed(i / n) * 0.5;
  mixInto(out, body, 0, 1);

  // Two poles, cascaded: 24 dB/oct. Paper has essentially nothing above 10 kHz
  // and a single 12 dB/oct slope leaves enough up there to read as digital
  // hiss rather than fibre.
  applyBiquad(out, biquad("lowpass", 10500, 0.7, sr));
  applyBiquad(out, biquad("lowpass", 10500, 0.7, sr));
  fade(out, sr, 0.005, 0.06);
  normalize(out, 0.95);
  return out;
}

/** Page flip: grip, then flutter (rate rises as the sheet stiffens), then landing. */
export function pageFlip(sr, seed) {
  const r = rng(seed);
  const n = secs(0.45, sr);
  const out = buf(n);

  // grip / lift
  const grip = scatter(secs(0.05, sr), sr, () => 700, (rr) => {
    const gn = secs(0.0006, sr);
    const g = white(gn, rr);
    applyBiquad(g, biquad("bandpass", rr.logRange(1800, 6500), 1.6, sr));
    for (let i = 0; i < gn; i++) g[i] *= 1 - i / gn;
    return g;
  }, r);
  mixInto(out, grip, 0, 0.5);

  // flutter: AM whose rate climbs 18 -> 55 Hz as the sheet tensions
  const fn = secs(0.2, sr);
  const flutter = white(fn, r);
  applyBiquad(flutter, biquad("bandpass", 2600, 0.7, sr));
  let ph = 0;
  for (let i = 0; i < fn; i++) {
    const u = i / fn;
    ph += (2 * Math.PI * (18 + 37 * u)) / sr;
    flutter[i] *= (0.45 + 0.55 * (0.5 - 0.5 * Math.cos(ph))) * Math.sin(Math.PI * u);
  }
  mixInto(out, flutter, secs(0.04, sr), 0.8);

  // landing slap
  const slap = modal(
    secs(0.08, sr), sr,
    [{ f: 220, a: 1, t60: 0.045 }, { f: 470, a: 0.6, t60: 0.035 }],
    r, 25,
  );
  mixInto(out, slap, secs(r.range(0.24, 0.3), sr), 0.35);

  fade(out, sr, 0.003, 0.04);
  normalize(out, 0.95);
  return out;
}

// ------------------------------------------------------------------- impacts

/**
 * Layered impact: transient + body + sub + debris.
 *
 * `opts.material` picks the modal ratios (steel/concrete/wood/glass...),
 * `f0` the size (lower = bigger), `subF` the chest thump.
 *
 * The sub carries a deliberate HARMONIC GHOST at 2x and 3x. Laptop and phone
 * speakers reproduce nothing at 40 Hz, so without the ghost the weight of
 * every big hit is simply absent for half the audience.
 */
export function impact(sr, seed, opts = {}) {
  const {
    material = "steel", f0 = 90, subF = 52, dur = 2.4,
    debris = 0.4, bodyGain = 1, subGain = 0.9,
  } = opts;
  const r = rng(seed);
  const n = secs(dur, sr);
  const out = buf(n);

  // 1. transient -- 2 ms, the "what hit what". Band-limited top and bottom.
  const tn = secs(0.002, sr);
  const tr = white(tn, r);
  applyBiquad(tr, biquad("highpass", 1800, 0.7, sr));
  applyBiquad(tr, biquad("lowpass", 13000, 0.7, sr));
  for (let i = 0; i < tn; i++) tr[i] *= Math.pow(1 - i / tn, 1.2);
  mixInto(out, tr, 0, 0.7);

  // 2. body -- modal, the "what is it made of and how big"
  const body = modal(n, sr, modesFor(material, f0, 0, 1), r, 8);
  mixInto(out, body, secs(0.0006, sr), bodyGain);

  // 3. sub -- pitch-dropping sine plus the audibility ghost
  const sn = secs(Math.min(dur, 1.6), sr);
  const sub = buf(sn);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < sn; i++) {
    const t = i / sr;
    const f = subF * Math.exp(-t / 0.42) + 26;
    p1 += (2 * Math.PI * f) / sr;
    p2 += (2 * Math.PI * f * 2) / sr;
    p3 += (2 * Math.PI * f * 3) / sr;
    const env = Math.exp(-t / 0.36) * (1 - Math.exp(-t / 0.004));
    sub[i] = env * (Math.sin(p1) + 0.1 * Math.sin(p2) + 0.04 * Math.sin(p3));
  }
  // The exponential envelope is still ~1% up at the buffer end, so without a
  // fade the sub stops on a step -- a full-bandwidth click a second and a half
  // after the impact, which is worse than anything it was covering for.
  fade(sub, sr, 0.0001, 0.25);
  mixInto(out, sub, 0, subGain);

  // 4. debris -- a HANDFUL of scattered secondary contacts, dying out fast.
  // Density is the whole game here: at a few dozen per second this reads as
  // rubble settling, and at a few hundred it reads as static. Each grain is
  // lowpassed, because small fragments an arm's length away have no top end.
  if (debris > 0) {
    const dn = n - secs(0.04, sr);
    const scat = scatter(dn, sr, (u) => 55 * Math.exp(-u * 8), (rr) => {
      const g = modal(
        secs(0.04, sr), sr,
        modesFor(material, rr.logRange(f0 * 2.5, f0 * 9), 3, 1)
          .map((m) => ({ ...m, t60: m.t60 * 0.05 })),
        rr, 40, 0.0012,
      );
      applyBiquad(g, biquad("lowpass", rr.logRange(2600, 7000), 0.7, sr));
      return g;
    }, r);
    mixInto(out, scat, secs(0.04, sr), debris * 0.5);
  }

  // Air absorption. Nothing struck at conversational distance arrives with
  // full-scale energy at 20 kHz; leaving it in is what makes a synthesized
  // hit sound like it happened inside the speaker rather than in a room.
  applyBiquad(out, biquad("lowpass", 15000, 0.7, sr));

  fade(out, sr, 0.0002, 0.12);
  normalize(out, 0.97);
  return out;
}

// ----------------------------------------------------------------------- rain

/**
 * Rain -- thousands of discrete droplets, each with its own Minnaert bubble
 * resonance, stereo-decorrelated.
 *
 * Replaces pink noise bandpassed 1800-5200 Hz plus 9 Hz white-noise ticks.
 * A droplet is not a noise burst: the impact splash is broadband, but the
 * air bubble entrained under the surface rings at a definite pitch, and THAT
 * is the ping your ear uses to identify rain.
 */
export function rain(sr, seed, dur = 8, density = 2600) {
  const r = rng(seed);
  const n = secs(dur, sr);

  const drops = (rr) => {
    const gn = secs(0.02, sr);
    const g = buf(gn);
    // splash: broadband, very short
    const sn = secs(0.0008, sr);
    for (let i = 0; i < sn; i++) g[i] = (rr.f() * 2 - 1) * (1 - i / sn) * 0.5;
    // Minnaert bubble ring: f ~ 3.26 / radius, so small drops ring high
    const f = rr.logRange(900, 7000);
    const t60 = rr.range(0.002, 0.011);
    const w = (2 * Math.PI * f) / sr;
    const d = Math.exp(-6.907755 / (t60 * sr));
    let amp = rr.range(0.25, 0.85);
    for (let i = 0; i < gn; i++) {
      g[i] += amp * Math.sin(w * i);
      amp *= d;
    }
    return g;
  };

  // two independent droplet fields = genuine stereo, not a panned mono source
  const L = scatter(n, sr, () => density, drops, r);
  const R = scatter(n, sr, () => density, drops, rng(seed ^ 0x5bf03635));

  // distant wash: the far field, where individual drops are no longer resolvable
  for (const side of [L, R]) {
    const wash = pink(n, r);
    applyBiquad(wash, biquad("bandpass", 1400, 0.5, sr));
    mixInto(side, wash, 0, 0.35);
  }

  normalize(L, 0.9);
  normalize(R, 0.9);
  return [L, R];
}

// ------------------------------------------------------------------ room tone

/**
 * Mains hum + room floor.
 *
 * Replaces two pure sines at 50/100 Hz. Three things make real hum real:
 *   - ODD harmonics dominate, and the 5th outranks the 4th (magnetic
 *     saturation is symmetric, so this is physics, not taste)
 *   - the grid frequency DRIFTS, so harmonics beat against each other
 *   - magnetostriction adds a narrow-pulse rasp, not a tone
 */
export function roomTone(sr, seed, dur = 12, opts = {}) {
  const { mains = 50, flyback = 0, floorDb = -48 } = opts;
  const r = rng(seed);
  const n = secs(dur, sr);
  const out = buf(n);

  const harm = [
    [1, 1.0], [2, 0.5], [3, 0.25], [4, 0.125],
    [5, 0.158], [6, 0.05], [7, 0.063], [8, 0.025],
  ];
  // slow drift, exact multiples of 1/dur so the loop is seamless
  const driftHz = 1 / dur;
  for (const [k, a] of harm) {
    const ph0 = r.range(0, 2 * Math.PI);
    const amPhase = r.range(0, 2 * Math.PI);
    const amRate = driftHz * (1 + (r.u32() % 8));
    let ph = ph0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const drift = 1 + 0.0006 * Math.sin(2 * Math.PI * driftHz * t + ph0);
      ph += (2 * Math.PI * mains * k * drift) / sr;
      const am = 1 + 0.17 * Math.sin(2 * Math.PI * amRate * t + amPhase);
      out[i] += a * am * Math.sin(ph);
    }
  }

  // magnetostrictive rasp: a narrow pulse at 2x mains, harmonics far up
  let pp = 0;
  for (let i = 0; i < n; i++) {
    pp += (2 * mains) / sr;
    const frac = pp % 1;
    out[i] += frac < 0.12 ? 0.03 * Math.sin(Math.PI * (frac / 0.12)) : 0;
  }

  // CRT flyback -- 15.625 kHz (PAL line rate) with 50 Hz vertical-scan AM.
  // This single detail is what makes a CRT room read as a CRT room.
  if (flyback > 0) {
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const am = 1 + 0.08 * Math.sin(2 * Math.PI * 50 * t);
      out[i] += flyback * am * Math.sin(2 * Math.PI * 15625 * t);
    }
  }

  // HVAC / air
  const air = brown(n, r);
  applyBiquad(air, biquad("lowpass", 180, 0.7, sr));
  const floorGain = Math.pow(10, floorDb / 20);
  mixInto(out, air, 0, floorGain * 12);

  const hiss = pink(n, r);
  mixInto(out, hiss, 0, floorGain * 1.4);

  normalize(out, 0.7);
  return out;
}
