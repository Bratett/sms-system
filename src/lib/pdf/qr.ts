import QRCode from "qrcode";

/**
 * Generates a PNG data URL encoding the given text. Suitable for embedding in
 * @react-pdf/renderer Image components.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}
