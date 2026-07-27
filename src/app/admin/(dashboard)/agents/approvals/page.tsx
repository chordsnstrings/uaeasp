import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { outreachMessages, outreachThreads, prospects } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ApprovalCard } from "@/components/admin/AgentConsole";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const rows = await db
    .select({
      message: outreachMessages,
      thread: outreachThreads,
      prospectName: prospects.name,
    })
    .from(outreachMessages)
    .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
    .leftJoin(prospects, eq(outreachThreads.prospectId, prospects.id))
    .where(eq(outreachMessages.status, "pending_approval"))
    .orderBy(asc(outreachMessages.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/agents" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
          ← Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">Approval queue</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Every email below was written by an agent and will not send until you approve it.
          Edit the text freely — what you approve is what goes out.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 p-12 text-center">
          <p className="text-sm text-ink-500">Nothing waiting. The queue is clear.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map(({ message, thread, prospectName }) => (
            <ApprovalCard
              key={message.id}
              message={{
                id: message.id,
                subject: message.subject,
                bodyText: message.bodyText,
                toEmail: message.toEmail ?? thread.toEmail,
                campaign: thread.campaign,
                company: prospectName,
                intent: (message.aiMeta as { intent?: string } | null)?.intent ?? null,
                createdAt: new Date(message.createdAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Dubai",
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
