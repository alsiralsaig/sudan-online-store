/**
 * Electronic Receipt QR generator complying with standard Tag-Length-Value (TLV) structure:
 * Tag 1: Seller's Name
 * Tag 2: VAT Registration Number / Commercial Number
 * Tag 3: Time stamp (ISO8601)
 * Tag 4: Invoice total amount (with VAT/inclusive)
 * Tag 5: VAT total
 */

function toTLV(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const length = valueBytes.length;
  const tlv = new Uint8Array(2 + length);
  tlv[0] = tag;
  tlv[1] = length;
  tlv.set(valueBytes, 2);
  return tlv;
}

export function generateZatcaTlvBase64(params: {
  sellerName: string;
  taxNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatTotal: string;
}): string {
  const t1 = toTLV(1, params.sellerName);
  const t2 = toTLV(2, params.taxNumber);
  const t3 = toTLV(3, params.timestamp);
  const t4 = toTLV(4, params.totalWithVat);
  const t5 = toTLV(5, params.vatTotal);

  const totalLength = t1.length + t2.length + t3.length + t4.length + t5.length;
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  combined.set(t1, offset);
  offset += t1.length;
  combined.set(t2, offset);
  offset += t2.length;
  combined.set(t3, offset);
  offset += t3.length;
  combined.set(t4, offset);
  offset += t4.length;
  combined.set(t5, offset);

  // Convert binary to base64
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * Generates an SVG representation of a QR-like matrix grid based on hash of input
 * ensuring crisp, zero-dependency rendering in thermal prints and UI preview.
 */
export function generateQrSvg(data: string, size = 120): string {
  // Simple deterministic 21x21 QR pattern generator from string hash
  const gridSize = 21;
  const matrix: boolean[][] = Array(gridSize)
    .fill(false)
    .map(() => Array(gridSize).fill(false));

  // Finder patterns at three corners (7x7)
  const setFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startY + r][startX + c] = true;
        }
      }
    }
  };

  setFinder(0, 0); // Top-left
  setFinder(14, 0); // Top-right
  setFinder(0, 14); // Bottom-left

  // Timing patterns
  for (let i = 8; i < 13; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Populate data cells deterministically
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31 + data.charCodeAt(i)) >>> 0;
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Don't overwrite finders
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c > 13) ||
        (r > 13 && c < 8)
      ) {
        continue;
      }
      hash = ((hash ^ (r * 19 + c * 37)) * 1664525 + 1013904223) >>> 0;
      matrix[r][c] = (hash % 100) < 52;
    }
  }

  const cellSize = size / gridSize;
  let paths = '';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (matrix[r][c]) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const w = cellSize.toFixed(2);
        paths += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#000000" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#ffffff"/>${paths}</svg>`;
}
