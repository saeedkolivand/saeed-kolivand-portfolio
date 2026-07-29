import type { Gain, Meter, ToneAudioNode } from "tone";
import type { ToneModule } from "./types";

/**
 * The mix graph. Replaces the single music/sfx split with six named buses, so
 * a slam, a room tone and a button click stop sharing one compressor and one
 * reverb send.
 *
 *   beds ------> music ----+---> pulseBus ---> meter      (TAP ONLY, no output)
 *   room tone -> ambience -+
 *                music ----+---> duckGain ---+
 *                ambience -+                 |
 *                                            +--> mixIn --> EQ3 --> comp
 *   foley  --> foleyComp --> foleyOut -------+                   --> limiter
 *   hardfx --> hardComp  --> hardOut --------+                   --> destination
 *   ui     ------------------ uiOut ---------+
 *   sub    --> subLp(120) --> subComp -> ... +
 *
 *   sends: duckGain (BOTH beds), foleyOut, hardOut --> roomIn --> HP 250
 *          ui and sub never reach the room at all
 *
 * WHY pulseBus EXISTS -- do not "simplify" it away. director.ts writes
 * fx.audioPulse from this meter, and PostPipeline reads it into uAudioPulse to
 * breathe the halftone dots. The old graph metered `music` PRE-duck on purpose:
 * "a duck must not move a visual". Splitting the beds across two buses would
 * otherwise show the analyser only half the bed energy, so pulseBus sums music
 * and ambience back together and feeds the meter alone. Same total, still
 * pre-duck, still excluding every sfx bus, so the visual is unchanged by
 * construction.
 *
 * `ui` gets no room send: interface sound has to stay legible when the room is
 * a subway tunnel. `sub` gets none either -- reverberating a sub only smears it.
 */

export type BusName = "music" | "ambience" | "foley" | "hardfx" | "ui" | "sub";

export interface Buses {
  T: ToneModule;
  /** the single fade node: enable ramps it to 1, disable to 0 */
  out: Gain;

  /**
   * Bus INPUTS, keyed by name. Callers only ever connect to these; whether a
   * compressor or a filter sits in front is an implementation detail, which is
   * why these are ToneAudioNode rather than Gain.
   */
  in: Readonly<Record<BusName, ToneAudioNode>>;

  /** ducked node music+ambience pass through; the beat sidechain rides here */
  duckGain: Gain;
  /** metering tap -- summed pre-duck, connected to nothing downstream */
  meter: Meter;
  /** convolution room send input */
  roomIn: Gain;
  /** post-highpass node the room actually taps; rooms.ts owns everything past it */
  roomOut: ToneAudioNode;
}

/**
 * Room send per bus, as a linear gain.
 *
 * There is deliberately NO `ambience` entry. music and ambience merge into
 * duckGain before the send is tapped, so a separate ambience value would be
 * dead weight -- ambience already reaches the room through the bed send. Giving
 * it its own send while keeping that send POST-duck (so the room tail ducks
 * with the bed, behaviour worth preserving) would need a second duck node
 * automated in lockstep, which is not worth building while the ambience bus
 * still has zero sources. Revisit when Phase 4 re-homes room tones onto it.
 */
const SEND = { bed: 0.1, foley: 0.22, hardfx: 0.28 } as const;

export function buildBuses(T: ToneModule): Buses {
  // Master chain, unchanged from the shipped one: same EQ3, same compressor,
  // same limiter, same -9 dB ceiling, same single fade node.
  const eq = new T.EQ3({ low: 0, mid: 0, high: -3 });
  const comp = new T.Compressor({ threshold: -18, ratio: 3 });
  const limiter = new T.Limiter(-1);
  const out = new T.Gain(0);
  const mixIn = new T.Gain(1).connect(out);
  out.chain(eq, comp, limiter, T.getDestination());
  T.getDestination().volume.value = -9;

  const duckGain = new T.Gain(1).connect(mixIn);

  const music = new T.Gain(1).connect(duckGain);
  const ambience = new T.Gain(0.9).connect(duckGain);

  // Metering tap: sums BOTH bed buses, pre-duck, and goes nowhere else.
  const pulseBus = new T.Gain(1);
  const meter = new T.Meter({ smoothing: 0.9, normalRange: true });
  music.connect(pulseBus);
  ambience.connect(pulseBus);
  pulseBus.connect(meter);

  // Percussive buses get their own compression so a slam stops squashing a
  // button click. Attacks stay fast enough not to eat the transients this
  // whole rebuild exists to create.
  const foleyIn = new T.Compressor({ threshold: -20, ratio: 3, attack: 0.003, release: 0.12 });
  const foleyOut = new T.Gain(0.8).connect(mixIn);
  foleyIn.connect(foleyOut);

  const hardIn = new T.Compressor({ threshold: -14, ratio: 4, attack: 0.001, release: 0.2 });
  const hardOut = new T.Gain(1).connect(mixIn);
  hardIn.connect(hardOut);

  const uiOut = new T.Gain(0.7).connect(mixIn);

  // Sub is band-limited so an impact's weight cannot leak into the mids, and
  // sits behind its own compressor so it can never pump the master.
  const subIn = new T.Filter(120, "lowpass");
  const subComp = new T.Compressor({ threshold: -18, ratio: 6, attack: 0.005, release: 0.15 });
  const subOut = new T.Gain(0.7).connect(mixIn);
  subIn.chain(subComp, subOut);

  // Sends. Music feeds the room POST-duck so the tail ducks with the bed,
  // which is the behaviour the shipped graph had and is worth keeping.
  // 250 Hz highpass in front of the room, as main had. LF buildup in a reverb
  // send is the classic mud mechanism, and it compounds here: bandDecay[0] runs
  // to 1.5 on spread and 1.4 on origin, so the longest rooms hold low-frequency
  // energy for four to five seconds. The lowpass band inside ir.ts is a band OF
  // the IR -- it keeps lows in the tail, it does not keep them out of the send.
  const roomHp = new T.Filter(250, "highpass");
  const roomIn = new T.Gain(1).connect(roomHp);
  duckGain.connect(new T.Gain(SEND.bed).connect(roomIn));
  foleyOut.connect(new T.Gain(SEND.foley).connect(roomIn));
  hardOut.connect(new T.Gain(SEND.hardfx).connect(roomIn));

  return {
    T,
    out,
    roomOut: roomHp,
    in: { music, ambience, foley: foleyIn, hardfx: hardIn, ui: uiOut, sub: subIn },
    duckGain,
    meter,
    roomIn,
  };
}
