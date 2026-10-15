"use client";
import { useEffect, useState } from "react";

export default function SystemStatus({ token }: { token: string }) {
  const [ai, setAi] = useState("Checking configuration…");
  const [render, setRender] = useState("Checking local worker…");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/creative-director", {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Configuration check unavailable");
        const result = await response.json();
        if (!controller.signal.aborted)
          setAi(
            result.configured
              ? "Configured; generation may use API credits."
              : "Not configured; sample and manual planning are available.",
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setAi(
            "Configuration could not be verified. Sample planning remains available.",
          );
      });
    fetch("/api/studio", {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Status unavailable");
        const result = await response.json();
        if (!controller.signal.aborted)
          setRender(
            result.ready && result.workerOnline
              ? "Local worker online. Hosted render acceptance remains unverified."
              : "Local worker unavailable in this environment.",
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setRender("Local worker status could not be verified.");
      });
    return () => controller.abort();
  }, [token]);
  return (
    <section aria-labelledby="system-status-title">
      <h3 id="system-status-title">System Status &amp; Integrations</h3>
      <dl className="scene-facts">
        <div>
          <dt>Workspace</dt>
          <dd>
            Owner access verified for this session. Supabase workspace reads
            completed.
          </dd>
        </div>
        <div>
          <dt>AI planning</dt>
          <dd>{ai}</dd>
        </div>
        <div>
          <dt>Multi-asset saving</dt>
          <dd>
            Requires the separately reviewed database proposal. No schema
            changes are applied by this interface.
          </dd>
        </div>
        <div>
          <dt>Media exports</dt>
          <dd>
            {render} Single-source and bounded combined exports require the
            local FFmpeg worker. Combined exports support 12 clips, 6 originals
            and 60 seconds.
          </dd>
        </div>
        <div>
          <dt>Publishing</dt>
          <dd>
            Social accounts are not connected. Publishing remains manual after
            owner approval.
          </dd>
        </div>
      </dl>
      <h3>Module integration status</h3>
      <p>
        Configuration and local checks do not establish live platform
        verification. Performance metrics remain unavailable until an official
        connector is configured and verified.
      </p>
      <div
        className="creative-table"
        role="region"
        aria-label="Module integration statuses"
        tabIndex={0}
      >
        <table>
          <caption>
            Current module capabilities and integration boundaries
          </caption>
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Current status</th>
              <th scope="col">Performance data</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Creative Director",
                "Sample/manual planning implemented; AI configuration shown above.",
                "Not applicable",
              ],
              [
                "Content Planning",
                "Existing campaigns, drafts and owner review.",
                "Workspace counts only",
              ],
              [
                "Media Studio",
                "Local export capability; worker check above. Hosted acceptance pending.",
                "Local job history",
              ],
              [
                "Social Publishing",
                "No Meta, TikTok or YouTube publishing connector implemented. Manual publishing only.",
                "Unavailable",
              ],
              [
                "Local Marketing & SEO",
                "Roadmap; no Google Business Profile or Search Console connector.",
                "Unavailable",
              ],
              [
                "Advertising",
                "No advertising connector implemented. Submission and spending disabled.",
                "Unavailable",
              ],
              [
                "Leads & Follow-ups",
                "Existing lead-entry form. CRM, reminders and messaging integrations planned.",
                "No connected attribution",
              ],
              [
                "Marketing Analytics",
                "Overview shows workspace counts; no connected platform performance feed.",
                "Unavailable",
              ],
              [
                "Scheduled Tasks",
                "Local render queue implemented. Marketing background scheduler not implemented.",
                "Local render job state only",
              ],
            ].map(([module, status, metrics]) => (
              <tr key={module}>
                <th scope="row">{module}</th>
                <td>{status}</td>
                <td>{metrics}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
