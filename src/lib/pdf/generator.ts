import { renderToBuffer } from "@react-pdf/renderer";

/**
 * Renders a React PDF component to a Node.js Buffer.
 *
 * Usage:
 *   const buffer = await renderPdfToBuffer(<ReportCard {...props} />);
 *   // Return as response, save to disk, upload to storage, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function renderPdfToBuffer(component: any): Promise<Buffer> {
  const stream = await renderToBuffer(component);
  return stream as Buffer;
}
