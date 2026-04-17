import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGhanaReturnAction } from "@/modules/compliance/actions/ghana-returns.action";
import { exportStatutoryReturn } from "@/lib/compliance/ghana/exporter";
import { getExportContentType } from "@/lib/export";

/**
 * Download a Ghana statutory return as CSV or XLSX.
 *
 * Delegates to the server action so permission + identifier checks run
 * once in one place, then streams the exporter's buffer back with the
 * right Content-Type and Content-Disposition headers.
 */

const querySchema = z.object({
  kind: z.string(),
  periodFrom: z.string(),
  periodTo: z.string(),
  label: z.string(),
  academicYearId: z.string().optional(),
  format: z.enum(["csv", "xlsx"]).default("csv"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    kind: url.searchParams.get("kind"),
    periodFrom: url.searchParams.get("periodFrom"),
    periodTo: url.searchParams.get("periodTo"),
    label: url.searchParams.get("label"),
    academicYearId: url.searchParams.get("academicYearId") ?? undefined,
    format: (url.searchParams.get("format") ?? "csv") as "csv" | "xlsx",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await generateGhanaReturnAction({
    kind: parsed.data.kind as never,
    periodFrom: parsed.data.periodFrom,
    periodTo: parsed.data.periodTo,
    label: parsed.data.label,
    academicYearId: parsed.data.academicYearId,
  });
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  // Cast: `result.data` is a union of `StatutoryReturn<SpecificRow>` types,
  // each SpecificRow being a named interface without an index signature. The
  // exporter only treats rows as plain objects (reads keys + values, never
  // mutates), so the widened `Record<string, unknown>` view is structurally
  // sound even though TypeScript can't prove it without the cast.
  const { buffer, filename } = exportStatutoryReturn(
    result.data as unknown as import("@/lib/compliance/ghana/types").StatutoryReturn<
      Record<string, unknown>
    >,
    parsed.data.format,
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": getExportContentType(parsed.data.format),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
