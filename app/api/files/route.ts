import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Stub — S3 uploads in Phase 3 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "File uploads not implemented yet" },
    { status: 501 }
  );
}
