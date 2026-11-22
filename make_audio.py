"""Builds public/narration.wav (voice + wind/drone bed + a few effects) and public/timing.json.
Each of the 11 script lines becomes one shot, so the picture is cut to the voice.
Voice: edge-tts (free neural voice, needs internet). Fallback: espeak-ng. Needs ffmpeg + numpy."""
import asyncio, json, os, subprocess, wave
import numpy as np

FPS, SR = 30, 48000
VOICE, RATE = "en-US-GuyNeural", "+12%"
LINES = [
    "The Great Pyramid was the tallest building on Earth for almost four thousand years, and the crews who built it worked for bread and beer.",
    "It's about twenty five sixty B.C., and the pharaoh Khufu wants a tomb that touches the sky.",
    "That means more than two million stone blocks, each one as heavy as a small truck.",
    "Every block has to be dragged across the desert on a wooden sled. And everyone knows the problem: sand swallows sleds.",
    "So the workers try something strange. A man walks in front of each sled and pours water on the ground.",
    "Water? In the desert?",
    "You see, dry sand piles up in front of a sled like a snowplow. But wet sand packs down hard, and the sled just glides.",
    "Ever built a sandcastle? Dry sand falls apart. Wet sand holds. Scientists measured it, and the right amount of water cuts the pulling force in half.",
    "Thousands of paid workers, living in a town beside the site, did this for about twenty years, and the pyramid came out smooth, white and shining.",
    "Nobody forced them, either. They even painted their team names on hidden walls, like Friends of Khufu.",
    "So the greatest building project in history was really just a crew of guys with good beer, a bucket of water, and a very good team name.",
]
LEAD, GAP, TAIL, VLEAD = 0.3, 0.30, 1.2, 0.12   # seconds; VLEAD = picture cuts this early before the voice

os.makedirs("tmp", exist_ok=True); os.makedirs("public", exist_ok=True)


async def _tts(i, text):
    import edge_tts
    await edge_tts.Communicate(text, VOICE, rate=RATE).save(f"tmp/s{i}.mp3")


def synth(i, text):
    try:
        asyncio.run(_tts(i, text)); return f"tmp/s{i}.mp3"
    except Exception as e:
        print("edge-tts failed, using espeak-ng:", e)
        subprocess.run(["espeak-ng", "-s", "165", "-w", f"tmp/s{i}.wav", text], check=True)
        return f"tmp/s{i}.wav"


def load(path):
    out = path + ".48k.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-ar", str(SR), "-ac", "1", out], check=True)
    with wave.open(out) as w:
        return np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768


clips = [load(synth(i, t)) for i, t in enumerate(LINES)]
t, starts_s = LEAD, []
for c in clips:
    starts_s.append(t); t += len(c) / SR + GAP
total_s = t - GAP + TAIL
N = int(total_s * SR)
rng = np.random.default_rng(2560)

voice = np.zeros(N, np.float32)
for s, c in zip(starts_s, clips):
    k = int(s * SR); voice[k:k + len(c)] += c
voice *= 0.9 / max(1e-6, np.abs(voice).max())


def lowpass(x, n):  # box-filter lowpass, applied twice
    k = np.ones(n) / n
    return np.convolve(np.convolve(x, k, "same"), k, "same").astype(np.float32)


tt = np.arange(N) / SR
wind = lowpass(rng.standard_normal(N).astype(np.float32), 36)
wind *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * tt + 1.0)
wind /= np.abs(wind).max()
drone = sum(np.sin(2 * np.pi * f * tt) * a for f, a in [(98, 1.0), (147.3, 0.6), (196.6, 0.4), (293.4, 0.15)]).astype(np.float32)
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * tt)
drone /= np.abs(drone).max()
bed = 0.05 * wind + 0.03 * drone


def burst(at, dur, kind, gain):
    a, n = int(at * SR), int(dur * SR)
    n = min(n, N - a)
    if n <= 0: return
    u = np.arange(n) / SR
    if kind == "thump":
        x = np.sin(2 * np.pi * 55 * u * (1 + 0.3 * np.exp(-u / 0.05))) * np.exp(-u / 0.25)
    elif kind == "pour":
        x = np.diff(rng.standard_normal(n + 1)).astype(np.float32) * np.sin(np.pi * u / dur) ** 0.7 * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * u))
        x = lowpass(x, 3)
    else:  # drag: pulsing low rumble
        x = lowpass(rng.standard_normal(n).astype(np.float32), 60) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.8 * u)) ** 2
    bed[a:a + n] += gain * x / (np.abs(x).max() + 1e-9)


def to_frames(sec): return int(round(sec * FPS))
starts_f = [0] + [max(1, to_frames(s - VLEAD)) for s in starts_s[1:]]
burst(starts_s[1] - VLEAD, 1.0, "thump", 0.12)              # flash after the hook
burst(starts_s[3], (starts_s[4] - starts_s[3]) * 0.95, "drag", 0.05)   # sled bogging down in dry sand
burst(starts_s[4] + 0.35, 2.2, "pour", 0.10)                # water pouring
burst(starts_s[6], (starts_s[7] - starts_s[6]) * 0.6, "drag", 0.025)   # sled gliding on wet sand
mix = voice + bed
mix *= min(1.0, 0.95 / np.abs(mix).max())
with wave.open("public/narration.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
total_f = to_frames(total_s)
json.dump({"fps": FPS, "starts": starts_f + [total_f], "total": total_f, "audio": "narration.wav"}, open("public/timing.json", "w"), indent=1)
print(f"{total_s:.1f} s, {total_f} frames, shot starts (frames): {starts_f}")
