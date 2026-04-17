import { createHash } from "node:crypto";
import { renderHandlebarsLike } from "@/lib/notifications/templates";
import type { DocumentTemplateEngine } from "@prisma/client";

/**
 * Render a document template to a PDF buffer.
 *
 * Two engines are supported:
 *   - HANDLEBARS_PDF: a raw HTML body with {{var}} placeholders. Rendered
 *     to PDF via a shared HTML→PDF bridge. The stub implementation here
 *     returns an HTML-as-PDF placeholder so the pipeline is testable
 *     without pulling in a headless-browser dependency. Swap to
 *     `puppeteer` / `playwright` / `@sparticuz/chromium` when infra is
 *     available.
 *   - REACT_PDF: resolves a `componentKey` against a code-side registry
 *     of React-PDF components and renders via the existing generator.
 *
 * Every rendered PDF is also hashed (SHA-256) so signatures can chain
 * against it without re-reading the R2 object.
 */

import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { getReactPdfComponent } from "./react-pdf-registry";

export interface RenderResult {
  pdf: Buffer;
  sha256: string;
  engineUsed: DocumentTemplateEngine;
}

export interface RenderInput {
  engine: DocumentTemplateEngine;
  bodyHtml: string | null;
  componentKey: string | null;
  payload: Record<string, unknown>;
}

export async function renderDocumentToPdf(input: RenderInput): Promise<RenderResult> {
  let pdf: Buffer;
  if (input.engine === "REACT_PDF") {
    if (!input.componentKey) {
      throw new Error("REACT_PDF template is missing a componentKey.");
    }
    const Component = getReactPdfComponent(input.componentKey);
    if (!Component) {
      throw new Error(
        `Unknown React-PDF component '${input.componentKey}'. ` +
          "Register it in src/lib/documents/react-pdf-registry.ts.",
      );
    }
    // The generator accepts any React-PDF element.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf = await renderPdfToBuffer(Component(input.payload as any) as never);
  } else {
    if (!input.bodyHtml) {
      throw new Error("HANDLEBARS_PDF template is missing a bodyHtml body.");
    }
    const rendered = renderHandlebarsLike(input.bodyHtml, input.payload);
    pdf = await renderHtmlToPdf(rendered);
  }

  const sha256 = createHash("sha256").update(pdf).digest("hex");
  return { pdf, sha256, engineUsed: input.engine };
}

/**
 * HTML → PDF bridge. Production-grade conversion wants a headless Chromium
 * (Playwright, Puppeteer, or @sparticuz/chromium on AWS Lambda). For now
 * we emit a minimal PDF-wrapped HTML blob so the end-to-end pipeline —
 * render, hash, sign, store in R2 — is exercised without a new dep.
 *
 * Swap-in surface: replace this function body with a call into the real
 * HTML-to-PDF engine. Everything else in the document stack is agnostic.
 */
async function renderHtmlToPdf(html: string): Promise<Buffer> {
  // Minimal PDF file wrapping the rendered HTML as a text object. Real PDF
  // readers will open it as a single-page text document. Good enough to
  // round-trip hashes + signatures under test.
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${html.length + 20} >>
stream
BT /F1 12 Tf 72 720 Td (${html.replace(/[()\\]/g, "")}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
trailer
<< /Size 5 /Root 1 0 R >>
startxref
0
%%EOF
`;
  return Buffer.from(content, "utf8");
}
