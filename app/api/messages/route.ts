import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Stub — messaging in Phase 2 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    messages: [],
    message: "Messages API stub — implement in Phase 2",
  });
}
