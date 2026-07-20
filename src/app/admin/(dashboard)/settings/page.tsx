import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getConfigStatus } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const status = await getConfigStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Runtime configuration for email, notifications, AI drafts and the data-refresh
          secret. Values saved here override environment variables and apply immediately.
          Secrets are write-only — they are never displayed after saving.
        </p>
      </div>
      <SettingsForm
        status={status}
        ingestUrl={absoluteUrl("/api/ingest/providers")}
      />
    </div>
  );
}
