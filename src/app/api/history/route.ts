import { NextResponse } from "next/server";
import { db } from "@/db";
import { usernameChecks } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(usernameChecks)
      .orderBy(desc(usernameChecks.checkedAt))
      .limit(50);

    const serialized = rows.map((row) => ({
      ...row,
      checkedAt: row.checkedAt instanceof Date
        ? row.checkedAt.toISOString()
        : String(row.checkedAt),
    }));

    return NextResponse.json({ history: serialized });
  } catch (err) {
    console.error("History fetch error:", err);
    return NextResponse.json({ history: [] });
  }
}

export async function DELETE() {
  try {
    await db.delete(usernameChecks);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("History clear error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
