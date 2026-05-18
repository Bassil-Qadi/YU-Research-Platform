import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Stub — notifications in Phase 2 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    notifications: [],
    message: "Notifications API stub — implement in Phase 2",
  });
}
