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
  navigate: (section: string) => void;
};
export default function Overview({ counts, recent, navigate }: Props) {
  return (
    <>
      <section className="overview-hero">
        <div>
          <p className="eyebrow">COBS BUILDMASTERS LTD</p>
          <h2>
            Strong foundations.
            <br />A stronger brand.
          </h2>
          <p>
            Turn the work on your sites and factory floor into content that
            builds trust. Plan, create and review in one private workspace.
          </p>
          <div className="actions">
            <button onClick={() => navigate("Content Calendar")}>
              Create a draft ↗
            </button>
            <button
              className="hero-secondary"
              onClick={() => navigate("Media Library")}
            >
              Explore your media
            </button>
          </div>
        </div>
        <div className="hero-mark" aria-hidden="true">
          <span>COBS</span>
          <div className="block-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <small>BUILD WITH CONFIDENCE</small>
        </div>
      </section>
      <div className="stats-grid">
        {[
          ["Drafts", counts.drafts, "Content Calendar"],
          ["Awaiting approval", counts.pending, "Approvals"],
          ["Approved", counts.approved, "Approvals"],
          ["Ready for manual publishing", counts.ready, "Scheduler"],
        ].map(([label, value, section]) => (
          <button
            className="stat-card"
            key={String(label)}
            onClick={() => navigate(String(section))}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>View content ↗</small>
          </button>
        ))}
      </div>
      <div className="overview-grid">
        <article className="surface">
          <div className="section-heading">
            <h2>Recent content</h2>
            <button onClick={() => navigate("Content Calendar")}>
              View all
            </button>
          </div>
          {recent.length ? (
            recent.slice(0, 5).map((post) => (
              <div className="recent-row" key={post.id}>
                <strong>{post.title}</strong>
                <span className="badge">{post.status}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <h3>Your next story starts here</h3>
              <p>
                Create a draft or upload original project media to get started.
              </p>
            </div>
          )}
        </article>
        <article className="surface">
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h2>Built for your workflow</h2>
          <p>
            <strong>{counts.media}</strong> original media assets
            <br />
            <strong>{counts.campaigns}</strong> campaigns
          </p>
          <div className="workflow-steps">
            <p>
              <span>01</span> Upload original project media
            </p>
            <p>
              <span>02</span> Write and organise your drafts
            </p>
            <p>
              <span>03</span> Review and approve as owner
            </p>
          </div>
          <p className="muted">
            Publishing remains manual. Every content change requires a fresh
            approval.
          </p>
        </article>
      </div>
    </>
  );
}
