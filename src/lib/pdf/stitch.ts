import { PDFDocument } from "pdf-lib";

/**
 * Fetches each URL, parses as PDF, and stitches all pages into a single PDF buffer.
 */
export async function stitchPdfsFromUrls(urls: string[]): Promise<Buffer> {
  const stitched = await PDFDocument.create();
  for (const url of urls) {
    const resp = await fetch(url);
    const doc = await PDFDocument.load(await resp.arrayBuffer());
    const pages = await stitched.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => stitched.addPage(p));
  }
  return Buffer.from(await stitched.save());
}
