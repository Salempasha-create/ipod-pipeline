import { useEffect, useState } from "react";
import { api, isFinished, type Job, type PluginInfo } from "../api";

const POLL_MS = 200;

export function TestJob({ plugin }: { plugin: PluginInfo }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll the job until it finishes.
  useEffect(() => {
    if (!job || isFinished(job.status)) return;
    const timer = setTimeout(async () => {
      try {
        setJob(await api.job(job.id));
      } catch (err) {
        setError((err as Error).message);
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [job]);

  const start = async () => {
    setError(null);
    try {
      setJob(await api.startJob(plugin.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancel = async () => {
    if (!job) return;
    try {
      setJob(await api.cancelJob(job.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const running = job !== null && !isFinished(job.status);

  return (
    <div className="test-job">
      <div className="test-job-actions">
        {running ? (
          <button className="ghost" onClick={cancel}>
            Cancel
          </button>
        ) : (
          <button onClick={start} disabled={!plugin.enabled}>
            Run test job
          </button>
        )}
        {!plugin.enabled && !running && <span className="muted">Enable the plugin to run a test job.</span>}
      </div>

      {job && (
        <div className="job" aria-live="polite">
          <div className="job-head">
            <span className={`badge badge-${job.status}`}>{job.status}</span>
            <span className="job-message">{job.error ?? job.message}</span>
            <span className="job-percent">{Math.round(job.percent)}%</span>
          </div>
          <div
            className={`bar bar-${job.status}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(job.percent)}
          >
            <div style={{ width: `${job.percent}%` }} />
          </div>
          {job.status === "done" && job.files.length > 0 && (
            <ul className="files">
              {job.files.map((f) => (
                <li key={f}>
                  <code>{f}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
