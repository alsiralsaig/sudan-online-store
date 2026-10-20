/**
 * Database migration + seed.
 *
 *   npm run db:migrate
 *
 * Requires DATABASE_URL. Creates all 26 tables and indexes, then seeds the
 * initial Sanad dataset if the database is empty. Safe to run repeatedly.
 */
import { db } from '../src/server/db.ts';
import { isDbEnabled, closePool } from '../src/server/pg.ts';

if (!isDbEnabled()) {
  console.error(`
✖ DATABASE_URL غير معرّف.

انسخ رابط الاتصال من Neon:
  Neon Console → Project → Connection Details → Connection string
ثم أنشئ ملف .env في جذر المشروع:

  DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

وأعد تشغيل: npm run db:migrate
`);
  process.exit(1);
}

console.log('→ الاتصال بقاعدة البيانات...');
await db.init();

const schema = db.getSchema() as unknown as Record<string, any[]>;
console.log('\n✓ الجداول جاهزة. عدد الصفوف:');
for (const [collection, rows] of Object.entries(schema)) {
  console.log(`   ${collection.padEnd(24)} ${String(rows.length).padStart(5)}`);
}

await db.shutdown();
console.log('\n✓ انتهى الترحيل بنجاح.');
process.exit(0);
