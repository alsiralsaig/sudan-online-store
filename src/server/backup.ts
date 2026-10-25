/**
 * نسخة احتياطية يومية لقاعدة سند — على تخزين Blob (مجاني، بلا كارت).
 *
 * ليه: لما القاعدة وقفت بسبب الحصة، ما كان في أي نسخة نقدر نرجّع منها،
 * وضاعت إعلانات وميديا. النسخة دي بتتحفظ يومياً برّه القاعدة نفسها.
 *
 * الشكل: ملف واحد مضغوط (gzip) فيه JSON لكل جدول sanad_*، محفوظ باسم
 * backups/sanad-YYYY-MM-DD-HHMM.json.gz، وبنحتفظ بآخر ٧ نسخ بس.
 *
 * ملاحظات مهمة:
 *  • الميديا ما بتتنقلش هنا — بقت في Blob أصلاً، والنسخة دي للبيانات.
 *  • في حد أقصى للحجم عشان ما نستهلكش الذاكرة (الدالة عندها ٣٠ ثانية).
 *  • لو التخزين مش مضبوط، بترجع رسالة واضحة بدل ما تفشل بصمت.
 */
import { gzipSync } from 'node:zlib';
import { put, list, del } from '@vercel/blob';
import { query } from './pg.ts';
import { storageMode } from './storage.ts';

/** أقصى حجم للنسخة قبل الضغط — القاعدة عندنا أصغر من كده بكتير. */
const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
const KEEP_BACKUPS = 7;

export interface BackupResult {
  ok: boolean;
  skipped?: string;
  url?: string;
  name?: string;
  tables?: number;
  rows?: number;
  bytes?: number;
  pruned?: number;
  error?: string;
}

const stamp = (d: Date) => d.toISOString().replace(/[:T]/g, '-').slice(0, 16);

export function backupName(at = new Date()): string {
  return `backups/sanad-${stamp(at)}.json.gz`;
}

/** يبني محتوى النسخة من جدول بيانات وهمي — يُختبر بدون قاعدة. */
export function buildBackupPayload(
  tables: Record<string, Record<string, unknown>[]>,
  at = new Date()
): { json: string; rows: number } {
  let rows = 0;
  for (const list of Object.values(tables)) rows += list.length;
  return {
    json: JSON.stringify({ tool: 'sanad-backup', version: 1, createdAt: at.toISOString(), rows, tables }),
    rows,
  };
}

export async function runBackup(at = new Date()): Promise<BackupResult> {
  if (storageMode() !== 'blob') {
    return { ok: false, skipped: 'NO_BLOB_STORE', error: 'تخزين Blob غير مربوط — النسخة ما اتحفظتش.' };
  }

  try {
    const { rows: tableRows } = await query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name LIKE 'sanad%'
        ORDER BY table_name`
    );

    const tables: Record<string, Record<string, unknown>[]> = {};
    let bytesSoFar = 0;
    let rowCount = 0;

    for (const { table_name: table } of tableRows) {
      const name = String(table);
      // حد آمن: لو القاعدة كبرت جداً، نوقف ونقول للمستخدم بدل ما نعلّق الدالة.
      const { rows } = await query(`SELECT * FROM "${name}"`);
      tables[name] = rows as Record<string, unknown>[];
      rowCount += rows.length;
      bytesSoFar += JSON.stringify(rows).length;
      if (bytesSoFar > MAX_BACKUP_BYTES) {
        return {
          ok: false,
          error: `البيانات أكبر من ${MAX_BACKUP_BYTES / 1024 / 1024} ميجا — النسخة محتاجة تقسيم.`,
          tables: Object.keys(tables).length,
          rows: rowCount,
        };
      }
    }

    const payload = buildBackupPayload(tables, at);
    const gz = gzipSync(Buffer.from(payload.json, 'utf8'), { level: 9 });
    const name = backupName(at);
    const uploaded = await put(name, gz, {
      access: 'public',
      contentType: 'application/gzip',
      addRandomSuffix: false,
    });

    // نحتفظ بآخر ٧ نسخ فقط — المساحة المجانية محدودة.
    let pruned = 0;
    try {
      const existing = await list({ prefix: 'backups/' });
      const old = existing.blobs
        .filter((b) => b.pathname !== name)
        .sort((a, b) => (a.uploadedAt > b.uploadedAt ? -1 : 1))
        .slice(KEEP_BACKUPS - 1);
      if (old.length) {
        await del(old.map((b) => b.url));
        pruned = old.length;
      }
    } catch {
      /* التنظيف مش حرج — النسخة اتحفظت */
    }

    return {
      ok: true,
      url: uploaded.url,
      name,
      tables: Object.keys(tables).length,
      rows: payload.rows,
      bytes: gz.length,
      pruned,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 200) };
  }
}
