import { useEffect } from "react";
import { api, type Job } from "../api";
import { Icon } from "../components/Icon";
import { SegmentedProgress } from "../components/SegmentedProgress";
import type { SourceStyle } from "../sources";
import { jobStage, jobTitle, STAGE_ORDER } from "../jobs";
import type { PageProps } from "./types";

interface Props extends PageProps {
  jobs: Job[];
  paused: boolean;
  sourceFor: (id: string) => SourceStyle;
  onChanged: () => void;
}

export function QueuePage({ active, registerPrimary, setStatus, jobs, paused, sourceFor, onChanged }: Props) {
  const togglePause = async () => {
    await api.setPaused(!paused);
    onChanged();
  };

  const running = jobs.filter((j) => j.status === "running").length;
  const waiting = jobs.filter((j) => j.status === "queued").length;

  useEffect(() => {
    if (!active) return;
    registerPrimary(togglePause);
    setStatus(`${running} ACTIVE · ${waiting} WAITING${paused ? " · PAUSED" : ""}`);
  });

  const cancel = async (job: Job) => {
    await api.cancelJob(job.id);
    onChanged();
  };

  const groups = STAGE_ORDER.map((stage) => ({
    stage,
    jobs: jobs.filter((j) => jobStage(j).name === stage),
  })).filter((g) => g.jobs.length > 0);

  return (
    <div className="page" hidden={!active}>
      <div className="page-toolbar">
        <button type="button" className="screen-button" aria-pressed={paused} onClick={togglePause}>
          {paused ? "RESUME QUEUE" : "PAUSE QUEUE"}
        </button>
        {paused && <span className="screen-hint">Started downloads finish; waiting ones hold.</span>}
      </div>
      {jobs.length === 0 ? (
        <p className="screen-hint">Nothing loaded. Pick a result on SEARCH and press DOWNLOAD.</p>
      ) : (
        groups.map((g) => (
          <section key={g.stage} className="queue-group" aria-label={g.stage}>
            <h3 className="screen-label">
              {g.stage} · {g.jobs.length}
            </h3>
            <ul className="queue-list">
              {g.jobs.map((job) => {
                const source = sourceFor(job.source_id);
                const stage = jobStage(job);
                const live = job.status === "queued" || job.status === "running";
                return (
                  <li key={job.id} className="queue-row">
                    <Icon name={source.icon} size={32} back={source.color} ink="var(--screen-text)" />
                    <div className="queue-info">
                      <div className="queue-head">
                        <span className="queue-title">{jobTitle(job)}</span>
                        <span className="queue-pct">{stage.pct}</span>
                      </div>
                      <span className="result-sub">
                        {source.name} · {stage.detail}
                      </span>
                      <SegmentedProgress off="var(--screen-bar-off)" percent={job.percent} color={source.color} label={`${jobTitle(job)} progress`} />
                    </div>
                    {live && (
                      <button type="button" className="screen-button" onClick={() => cancel(job)} aria-label={`Cancel ${jobTitle(job)}`}>
                        CANCEL
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
