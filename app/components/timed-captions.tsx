"use client";
import { validateRecipe, type Recipe } from "../../lib/studio-model.mjs";
export default function TimedCaptions({
  recipe,
  onChange,
}: {
  recipe: Recipe;
  onChange: (update: Partial<Recipe>) => void;
}) {
  const cues = recipe.captions || [],
    last = cues.at(-1)?.end || 0;
  const update = (
    index: number,
    patch: Partial<NonNullable<Recipe["captions"]>[number]>,
  ) =>
    onChange({
      captions: cues.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  return (
    <section aria-label="Timed captions" className="timed-captions">
      <h4>Timed subtitles</h4>
      <p className="muted">
        Manual timings are relative to this clip (minimum 0.04 seconds per cue).
        Audio is not transcribed. Clear the static subtitle to use timed
        captions.
      </p>
      {cues.map((cue, index) => (
        <fieldset key={index}>
          <legend>Caption {index + 1}</legend>
          <label>
            Caption {index + 1} text
            <input
              maxLength={120}
              value={cue.text}
              onChange={(e) => update(index, { text: e.target.value })}
            />
          </label>
          <label>
            Caption {index + 1} start (seconds)
            <input
              type="number"
              min={0}
              max={recipe.duration}
              step={0.1}
              value={cue.start}
              onChange={(e) => update(index, { start: Number(e.target.value) })}
            />
          </label>
          <label>
            Caption {index + 1} end (seconds)
            <input
              type="number"
              min={0}
              max={recipe.duration}
              step={0.1}
              value={cue.end}
              onChange={(e) => update(index, { end: Number(e.target.value) })}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onChange({ captions: cues.filter((_, i) => i !== index) })
            }
          >
            Remove caption {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={
          Boolean(recipe.subtitle) ||
          cues.length >= 12 ||
          last >= recipe.duration
        }
        onClick={() =>
          onChange({
            captions: [
              ...cues,
              {
                start: last,
                end: Math.min(recipe.duration, last + 2),
                text: "",
              },
            ],
          })
        }
      >
        Add timed caption
      </button>
      {cues.length > 0 && validateRecipe(recipe) && (
        <p role="status">{validateRecipe(recipe)}</p>
      )}
    </section>
  );
}
