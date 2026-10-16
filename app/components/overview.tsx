"use client";
import { useEffect, useState } from "react";
import type { StudioEntry } from "./product-shell";
type Props = {
  counts: {
    drafts: number;
    pending: number;
    approved: number;
    ready: number;
    media: number;
    campaigns: number;
  };
  recent: { id: string; title: string; status: string }[];
  navigate: (s: string, entry?: StudioEntry) => void;
};
export default function Overview({ counts, recent, navigate }: Props) {
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    try {
      setGuide(localStorage.getItem("cobs-onboarding-dismissed") !== "yes");
    } catch {
      setGuide(true);
    }
  }, []);
  return (
    <div className="home-launcher">
      <p className="home-intro">
        One place for your ideas, your footage and your next great story.
      </p>
      <section
        className="creation-actions"
        aria-label="Create your next project"
      >
        {[
          {
            name: "Create with AI",
            description: "Describe your idea. Get an editable video plan.",
            icon: "✦",
            id: "Media Studio",
            mode: "automatic",
          },
          {
            name: "Edit Myself",
            description: "Bring your footage. Shape every detail yourself.",
            icon: "▣",
            id: "Media Studio",
            mode: "manual",
          },
          {
            name: "Plan Content",
            description: "Shot lists, scripts and a clear plan for filming.",
            icon: "☷",
            id: "Creative Studio",
          },
          {
            name: "My Posts",
            description: "Pick up a draft or prepare content for review.",
            icon: "▤",
            id: "Content Calendar",
          },
        ].map((a, i) => (
          <button
            className={`creation-action action-${i}`}
            key={a.name}
            onClick={() => navigate(a.id, a.mode as StudioEntry | undefined)}
          >
            <span className="creation-icon" aria-hidden="true">
              {a.icon}
            </span>
            <div>
              <h2>{a.name}</h2>
              <p>{a.description}</p>
            </div>
            <span className="action-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
        ))}
      </section>
      {guide && (
        <section className="first-use-guide" aria-label="Getting started">
          <div>
            <span className="eyebrow">
              YOUR FIRST VIDEO, THREE SIMPLE STEPS
            </span>
            <p>
              <strong>1. Add your originals.</strong>{" "}
              <span>2. Create or edit a plan.</span>{" "}
              <span>3. Preview, then review.</span>
            </p>
          </div>
          <div className="actions">
            <button onClick={() => navigate("Media Library")}>
              Upload your first media
            </button>
            <button
              aria-label="Dismiss getting started guide"
              onClick={() => {
                setGuide(false);
                try {
                  localStorage.setItem("cobs-onboarding-dismissed", "yes");
                } catch {}
              }}
            >
              ×
            </button>
          </div>
        </section>
      )}
      <section className="recent-work">
        <header>
          <div>
            <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
            <h2>Your recent work</h2>
          </div>
          <button onClick={() => navigate("Content Calendar")}>
            View all posts ↗
          </button>
        </header>
        {recent.length ? (
          <div className="recent-work-list">
            {recent.slice(0, 5).map((p) => (
              <button key={p.id} onClick={() => navigate("Content Calendar")}>
                <span className="recent-work-icon" aria-hidden="true">
                  ▤
                </span>
                <strong>{p.title}</strong>
                <span className="badge">{p.status}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="home-empty">
            <span aria-hidden="true">✧</span>
            <h3>Your next story starts here</h3>
            <p>No posts yet. Choose a creation option above to begin.</p>
          </div>
        )}
        <footer>
          <span>{counts.campaigns} projects</span>
          <span>{counts.media} original media</span>
          <button onClick={() => navigate("Approvals")}>
            {counts.pending} awaiting owner review
          </button>
        </footer>
      </section>
    </div>
  );
}
