"use client";
import { useState } from "react";
import {
  proposeEdit,
  confirmEdit,
  starterTemplates,
  type EditProposal,
} from "../../lib/assistant-editing";
import type { TimelineDocument } from "../../lib/timeline";
export default function AskCobsAI({
  document,
  disabled,
  onApply,
  onUndo,
  canUndo,
}: {
  document: TimelineDocument;
  disabled: boolean;
  onApply: (d: TimelineDocument) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [instruction, setInstruction] = useState(""),
    [caption, setCaption] = useState(""),
    [proposal, setProposal] = useState<EditProposal | null>(null),
    [message, setMessage] = useState("");
  function propose(text: string) {
    try {
      setProposal(proposeEdit(document, text, caption));
      setMessage("");
    } catch (e) {
      setProposal(null);
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="cobs-assistant" aria-label="Ask COBS AI">
      <div>
        <span className="eyebrow">YOUR EDITING COMPANION</span>
        <h3>Ask COBS AI</h3>
        <p>Upload → Describe or Edit → Preview → Export → Owner Review</p>
        <p>
          Describe a change. Review it, then apply. Free rule-based planning —
          no paid AI calls or visual scene analysis.
        </p>
      </div>
      <div className="cobs-template-grid">
        {starterTemplates.map((t) => (
          <button key={t} disabled={disabled} onClick={() => propose(t)}>
            <strong>{t}</strong>
            <small>Warm colour · subtle photo motion · original logo</small>
          </button>
        ))}
      </div>
      <label>
        What would you like to change?
        <textarea
          value={instruction}
          maxLength={600}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Make this video more cinematic and use a vertical Instagram format"
        />
      </label>
      <label>
        Optional verified caption
        <input
          value={caption}
          maxLength={120}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Your own words; no automatic transcription"
        />
      </label>
      <div className="cobs-assistant-actions">
        <button
          disabled={disabled}
          className="primary-action"
          onClick={() => propose(instruction)}
        >
          Propose edit
        </button>
        <button
          disabled={disabled || !canUndo}
          onClick={() => {
            onUndo();
            setProposal(null);
            setMessage("Previous timeline restored.");
          }}
        >
          Undo last edit
        </button>
      </div>
      {proposal && (
        <div className="cobs-edit-proposal">
          <h4>Proposed changes</h4>
          <ul>
            {proposal.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p>
            Original media and saved projects remain unchanged. You can undo
            after applying.
          </p>
          <button
            disabled={disabled}
            className="primary-action"
            onClick={() => {
              try {
                onApply(confirmEdit(document, proposal));
                setProposal(null);
                setMessage(
                  "Edit applied. Preview your timeline, then export for owner review.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Apply proposed edit
          </button>
          <button onClick={() => setProposal(null)}>Cancel proposal</button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
