import { NextResponse } from "next/server";
import { db } from "@/db";
import { usernameChecks } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(usernameChecks)
      .orderBy(desc(usernameChecks.checkedAt))
      .limit(50);

    return NextResponse.json({ history: rows });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
