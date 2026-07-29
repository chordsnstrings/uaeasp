import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/components/admin/status";
import { CreateUserForm, ToggleActiveButton } from "@/components/admin/UserControls";
import {
  Badge,
  Card,
  Cell,
  DataTable,
  EmptyState,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const rows = await db.select().from(users).orderBy(asc(users.createdAt));

  const admins = rows.filter((u) => u.role === "admin").length;
  const activeCount = rows.filter((u) => u.active).length;
  const deactivated = rows.length - activeCount;
  const neverSignedIn = rows.filter((u) => !u.lastLoginAt).length;

  return (
    <>
      <PageHeader
        title="Team"
        count={rows.length}
        subtitle="Everyone with access to this console. Deactivating someone blocks sign-in immediately without deleting their history."
      />

      <section>
        <SectionTitle hint="Who can sign in right now.">Access</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active accounts" value={activeCount} tone="positive" />
          <StatCard
            label="Admins"
            value={admins}
            tone="brand"
            hint={`${rows.length - admins} sales`}
          />
          <StatCard
            label="Deactivated"
            value={deactivated}
            tone={deactivated > 0 ? "warning" : "neutral"}
            hint={deactivated > 0 ? "Cannot sign in." : "Nobody is locked out."}
          />
          <StatCard
            label="Never signed in"
            value={neverSignedIn}
            tone={neverSignedIn > 0 ? "info" : "neutral"}
            hint={neverSignedIn > 0 ? "Invited but not yet used." : "Everyone has signed in."}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-4">
          <SectionTitle hint="Oldest account first.">Members</SectionTitle>
          <DataTable head={["User", "Role", "Last sign-in", "Status", ""]} minWidth="46rem">
            {rows.length === 0 ? (
              <EmptyState
                colSpan={5}
                title="No accounts yet"
                body="Add the first team member with the form beside this table."
              />
            ) : (
              rows.map((user) => {
                const isYou = session.user.id === user.id;
                return (
                  <Row key={user.id}>
                    <Cell>
                      <p className="font-semibold text-ink-900">
                        {user.name}
                        {isYou && (
                          <Badge tone="brand" className="ms-2">
                            you
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-ink-500" dir="ltr">
                        {user.email}
                      </p>
                    </Cell>
                    <Cell>
                      <Badge tone={user.role === "admin" ? "brand" : "info"}>{user.role}</Badge>
                    </Cell>
                    <Cell className="num whitespace-nowrap text-xs text-ink-500">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                    </Cell>
                    <Cell>
                      <Badge tone={user.active ? "positive" : "neutral"}>
                        {user.active ? "active" : "deactivated"}
                      </Badge>
                    </Cell>
                    <Cell>
                      <div className="flex justify-end">
                        {!isYou && <ToggleActiveButton userId={user.id} active={user.active} />}
                      </div>
                    </Cell>
                  </Row>
                );
              })
            )}
          </DataTable>
        </section>

        <Card className="h-fit">
          <SectionTitle hint="They can sign in straight away with the password you set.">
            Add team member
          </SectionTitle>
          <CreateUserForm />
        </Card>
      </div>
    </>
  );
}
