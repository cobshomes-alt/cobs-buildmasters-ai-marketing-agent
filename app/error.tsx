"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main
      className="auth-shell"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section className="surface" role="alert">
        <h1>Workspace could not be displayed</h1>
        <p>
          Your saved company records have not been changed by this display
          error. Unsaved browser edits may need to be entered again.
        </p>
        <button onClick={reset}>Retry workspace</button>
      </section>
    </main>
  );
}
