import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const conditions: SQL[] = [];
  const status = params.get("status");
  const emirate = params.get("emirate");
  const assigned = params.get("assigned");
  const q = params.get("q")?.trim();

  if (status) conditions.push(sql`${leads.status} = ${status}`);
  if (emirate) conditions.push(eq(leads.emirate, emirate));
  if (assigned === "none") conditions.push(sql`${leads.assignedTo} is null`);
  else if (assigned) conditions.push(eq(leads.assignedTo, assigned));
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(leads.companyName, pattern),
        ilike(leads.fullName, pattern),
        ilike(leads.email, pattern),
        ilike(leads.phone, pattern),
      )!,
    );
  }

  const rows = await db
    .select({ lead: leads, assigneeName: users.name })
    .from(leads)
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(leads.createdAt))
    .limit(10000);

  const header = [
    "created_at",
    "status",
    "company",
    "contact_name",
    "email",
    "phone",
    "emirate",
    "invoice_volume",
    "accounting_software",
    "budget",
    "timeline",
    "source",
    "quiz_score",
    "language",
    "assigned_to",
    "duplicate_flag",
    "message",
  ];

  const lines = rows.map(({ lead, assigneeName }) =>
    [
      lead.createdAt.toISOString(),
      lead.status,
      lead.companyName,
      lead.fullName,
      lead.email,
      lead.phone,
      lead.emirate,
      lead.invoiceVolume,
      lead.accountingSoftware,
      lead.budgetRange,
      lead.timeline,
      lead.source,
      lead.quizScore,
      lead.locale,
      assigneeName,
      lead.flaggedDuplicate ? "yes" : "",
      lead.message,
    ]
      .map(csvCell)
      .join(","),
  );

  await writeAudit({
    userId: session.user.id,
    action: "leads.export",
    entity: "lead",
    diff: { count: rows.length, filters: { status, emirate, assigned, q } },
  });

  // UTF-8 BOM so Arabic text opens correctly in Excel
  const csv = "﻿" + [header.join(","), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
