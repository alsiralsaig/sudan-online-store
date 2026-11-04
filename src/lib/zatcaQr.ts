/**
 * Electronic Receipt QR generator complying with standard Tag-Length-Value (TLV) structure:
 * Tag 1: Seller's Name
 * Tag 2: VAT Registration Number / Commercial Number
 * Tag 3: Time stamp (ISO8601)
 * Tag 4: Invoice total amount (with VAT/inclusive)
 * Tag 5: VAT total
 *
 * ملاحظة: كان `generateQrSvg` سابقاً يرسم نمطاً عشوائياً من hash النص (ليس رمز QR حقيقياً)
 * فلا يستطيع أي ماسح قراءته. هذا الإصدار يولّد رمز QR حقيقياً (ISO/IEC 18004، وضع Byte،
 * تصحيح أخطاء L، أقنعة وعقوبات قياسية) بدون أي مكتبة خارجية.
 */

const encoder = new TextEncoder();

/** يقصّ النص بحيث لا يتجاوز maxBytes بايت UTF-8 دون كسر حرف في المنتصف. */
function clipUtf8(value: string, maxBytes: number): Uint8Array {
  let out = '';
  let used = 0;
  for (const ch of value) {
    const n = encoder.encode(ch).length;
    if (used + n > maxBytes) break;
    out += ch;
    used += n;
  }
  return encoder.encode(out);
}

/** أسماء الحقول كما تظهر للتاجر في رسالة التنبيه. */
const TLV_FIELD_NAMES: Record<number, string> = {
  1: 'اسم المتجر',
  2: 'الرقم الضريبي',
  3: 'تاريخ الفاتورة',
  4: 'الإجمالي مع الضريبة',
  5: 'ضريبة القيمة المضافة',
};

/**
 * الحقول التي يتجاوز طولها 255 بايت فتُقصّ.
 * حقل الطول في TLV بايت واحد، فالقصّ ضرورة فنية لا خيار — لكن الصمت عنها
 * كان يعني رمزاً لا يطابق الفاتورة. نُبلّغ المستدعي ليُنبّه التاجر.
 */
export function zatcaOverlongFields(params: Record<string, string | undefined>): string[] {
  const map: Array<[number, string | undefined]> = [
    [1, params.sellerName], [2, params.taxNumber], [3, params.timestamp],
    [4, params.totalWithVat], [5, params.vatTotal],
  ];
  return map
    .filter(([, v]) => encoder.encode(String(v ?? '')).length > 255)
    .map(([tag]) => TLV_FIELD_NAMES[tag] || `حقل ${tag}`);
}

const warnedOverlong = new Set<string>();

function toTLV(tag: number, value: string): Uint8Array {
  // حقل الطول بايت واحد في TLV؛ أي قيمة أطول من 255 بايت كانت تُنتج QR تالفاً بصمت.
  const raw = String(value ?? '');
  if (encoder.encode(raw).length > 255) {
    const name = TLV_FIELD_NAMES[tag] || `حقل ${tag}`;
    if (!warnedOverlong.has(name)) {
      warnedOverlong.add(name);
      console.warn(`[zatca] «${name}» أطول من 255 بايت فسيُقصّ داخل رمز QR. اختصر القيمة ليطابق الرمز الفاتورة.`);
    }
  }
  const valueBytes = clipUtf8(raw, 255);
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
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
  const parts = [
    toTLV(1, params.sellerName),
    toTLV(2, params.taxNumber),
    toTLV(3, params.timestamp),
    toTLV(4, params.totalWithVat),
    toTLV(5, params.vatTotal),
  ];
  const combined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    combined.set(p, offset);
    offset += p.length;
  }
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

/* ------------------------------------------------------------------ */
/*  QR Code (byte mode, ECC level L)                                   */
/* ------------------------------------------------------------------ */

// فهرس 0 = L, 1 = M, 2 = Q, 3 = H ؛ فهرس الإصدار يبدأ من 1.
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver: number, ecl: number): number {
  return (
    Math.floor(numRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
  );
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}

function addEccAndInterleave(data: number[], ver: number, ecl: number): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  const div = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

const getBit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

/** يبني مصفوفة وحدات QR (true = أسود) للنص المعطى بترميز UTF-8. */
export function qrMatrix(text: string, ecl = 0): boolean[][] {
  const bytes = Array.from(encoder.encode(text));

  // 1) اختيار أصغر إصدار يتسع للبيانات
  let ver = 1;
  for (; ; ver++) {
    if (ver > 40) throw new Error('QR: البيانات أكبر من سعة الرمز');
    const countBits = ver <= 9 ? 8 : 16;
    const capacityBits = numDataCodewords(ver, ecl) * 8;
    if (4 + countBits + bytes.length * 8 <= capacityBits) break;
  }

  // 2) ترميز البيانات
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacityBits = numDataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);
  const dataCodewords: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((b, i) => {
    dataCodewords[i >>> 3] |= b << (7 - (i & 7));
  });
  const allCodewords = addEccAndInterleave(dataCodewords, ver, ecl);

  // 3) رسم الأنماط الوظيفية
  const size = ver * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  const alignment = (cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  };
  const drawFormatBits = (mask: number) => {
    const data = (FORMAT_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFn(8, i, getBit(fb, i));
    setFn(8, 7, getBit(fb, 6));
    setFn(8, 8, getBit(fb, 7));
    setFn(7, 8, getBit(fb, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, getBit(fb, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, getBit(fb, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, getBit(fb, i));
    setFn(8, size - 8, true);
  };

  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const alignPos: number[] = [];
  if (ver > 1) {
    const numAlign = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    alignPos.push(6);
    for (let pos = size - 7; alignPos.length < numAlign; pos -= step) alignPos.splice(1, 0, pos);
  }
  const na = alignPos.length;
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      alignment(alignPos[i], alignPos[j]);
    }
  }
  drawFormatBits(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vb = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const color = getBit(vb, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, color);
      setFn(b, a, color);
    }
  }

  // 4) وضع الكلمات الرمزية (zigzag)
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIdx < allCodewords.length * 8) {
          modules[y][x] = getBit(allCodewords[bitIdx >>> 3], 7 - (bitIdx & 7));
          bitIdx++;
        }
      }
    }
  }

  // 5) اختيار القناع الأقل عقوبة
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!isFunction[y][x] && invert) modules[y][x] = !modules[y][x];
      }
    }
  };

  const penalty = (): number => {
    let result = 0;
    const line = (get: (i: number) => boolean) => {
      let run = 1;
      for (let i = 1; i < size; i++) {
        if (get(i) === get(i - 1)) {
          run++;
          if (run === 5) result += 3;
          else if (run > 5) result++;
        } else run = 1;
      }
      // نمط الباحث الكاذب 1011101 محاطاً بأربع وحدات فاتحة
      for (let i = 0; i + 11 <= size; i++) {
        const p = (k: number) => (get(i + k) ? 1 : 0);
        const a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
        const b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
        let ma = true;
        let mb = true;
        for (let k = 0; k < 11; k++) {
          if (p(k) !== a[k]) ma = false;
          if (p(k) !== b[k]) mb = false;
        }
        if (ma) result += 40;
        if (mb) result += 40;
      }
    };
    for (let y = 0; y < size; y++) line((i) => modules[y][i]);
    for (let x = 0; x < size; x++) line((i) => modules[i][x]);
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
      }
    }
    let dark = 0;
    for (const row of modules) for (const m of row) if (m) dark++;
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  };

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormatBits(mask);
    const p = penalty();
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = mask;
    }
    applyMask(mask); // إلغاء القناع
  }
  applyMask(bestMask);
  drawFormatBits(bestMask);
  return modules;
}

/**
 * يرسم رمز QR حقيقياً كـ SVG (منطقة هادئة 4 وحدات، مسار واحد مدمج).
 * `size` هو عرض/ارتفاع الـ SVG بالبكسل.
 */
export function generateQrSvg(data: string, size = 120): string {
  const matrix = qrMatrix(data, 0);
  const n = matrix.length;
  const quiet = 4;
  const total = n + quiet * 2;
  let d = '';
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!matrix[y][x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < n && matrix[y][end]) end++;
      d += `M${x + quiet} ${y + quiet}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>`;
}
