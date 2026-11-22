# The Pyramid Built on Wet Sand (Remotion + three.js, 1080x1920, ~60 s)

## Get the MP4 from GitHub (no local setup)
1. Create a new GitHub repo and push this whole folder to the `main` branch (keep the `.github` folder).
2. Open the repo > **Actions** > **Render pyramid short**. It starts on push; or press **Run workflow**
   (use scale 0.5 for a fast preview first).
3. When it turns green, open the run and download **pyramid-short-mp4** at the bottom (Artifacts). Unzip it for `pyramid.mp4`.

The workflow makes the narration (edge-tts voice, espeak-ng fallback), mixes wind/drone/sfx, writes `public/timing.json`
(shot cuts follow the voice), then renders with software WebGL. Expect roughly 1 to 3 hours at full size.

## Local
    pip install edge-tts numpy      # and have ffmpeg installed
    npm install
    npm run audio                    # narration.wav + timing.json
    npm run dev                      # preview
    npm run render                   # out/pyramid.mp4

## Tweaks
- Voice/speed: `VOICE`, `RATE` in scripts/make_audio.py. Script text: `LINES` (one line = one shot).
- Camera moves per shot: `SHOTS` in src/Pyramid.tsx. Scene: `World` in the same file.
