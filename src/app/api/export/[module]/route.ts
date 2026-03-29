import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateExport,
  getExportContentType,
  getExportExtension,
  type ExportFormat,
} from "@/lib/export";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const exportModule = resolvedParams.module;
    const body = await request.json();
    const {
      columns,
      data,
      format = "xlsx",
      filename,
    } = body as {
      columns: { key: string; header: string }[];
      data: Record<string, unknown>[];
      format?: ExportFormat;
      filename?: string;
    };

    if (!columns || !data) {
      return NextResponse.json({ error: "columns and data are required" }, { status: 400 });
    }

    const buffer = generateExport({
      filename: filename || exportModule,
      columns,
      data,
      format,
      sheetName: exportModule,
    });

    const exportFilename = `${filename || exportModule}-${new Date().toISOString().slice(0, 10)}.${getExportExtension(format)}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": getExportContentType(format),
        "Content-Disposition": `attachment; filename="${exportFilename}"`,
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
