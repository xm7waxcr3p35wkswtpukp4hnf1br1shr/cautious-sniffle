import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { usernameChecks } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getWhere(userId: string | null) {
  return userId ? eq(usernameChecks.userId, userId) : isNull(usernameChecks.userId);
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  try {
    const rows = await db
      .select()
      .from(usernameChecks)
      .where(getWhere(userId))
      .orderBy(desc(usernameChecks.checkedAt))
      .limit(50);

    return NextResponse.json({
      history: rows.map(r => ({
        ...r,
        checkedAt: r.checkedAt instanceof Date ? r.checkedAt.toISOString() : String(r.checkedAt),
      })),
    });
  } catch (err) {
    console.error("History fetch error:", err);
    return NextResponse.json({ history: [] });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  try {
    await db.delete(usernameChecks).where(getWhere(userId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("History clear error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}