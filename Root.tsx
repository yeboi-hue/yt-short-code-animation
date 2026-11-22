import React from "react";
import { Composition, staticFile } from "remotion";
import { PyramidShort, DEFAULTS, Props } from "./Pyramid";

export const Root: React.FC = () => (
  <Composition
    id="PyramidShort"
    component={PyramidShort}
    durationInFrames={DEFAULTS.starts[DEFAULTS.starts.length - 1]}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={DEFAULTS}
    calculateMetadata={async () => {
      try { // public/timing.json comes from scripts/make_audio.py: shot cuts follow the narration
        const j = await (await fetch(staticFile("timing.json"))).json();
        const props: Props = { starts: j.starts, audio: j.audio ?? null };
        return { durationInFrames: j.total as number, props };
      } catch {
        return { durationInFrames: DEFAULTS.starts[DEFAULTS.starts.length - 1], props: DEFAULTS };
      }
    }}
  />
);
