import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);
    const signedUrl = await getSignedDownloadUrl(decodedKey);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("[File Download] Error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
