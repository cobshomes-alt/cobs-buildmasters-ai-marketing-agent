import type { GraphicsPlan } from "./plan";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const x = clamp(n);
  return x * x * (3 - 2 * x);
};
export function titleLines(text: string) {
  if (text.length <= 30) return [text];
  let split = text.lastIndexOf(" ", Math.ceil(text.length / 2) + 8);
  if (split < 8) split = Math.ceil(text.length / 2);
  return [text.slice(0, split).trim(), text.slice(split).trim()].filter(
    Boolean,
  );
}
/** Same SVG/frame function used by editor preview and Remotion exports. */
export function GraphicsFrame({
  plan,
  frame: requestedFrame,
  logoSource,
}: {
  plan: GraphicsPlan;
  frame: number;
  logoSource: string;
}) {
  const frame = Math.max(
    0,
    Math.min(plan.frames - 1, Math.floor(requestedFrame)),
  );
  const { width: w, height: h } = plan;
  const scene = plan.scenes.find((s) => frame >= s.from && frame < s.to);
  const local = scene ? frame - scene.from : 0;
  const enter = ease(local / 12),
    exit = scene ? ease((scene.to - frame) / 8) : 0;
  const ending = plan.logoFrom !== null && frame >= plan.logoFrom;
  const logoProgress = ending ? ease((frame - plan.logoFrom!) / 20) : 0;
  const lines = scene ? titleLines(scene.title) : [];
  const font = Math.min(
    w * 0.067,
    (w * 0.82) / (Math.max(1, ...lines.map((l) => l.length)) * 0.62),
  );
  const left = scene?.style === "lower-third",
    x = left ? w * 0.08 : w * 0.5;
  const y = h * (ending ? 0.73 : left ? 0.76 : 0.66) + (1 - enter) * h * 0.035;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="100%"
      aria-label="Premium motion graphics preview"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {ending && (
        <g opacity={logoProgress}>
          <image
            href={logoSource}
            x={w * 0.25}
            y={h * 0.22}
            width={w * 0.5}
            height={w * 0.5}
            preserveAspectRatio="xMidYMid meet"
            transform={`translate(${w * 0.5} ${h * 0.22 + w * 0.25}) scale(${0.94 + 0.06 * logoProgress}) translate(${-w * 0.5} ${-(h * 0.22 + w * 0.25)})`}
          />
        </g>
      )}
      {scene && (
        <g opacity={enter * exit}>
          <rect
            x={left ? w * 0.06 : w * 0.045}
            y={y - font * 1.15}
            width={left ? w * 0.88 : w * 0.91}
            height={font * (lines.length + 1.15)}
            rx={w * 0.014}
            fill="#071526"
            opacity={0.76}
          />
          <rect
            x={left ? w * 0.08 : w * 0.4}
            y={y - font * 0.85}
            width={w * 0.2 * enter}
            height={Math.max(2, w * 0.005)}
            fill="#e1bf81"
          />
          {lines.map((line, i) => (
            <text
              key={i}
              x={x}
              y={y + i * font * 1.25}
              fill="#fff"
              fontFamily="Arial, sans-serif"
              fontSize={font}
              fontWeight="700"
              textAnchor={left ? "start" : "middle"}
            >
              {line}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
