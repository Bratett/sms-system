import { PDFDocument } from "pdf-lib";

/**
 * Fetches each URL, parses as PDF, and stitches all pages into a single PDF buffer.
 *
 * Each fetch has a 30-second abort timeout to prevent a hung R2 signed URL from
 * stalling the whole batch. Non-2xx responses and parse errors are rethrown with
 * the failing URL attached so the caller (worker / action) can log which item
 * broke the batch.
 */
export async function stitchPdfsFromUrls(urls: string[]): Promise<Buffer> {
  const stitched = await PDFDocument.create();
  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!resp.ok) {
        throw new Error(`Fetch failed ${resp.status} ${resp.statusText}`);
      }
      const doc = await PDFDocument.load(await resp.arrayBuffer());
      const pages = await stitched.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => stitched.addPage(p));
    } catch (err) {
      throw new Error(`stitchPdfsFromUrls: failed for ${url}: ${String(err)}`);
    }
  }
  return Buffer.from(await stitched.save());
}
