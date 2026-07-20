"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { fetchMofProviders } from "@/lib/ingest/fetch-mof";
import { processIngestPayload } from "@/lib/ingest/process";
import { recordFailedRun } from "@/lib/ingest/reconcile";

export interface RefreshState {
  ok: boolean;
  message: string;
}

/** Admin-triggered refresh: fetch the official list server-side and run it
 * through the same reconcile pipeline the nightly workflow uses. */
export async function refreshDirectoryNow(): Promise<RefreshState> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { ok: false, message: "Not authorized." };
  }

  const fetched = await fetchMofProviders();
  if (!fetched.ok) {
    await recordFailedRun({
      error: fetched.error ?? "Unknown fetch error",
      strategy: "scrape_html",
      triggeredBy: "admin",
    });
    revalidatePath("/admin/scrapes");
    return {
      ok: false,
      message: `${fetched.error} The nightly automatic refresh will still run — or trigger the "Refresh provider directory" workflow on GitHub, which uses a full browser.`,
    };
  }

  const result = await processIngestPayload({
    strategy: "scrape_html",
    triggeredBy: "admin",
    providers: fetched.providers,
  });

  revalidatePath("/admin/scrapes");

  if (result.status === "rejected") {
    return {
      ok: false,
      message: result.rejectedReason ?? "Run rejected by safety checks — no changes applied.",
    };
  }
  return {
    ok: true,
    message: `Refreshed from the official list: ${result.found} found · +${result.added} added · ${result.updated} updated · ${result.missing} missing.`,
  };
}
