"""
Split a generated score cue into stems with Hybrid Demucs.

Run with the ComfyUI venv's python, which already has torch + torchaudio:

    D:/ComfyUI/venv/Scripts/python.exe scripts/audio/split-stems.py IN.flac OUTDIR

Manual authoring step, like the ComfyUI generation itself. Nothing at build or
run time touches this -- `next build` and CI never need torch.

Why stems from ONE cue rather than several generated cues: splitting guarantees
the layers share key, tempo and phase. ACE-Step v1 has no bpm input (that is the
1.5 node), so tempo is only a prompt hint -- four separately generated cues would
drift against each other and could not be crossfaded as vertical layers.
"""

import subprocess
import sys
import pathlib
import numpy as np
import torch
from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS

# I/O goes through ffmpeg rather than torchaudio.load/save: recent torchaudio
# routes those through TorchCodec, which is not installed, and adding it to the
# ComfyUI venv to read a file ffmpeg already reads would be a poor trade.


def read_audio(path, sr):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le",
         "-ar", str(sr), "-ac", "2", "-"],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy()
    return torch.from_numpy(a)


def write_audio(path, wav, sr):
    data = wav.T.contiguous().cpu().numpy().astype(np.float32).tobytes()
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(sr),
         "-ac", "2", "-i", "-",
         # Demucs synthesises broadband junk right up to Nyquist that is not in
         # the source: measured at -38.3 dBFS in the 16-24 kHz band of the
         # delivered mix against -68.7 in the cue itself, so +36 dB the pipeline
         # invented, and the third-loudest band in the shipped file. It sits
         # above anything audible, but it costs 2 dB of peak headroom and a
         # share of the AAC bit budget at 160 kbps -- both of which the music
         # can use instead.
         "-af", "lowpass=f=19000:poles=2,lowpass=f=19000:poles=2",
         "-c:a", "pcm_f32le", str(path)],
        check=True, input=data,
    )

# HDEMUCS returns sources in this order.
SOURCES = ("drums", "bass", "other", "vocals")


def separate(model, mix, device, chunk_s=10.0, overlap_s=0.5, sr=44100):
    """Chunked separation with OVERLAP-ADD, so long cues fit in VRAM.

    Each chunk is separated with `overlap_s` of context on both sides, and the
    overlapping regions are CROSSFADED rather than butt-joined.

    Butt-joining is what this used to do, and it is wrong: the model's estimate
    for a sample depends on its surrounding context, so the last sample of one
    chunk and the first of the next come from different separations. That is a
    step discontinuity at every join -- eleven of them in a 120 s cue. Measured
    at -45.7 dB relative to the mix and masked for most of its length, so it was
    never the loud problem it looked like, but it is free to remove here.

    LINEAR ramps, deliberately. Two adjacent estimates are two readings of the
    SAME underlying signal, so they are correlated and linear complementary
    ramps preserve amplitude exactly; equal-power would sum to +3 dB across
    every seam.
    """
    chunk = int(chunk_s * sr)
    over = int(overlap_s * sr)
    total = mix.shape[-1]
    out = torch.zeros(len(SOURCES), mix.shape[0], total, device="cpu")

    start = 0
    while start < total:
        end = min(start + chunk, total)
        lo = max(0, start - over)
        hi = min(total, end + over)
        seg = mix[:, lo:hi].unsqueeze(0).to(device)
        with torch.no_grad():
            est = model(seg)[0].cpu()

        # Ramp in across the leading context and out across the trailing one.
        # The span chunk k ramps DOWN over is exactly the span chunk k+1 ramps
        # UP over, so the two windows sum to 1 and the signal is continuous
        # through the join instead of stepping.
        w = torch.ones(hi - lo)
        head = start - lo
        tail = hi - end
        if head > 0:
            w[:head] = torch.linspace(0.0, 1.0, head)
        if tail > 0:
            w[-tail:] = torch.linspace(1.0, 0.0, tail)
        out[:, :, lo:hi] += est * w

        start = end
        print(f"  {min(start, total)}/{total} samples", end="\r", flush=True)
    print()
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src = pathlib.Path(sys.argv[1])
    dst = pathlib.Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}")

    bundle = HDEMUCS_HIGH_MUSDB_PLUS
    model = bundle.get_model().to(device).eval()
    model_sr = bundle.sample_rate

    sr = model_sr
    wav = read_audio(src, sr)
    print(f"input: {wav.shape[1] / sr:.1f}s, {wav.shape[0]}ch, {sr} Hz")

    # Demucs expects a roughly unit-scaled mix.
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std()
    wav = (wav - mean) / (std + 1e-8)

    stems = separate(model, wav, device, sr=sr)
    # mean / len: the forward transform subtracted `mean` ONCE, so adding it
    # back to every stem would break the invariant that makes 'one cue split
    # into layers' true -- the stems would no longer sum to the input. Audio
    # DC is ~0 so this is inaudible, but this file is the reproducibility
    # artifact and the arithmetic should be exact.
    stems = stems * std + mean / len(SOURCES)

    # FOLD VOCALS INTO `other`, because the cue is instrumental by construction.
    #
    # Only drums / bass / other are shipped, so anything Demucs routes to
    # `vocals` is silently discarded at bake time. On a genuinely instrumental
    # cue that stem is not singing -- it is melodic content the separator could
    # not place, and a sustained lead line is exactly what it mistakes for a
    # voice. Measured on this cue: vocals came back at -26.4 dBFS, LOUDER than
    # `other` at -29.0, so dropping it would have shipped the score without its
    # melody.
    #
    # Folding rather than shipping a fourth layer keeps the runtime contract
    # (three vertical layers) and restores the invariant that matters: the
    # stems sum to the cue.
    vi = SOURCES.index("vocals")
    oi = SOURCES.index("other")
    v_rms = float(stems[vi].pow(2).mean().sqrt())
    v_db = 20 * torch.log10(torch.tensor(max(v_rms, 1e-9)))
    stems[oi] = stems[oi] + stems[vi]
    print(f"  vocals folded into other (was {float(v_db):.1f} dBFS)")

    for i, name in enumerate(SOURCES):
        if name == "vocals":
            continue
        path = dst / f"score-{name}.wav"
        write_audio(path, stems[i], sr)
        rms = float(stems[i].pow(2).mean().sqrt())
        db = 20 * torch.log10(torch.tensor(max(rms, 1e-9)))
        print(f"  {name:7s} {path.name}  RMS {db:6.1f} dBFS")


if __name__ == "__main__":
    main()
