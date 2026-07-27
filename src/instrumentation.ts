/**
 * In-process scheduler.
 *
 * App Platform has no cron, and GitHub Actions schedules only fire on a
 * repository's default branch, so the app keeps its own clock: once the server
 * is up, a timer beats every few minutes to run the nightly directory refresh
 * and drain the agent queue.
 *
 * It beats by calling its own /api/agents/tick over the loopback interface
 * rather than importing the agent code directly — instrumentation is compiled
 * for the edge runtime as well as Node, and the agent modules pull in
 * Node-only dependencies that cannot be bundled there. Going through HTTP also
 * means the internal and external schedules take exactly the same path.
 */

const BEAT_INTERVAL_MS = 5 * 60 * 1000;
/** Let the container finish booting (and migrations settle) before beating. */
const FIRST_BEAT_DELAY_MS = 90 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.DISABLE_INTERNAL_SCHEDULER === "true") return;

  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    console.warn("[heartbeat] INGEST_SECRET is not set — internal scheduler disabled");
    return;
  }
  const port = process.env.PORT ?? "3000";
  const url = `http://127.0.0.1:${port}/api/agents/tick?limit=10`;

  const beat = async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(280_000),
      });
      if (!res.ok) {
        console.error(`[heartbeat] tick returned ${res.status}`);
        return;
      }
      const body = (await res.json()) as {
        skipped?: string;
        processed?: number;
        maintenance?: { ran?: boolean; reason?: string; detail?: string };
      };
      const parts = [
        body.maintenance?.ran
          ? `refresh: ${body.maintenance.detail ?? body.maintenance.reason}`
          : null,
        body.processed ? `tasks: ${body.processed}` : null,
      ].filter(Boolean);
      if (parts.length) console.log(`[heartbeat] ${parts.join(" · ")}`);
    } catch (err) {
      // Never let a failed beat take the server down — the next one retries.
      console.error("[heartbeat] failed:", err);
    }
  };

  setTimeout(() => {
    void beat();
    const timer = setInterval(() => void beat(), BEAT_INTERVAL_MS);
    timer.unref?.();
  }, FIRST_BEAT_DELAY_MS).unref?.();

  console.log("[heartbeat] internal scheduler armed");
}
