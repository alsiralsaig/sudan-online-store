/**
 * Electronic receipt QR — real ISO/IEC 18004 QR codes via the `qrcode`
 * library, plus ZATCA-style TLV (Tag-Length-Value) base64 encoding.
 *
 * TLV fields:
 *   1: Seller name
 *   2: VAT / commercial registration number
 *   3: Timestamp (ISO 8601)
 *   4: Invoice total (VAT inclusive)
 *   5: VAT total
 *
 * NOTE: a scannable QR is NOT a tax-authority certification. The UI must not
 * label it "معتمد" unless an actual certification integration exists.
 */
import QRCode from 'qrcode';

const encoder = new TextEncoder();

/** Maximum bytes a single TLV field may carry (length is one byte). */
export const TLV_MAX_FIELD_BYTES = 255;

export class TlvFieldTooLongError extends Error {
  constructor(tag: number, bytes: number) {
    super(`TLV field ${tag} is ${bytes} bytes; maximum is ${TLV_MAX_FIELD_BYTES}. Shorten the value (e.g. use the store's short trade name).`);
    this.name = 'TlvFieldTooLongError';
  }
}

function toTLV(tag: number, value: string): Uint8Array {
  const valueBytes = encoder.encode(value);
  if (valueBytes.length > TLV_MAX_FIELD_BYTES) {
    throw new TlvFieldTooLongError(tag, valueBytes.length);
  }
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
  tlv.set(valueBytes, 2);
  return tlv;
}

export interface ZatcaTlvParams {
  sellerName: string;
  taxNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatTotal: string;
}

export function generateZatcaTlvBase64(params: ZatcaTlvParams): string {
  const parts = [
    toTLV(1, params.sellerName),
    toTLV(2, params.taxNumber),
    toTLV(3, params.timestamp),
    toTLV(4, params.totalWithVat),
    toTLV(5, params.vatTotal),
  ];
  const totalLength = parts.reduce((s, p) => s + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    combined.set(p, offset);
    offset += p.length;
  }
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

/**
 * Safe variant for receipt rendering: if a field is too long, returns null so
 * the caller can hide the QR and show a warning instead of printing a broken
 * or silently-truncated code.
 */
export function generateZatcaTlvBase64Safe(params: ZatcaTlvParams): string | null {
  try {
    return generateZatcaTlvBase64(params);
  } catch (err) {
    if (err instanceof TlvFieldTooLongError) {
      console.warn('[QR]', err.message);
      return null;
    }
    throw err;
  }
}

/**
 * Generate a real, scannable QR code as an SVG string (synchronous).
 * Uses error-correction level M and a 4-module quiet zone.
 */
export function generateQrSvg(data: string, size = 120): string {
  const qr = QRCode.create(data, { errorCorrectionLevel: 'M' });
  const modules = qr.modules;
  const n = modules.size;
  const quiet = 4;
  const cells = n + quiet * 2;
  const cellSize = size / cells;

  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules.get(r, c)) {
        const x = ((c + quiet) * cellSize).toFixed(3);
        const y = ((r + quiet) * cellSize).toFixed(3);
        path += `M${x} ${y}h${cellSize.toFixed(3)}v${cellSize.toFixed(3)}h-${cellSize.toFixed(3)}z`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}
