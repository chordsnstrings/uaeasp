import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/components/admin/status";
import { CreateUserForm, ToggleActiveButton } from "@/components/admin/UserControls";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const rows = await db.select().from(users).orderBy(asc(users.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink-900">Team</h1>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 text-start font-semibold">User</th>
                <th className="px-4 py-3 text-start font-semibold">Role</th>
                <th className="px-4 py-3 text-start font-semibold">Last login</th>
                <th className="px-4 py-3 text-start font-semibold">Status</th>
                <th className="px-4 py-3 text-start font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {rows.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900">{user.name}</p>
                    <p className="text-xs text-ink-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        user.role === "admin"
                          ? "bg-violet-50 text-violet-700 ring-violet-200"
                          : "bg-sky-50 text-sky-700 ring-sky-200"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        user.active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-ink-100 text-ink-500 ring-ink-200"
                      }`}
                    >
                      {user.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {session.user.id !== user.id && (
                      <ToggleActiveButton userId={user.id} active={user.active} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="h-fit rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Add team member
          </h2>
          <div className="mt-4">
            <CreateUserForm />
          </div>
        </section>
      </div>
    </div>
  );
}
