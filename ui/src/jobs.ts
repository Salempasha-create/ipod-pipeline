// How a job is described in the Queue page and the Changer.
import type { Job } from "./api";
import type { IconName } from "./components/Icon";

export const STAGE_ORDER = ["DOWNLOADING", "WAITING", "IN LIBRARY", "STOPPED"] as const;

export interface Stage {
  name: (typeof STAGE_ORDER)[number] | "FAILED" | "CANCELLED";
  icon: IconName;
  /** "45%" or "DONE". */
  pct: string;
  detail: string;
}

export function jobTitle(job: Job): string {
  return job.request.result?.title ?? String(job.request.query ?? "Test job");
}

export function jobArtist(job: Job): string {
  return job.request.result?.artist ?? "Test";
}

export function jobStage(job: Job): Stage & { name: (typeof STAGE_ORDER)[number] } {
  const pct = `${Math.round(job.percent)}%`;
  switch (job.status) {
    case "running":
      return { name: "DOWNLOADING", icon: "download", pct, detail: job.message || "Starting" };
    case "queued":
      return { name: "WAITING", icon: "queue", pct, detail: "Waiting for a free download slot" };
    case "done":
      return { name: "IN LIBRARY", icon: "done", pct: "DONE", detail: "Ready to send to iOpenPod" };
    case "failed":
      return { name: "STOPPED", icon: "eject", pct, detail: `Failed: ${job.error ?? "unknown error"}` };
    default:
      return { name: "STOPPED", icon: "eject", pct, detail: "Cancelled" };
  }
}
