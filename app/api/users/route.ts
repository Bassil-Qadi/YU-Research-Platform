import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Stub — user directory API in Phase 2 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    users: [],
    message: "Users API stub — implement in Phase 2",
  });
}
