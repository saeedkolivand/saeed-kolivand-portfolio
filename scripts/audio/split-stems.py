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
         "-ac", "2", "-i", "-", str(path)],
        check=True, input=data,
    )

# HDEMUCS returns sources in this order.
SOURCES = ("drums", "bass", "other", "vocals")


def separate(model, mix, device, chunk_s=10.0, overlap_s=0.1, sr=44100):
    """Chunked separation with crossfaded overlaps, so long cues fit in VRAM."""
    chunk = int(chunk_s * sr)
    over = int(overlap_s * sr)
    total = mix.shape[-1]
    out = torch.zeros(len(SOURCES), mix.shape[0], total, device="cpu")
    win = torch.hann_window(over * 2, device=device) if over > 0 else None

    start = 0
    while start < total:
        end = min(start + chunk, total)
        lo = max(0, start - over)
        hi = min(total, end + over)
        seg = mix[:, lo:hi].unsqueeze(0).to(device)
        with torch.no_grad():
            est = model(seg)[0].cpu()
        # trim the overlap back off
        head = start - lo
        est = est[:, :, head:head + (end - start)]
        out[:, :, start:end] = est
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
    stems = stems * std + mean

    for i, name in enumerate(SOURCES):
        path = dst / f"score-{name}.wav"
        write_audio(path, stems[i], sr)
        rms = float(stems[i].pow(2).mean().sqrt())
        db = 20 * torch.log10(torch.tensor(max(rms, 1e-9)))
        print(f"  {name:7s} {path.name}  RMS {db:6.1f} dBFS")


if __name__ == "__main__":
    main()
