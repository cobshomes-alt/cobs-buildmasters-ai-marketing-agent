import {
  Composition,
  registerRoot,
  useCurrentFrame,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";
import { useEffect, useState } from "react";
import { GraphicsFrame } from "./graphics";
import type { GraphicsPlan } from "./plan";
type Props = { plan: GraphicsPlan; logoSource: string };
function Movie(props: Props) {
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender("Load original company logo"));
  useEffect(() => {
    const img = new Image();
    img.src = props.logoSource;
    void img
      .decode()
      .then(() => continueRender(handle))
      .catch(cancelRender);
  }, [handle, props.logoSource]);
  return <GraphicsFrame {...props} frame={frame} />;
}
function Root() {
  return (
    <Composition
      id="CobsGraphics"
      component={Movie}
      fps={25}
      width={720}
      height={1280}
      durationInFrames={25}
      defaultProps={{
        plan: {
          fps: 25,
          width: 720,
          height: 1280,
          frames: 25,
          scenes: [],
          logoFrom: null,
        },
        logoSource: "",
      }}
      calculateMetadata={({ props }) => ({
        width: props.plan.width,
        height: props.plan.height,
        fps: 25,
        durationInFrames: props.plan.frames,
      })}
    />
  );
}
registerRoot(Root);
