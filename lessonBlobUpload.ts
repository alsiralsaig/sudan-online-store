diff --git a/apps/admin/src/lib/lessonBlobUpload.ts b/apps/admin/src/lib/lessonBlobUpload.ts
new file mode 100644
index 0000000..d8383f4
--- /dev/null
+++ b/apps/admin/src/lib/lessonBlobUpload.ts
@@ -0,0 +1,46 @@
+import { put } from '@vercel/blob/client';
+import { getApiBase } from './serverUrl';
+
+const MAX_SIZE = 20 * 1024 * 1024;
+const MIME_BY_EXTENSION: Record<string, string> = {
+  pdf: 'application/pdf', doc: 'application/msword',
+  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
+  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
+  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
+  txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg',
+  png: 'image/png', webp: 'image/webp',
+};
+
+/** Sends a lesson attachment directly from the browser to Blob using a server-issued token. */
+export async function uploadLessonAttachmentBlob(
+  lessonId: string,
+  file: File,
+  onProgress?: (percentage: number) => void,
+): Promise<{ url: string; pathname: string }> {
+  if (file.size < 1 || file.size > MAX_SIZE) throw new Error('حجم الملف يجب ألا يتجاوز ٢٠ ميغابايت');
+  const extension = file.name.split('.').pop()?.toLowerCase() || '';
+  const contentType = MIME_BY_EXTENSION[extension];
+  if (!contentType) throw new Error('نوع الملف غير مدعوم');
+  const safeName = file.name.normalize('NFKD').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-120) || `attachment.${extension}`;
+  const pathname = `lesson-attachments/${lessonId}/${safeName}`;
+  const tokenResponse = await fetch(`${getApiBase()}/api/admin/lessons/${encodeURIComponent(lessonId)}/attachments/client`, {
+    method: 'POST', credentials: 'include',
+    headers: { 'X-App': 'admin', 'Content-Type': 'application/json', Accept: 'application/json' },
+    body: JSON.stringify({
+      type: 'blob.generate-client-token',
+      payload: {
+        pathname,
+        clientPayload: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
+        multipart: false,
+      },
+    }),
+  });
+  const tokenData = await tokenResponse.json().catch(() => null) as { clientToken?: string; error?: string } | null;
+  if (!tokenResponse.ok || !tokenData?.clientToken) throw new Error(tokenData?.error || 'تعذّر إصدار إذن رفع الملف');
+
+  const blob = await put(pathname, file, {
+    access: 'public', token: tokenData.clientToken, contentType,
+    onUploadProgress: ({ percentage }) => onProgress?.(percentage),
+  });
+  return { url: blob.url, pathname: blob.pathname };
+}
diff --git a/apps/admin/src/pages/ContentPage.tsx b/apps/admin/src/pages/ContentPage.tsx
index e6705f2..93d1100 100644
--- a/apps/admin/src/pages/ContentPage.tsx
+++ b/apps/admin/src/pages/ContentPage.tsx
@@ -1,6 +1,6 @@
 import React, { useEffect, useMemo, useState } from 'react';
 import { Link, useNavigate } from 'react-router-dom';
-import { BookOpen, Paperclip, Plus, Search, SquarePen } from 'lucide-react';
+import { BookOpen, FileText, Loader2, Paperclip, Plus, Search, SquarePen } from 'lucide-react';
 import {
   Button,
   Card,
@@ -10,7 +10,8 @@ import {
   StatusBadge,
   Table,
 } from '../components/ui';
-import { api } from '../lib/contentApi';
+import { api, type LessonRecord } from '../lib/contentApi';
+import { uploadLessonAttachmentBlob } from '../lib/lessonBlobUpload';
 import { useSubjects } from '../hooks/useSubjects';
 import { allLessons, CONTENT_STATUS } from '@shared/curriculum';
 
@@ -48,14 +49,79 @@ export const ContentPage: React.FC = () => {
   const [newSummary, setNewSummary] = useState('');
   const [creating, setCreating] = useState(false);
   const [createError, setCreateError] = useState('');
+  const [newAttachment, setNewAttachment] = useState<File | null>(null);
+  const [uploadProgress, setUploadProgress] = useState(0);
+  const [createdLessonId, setCreatedLessonId] = useState('');
+  const [createdBlobUrl, setCreatedBlobUrl] = useState('');
   const availableUnits = subjects?.find((s) => s.id === subjectId)?.units ?? [];
-  const openNewLesson = () => { const first = subjects?.[0]; setSubjectId(first?.id ?? ''); setUnitId(first?.units[0]?.id ?? ''); setNewTitle(''); setNewSummary(''); setCreateError(''); setNewLesson(true); };
+  const openNewLesson = () => { const first = subjects?.[0]; setSubjectId(first?.id ?? ''); setUnitId(first?.units[0]?.id ?? ''); setNewTitle(''); setNewSummary(''); setNewAttachment(null); setUploadProgress(0); setCreatedLessonId(''); setCreatedBlobUrl(''); setCreateError(''); setNewLesson(true); };
+  const waitForLessonAttachment = async (lessonId: string, blobUrl: string): Promise<boolean> => {
+    for (let attempt = 0; attempt < 10; attempt++) {
+      try {
+        const lesson = await api.getLesson(lessonId) as LessonRecord & { attachments?: Array<{ filePath?: string; url?: string }> };
+        if (Array.isArray(lesson.attachments) && lesson.attachments.some((item) => item.filePath === blobUrl || item.url === blobUrl)) return true;
+      } catch { /* نعيد المحاولة؛ callback الخادمي قد يكون ما زال يحفظ السجل */ }
+      await new Promise((resolve) => window.setTimeout(resolve, 500));
+    }
+    return false;
+  };
+  const openCreatedLesson = (id = createdLessonId) => {
+    setNewLesson(false);
+    navigate(`/content/${encodeURIComponent(id)}`);
+  };
   const submitNewLesson = async (e: React.FormEvent<HTMLFormElement>) => {
-    e.preventDefault(); if (creating) return; setCreating(true); setCreateError('');
-    try { const lesson = await api.createLesson({ subjectId, unitId, title: newTitle.trim(), summary: newSummary.trim() }); navigate(`/content/${encodeURIComponent(lesson.id)}`); }
-    catch (e2) { setCreateError(e2 instanceof Error ? e2.message : 'تعذّر إنشاء الدرس'); }
-    finally { setCreating(false); }
+    e.preventDefault();
+    if (creating || createdLessonId) return;
+    setCreating(true); setCreateError(''); setUploadProgress(0);
+    let createdId = '';
+    try {
+      const lesson = await api.createLesson({ subjectId, unitId, title: newTitle.trim(), summary: newSummary.trim() });
+      createdId = lesson.id;
+      setCreatedLessonId(lesson.id);
+      if (newAttachment) {
+        try {
+          const blob = await uploadLessonAttachmentBlob(lesson.id, newAttachment, setUploadProgress);
+          setCreatedBlobUrl(blob.url);
+          if (!await waitForLessonAttachment(lesson.id, blob.url)) {
+            setCreateError('تم إنشاء الدرس ورفع الملف، لكن لم يصل تأكيد حفظ المرفق بعد. استخدم «تحقق من حفظ الملف» ولا ترفع نسخة أخرى الآن.');
+            return;
+          }
+        } catch (uploadError) {
+          setCreateError(`تم إنشاء الدرس، لكن تعذّر إكمال رفع المرفق: ${uploadError instanceof Error ? uploadError.message : 'خطأ غير معروف'}`);
+          return;
+        }
+      }
+      openCreatedLesson(lesson.id);
+    } catch (e2) {
+      if (createdId) {
+        setCreatedLessonId(createdId);
+        setCreateError(e2 instanceof Error ? e2.message : 'تم إنشاء الدرس لكن تعذّر تأكيد اكتمال العملية.');
+      } else {
+        setCreateError(e2 instanceof Error ? e2.message : 'تعذّر إنشاء الدرس');
+      }
+    } finally { setCreating(false); setUploadProgress(0); }
+  };
+  const retryOrVerifyAttachment = async () => {
+    if (!createdLessonId || !newAttachment || creating) return;
+    setCreating(true); setCreateError(''); setUploadProgress(0);
+    try {
+      let blobUrl = createdBlobUrl;
+      if (blobUrl) {
+        // الرفع وصل إلى Blob بالفعل؛ نتحقق من callback فقط لتجنب إنشاء نسخة مكررة.
+        if (await waitForLessonAttachment(createdLessonId, blobUrl)) { openCreatedLesson(); return; }
+        setCreateError('لم يتأكد حفظ المرفق بعد. افتح الدرس وتحقق من قائمة المرفقات قبل محاولة رفع الملف مرة أخرى.');
+        return;
+      }
+      const blob = await uploadLessonAttachmentBlob(createdLessonId, newAttachment, setUploadProgress);
+      blobUrl = blob.url;
+      setCreatedBlobUrl(blobUrl);
+      if (await waitForLessonAttachment(createdLessonId, blobUrl)) { openCreatedLesson(); return; }
+      setCreateError('تم رفع الملف، لكن لم يصل تأكيد حفظ المرفق بعد. اضغط «تحقق من حفظ الملف» لاحقاً، ولا ترفع نسخة أخرى الآن.');
+    } catch (error) {
+      setCreateError(`الدرس محفوظ، لكن تعذّر رفع المرفق: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
+    } finally { setCreating(false); setUploadProgress(0); }
   };
+
   /* الدروس من **قاعدة البيانات** — والملفات المضمّنة ملاذ أخير إن غاب الخادم */
   const [rows, setRows] = useState<LessonRow[]>([]);
   const [loading, setLoading] = useState(true);
@@ -213,15 +279,36 @@ export const ContentPage: React.FC = () => {
           عرض حسب المادة
         </Link>
       </div>
-      {newLesson && <div className="fixed inset-0 z-[100] bg-slate-950/50 p-4 grid place-items-center" dir="rtl"><form onSubmit={submitNewLesson} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 space-y-4">
-        <div className="flex items-center justify-between"><h2 className="font-black text-navy-800">إنشاء درس جديد</h2><button type="button" onClick={() => setNewLesson(false)} className="text-slate-500 px-2 py-1">إغلاق</button></div>
-        <label className="block text-xs font-bold text-slate-600">المادة<select required value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setUnitId(subjects?.find((s) => s.id === e.target.value)?.units[0]?.id ?? ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"><option value="">اختر المادة</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
-        <label className="block text-xs font-bold text-slate-600">الوحدة<select required value={unitId} onChange={(e) => setUnitId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"><option value="">اختر الوحدة</option>{availableUnits.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}</select></label>
-        <label className="block text-xs font-bold text-slate-600">عنوان الدرس<input required minLength={2} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
-        <label className="block text-xs font-bold text-slate-600">ملخص اختياري<textarea rows={3} value={newSummary} onChange={(e) => setNewSummary(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
-        {createError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{createError}</p>}
-        <div className="flex justify-end gap-2"><button type="button" onClick={() => setNewLesson(false)} className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold">إلغاء</button><button type="submit" disabled={creating || !subjectId || !unitId} className="px-4 py-2 rounded-xl bg-navy-800 text-white text-xs font-bold disabled:opacity-50">{creating ? 'جارٍ الإنشاء…' : 'إنشاء وفتح المحرر'}</button></div>
-      </form></div>}
+      {newLesson && <div className="fixed inset-0 z-[100] bg-slate-950/50 p-4 grid place-items-center" dir="rtl">
+        <form onSubmit={submitNewLesson} className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 space-y-4">
+          <div className="flex items-center justify-between"><h2 className="font-black text-navy-800">إنشاء درس جديد</h2><button type="button" disabled={creating} onClick={() => setNewLesson(false)} className="text-slate-500 px-2 py-1 disabled:opacity-50">إغلاق</button></div>
+          {createdLessonId ? <>
+            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-800">
+              تم إنشاء الدرس. {newAttachment ? 'نعالج الآن مرفقه.' : 'يمكنك فتحه وإضافة مرفقات من صفحة تفاصيل الدرس.'}
+            </div>
+            {newAttachment && <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-600"><FileText className="h-4 w-4 shrink-0 text-navy-700" /><span className="min-w-0 truncate">{newAttachment.name}</span><span className="shrink-0 text-slate-400">{(newAttachment.size / (1024 * 1024)).toFixed(1)} MB</span></div>}
+            {createError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{createError}</p>}
+            <div className="flex flex-wrap justify-end gap-2">
+              {newAttachment && <button type="button" onClick={() => void retryOrVerifyAttachment()} disabled={creating} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-800 text-white text-xs font-bold disabled:opacity-50">
+                {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> {createdBlobUrl ? 'جارٍ التحقق…' : `جارٍ الرفع ${Math.round(uploadProgress)}٪…`}</> : createdBlobUrl ? 'تحقق من حفظ الملف' : 'إعادة محاولة رفع الملف'}
+              </button>}
+              <button type="button" onClick={() => openCreatedLesson()} className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold">فتح الدرس</button>
+            </div>
+          </> : <>
+            <label className="block text-xs font-bold text-slate-600">المادة<select required value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setUnitId(subjects?.find((s) => s.id === e.target.value)?.units[0]?.id ?? ''); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"><option value="">اختر المادة</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
+            <label className="block text-xs font-bold text-slate-600">الوحدة<select required value={unitId} onChange={(e) => setUnitId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"><option value="">اختر الوحدة</option>{availableUnits.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}</select></label>
+            <label className="block text-xs font-bold text-slate-600">عنوان الدرس<input required minLength={2} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
+            <label className="block text-xs font-bold text-slate-600">ملخص اختياري<textarea rows={3} value={newSummary} onChange={(e) => setNewSummary(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
+            <label className="block text-xs font-bold text-slate-600">ملف مرفق اختياري
+              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp" disabled={creating} onChange={(e) => { const selected = e.target.files?.[0] ?? null; if (selected && selected.size > 20 * 1024 * 1024) { setNewAttachment(null); setCreateError('حجم الملف أكبر من ٢٠ ميغابايت'); e.target.value = ''; } else { setNewAttachment(selected); setCreateError(''); } }} className="mt-1 block w-full rounded-xl border border-slate-300 p-2 text-xs file:ml-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2" />
+              <span className="mt-1 block text-[10px] font-normal text-slate-400">PDF وWord وExcel وPowerPoint وTXT وCSV والصور؛ حتى ٢٠ ميغابايت.</span>
+            </label>
+            {newAttachment && <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-600"><FileText className="h-4 w-4 shrink-0 text-navy-700" /><span className="min-w-0 truncate">{newAttachment.name}</span><span className="shrink-0 text-slate-400">{(newAttachment.size / (1024 * 1024)).toFixed(1)} MB</span></div>}
+            {createError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{createError}</p>}
+            <div className="flex justify-end gap-2"><button type="button" disabled={creating} onClick={() => setNewLesson(false)} className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold disabled:opacity-50">إلغاء</button><button type="submit" disabled={creating || !subjectId || !unitId} className="px-4 py-2 rounded-xl bg-navy-800 text-white text-xs font-bold disabled:opacity-50">{creating ? newAttachment ? `جارٍ الإنشاء والرفع ${Math.round(uploadProgress)}٪…` : 'جارٍ الإنشاء…' : newAttachment ? 'إنشاء الدرس ورفع الملف' : 'إنشاء وفتح المحرر'}</button></div>
+          </>}
+        </form>
+      </div>}
     </div>
   );
 };
diff --git a/apps/admin/src/pages/LessonDetailPage.tsx b/apps/admin/src/pages/LessonDetailPage.tsx
index f0cf994..d0e3938 100644
--- a/apps/admin/src/pages/LessonDetailPage.tsx
+++ b/apps/admin/src/pages/LessonDetailPage.tsx
@@ -1,10 +1,10 @@
 import React from 'react';
 import { Link, useNavigate, useParams } from 'react-router-dom';
 import { ArrowRight, Clock3, FileText, Pencil, Trash2, Upload } from 'lucide-react';
-import { put } from '@vercel/blob/client';
 import { Badge, Card, EmptyState, ErrorState, LoadingState, NotConnectedNote } from '../components/ui';
 import { api, type LessonRecord } from '../lib/contentApi';
 import { getApiBase } from '../lib/serverUrl';
+import { uploadLessonAttachmentBlob } from '../lib/lessonBlobUpload';
 
 interface LessonFile { id?: string; title?: string; name?: string; url?: string; path?: string; filePath?: string; type?: string; fileType?: string; fileSize?: string }
 type FullLesson = LessonRecord & { attachments: LessonFile[] };
@@ -36,41 +36,9 @@ export const LessonDetailPage: React.FC = () => {
   const uploadAttachment = async (file?: File) => {
     if (fileInput.current) fileInput.current.value = '';
     if (!file || !lesson || uploading) return;
-    if (file.size > 20 * 1024 * 1024) { setError('حجم الملف يتجاوز الحد الأقصى 20 ميغابايت'); return; }
     setUploading(true); setUploadProgress(0); setError('');
     try {
-      const extension = file.name.split('.').pop()?.toLowerCase() || '';
-      const mimeByExtension: Record<string, string> = {
-        pdf: 'application/pdf', doc: 'application/msword',
-        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
-        xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
-        ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
-        txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg',
-        png: 'image/png', webp: 'image/webp',
-      };
-      const safeName = file.name.normalize('NFKD').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-120) || `attachment.${extension}`;
-      const pathname = `lesson-attachments/${lesson.id}/${safeName}`;
-      const tokenResponse = await fetch(`${getApiBase()}/api/admin/lessons/${encodeURIComponent(lesson.id)}/attachments/client`, {
-        method: 'POST', credentials: 'include',
-        headers: { 'X-App': 'admin', 'Content-Type': 'application/json', Accept: 'application/json' },
-        body: JSON.stringify({
-          type: 'blob.generate-client-token',
-          payload: {
-            pathname,
-            clientPayload: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
-            multipart: false,
-          },
-        }),
-      });
-      const tokenData = await tokenResponse.json().catch(() => null) as { clientToken?: string; error?: string } | null;
-      if (!tokenResponse.ok || !tokenData?.clientToken) throw new Error(tokenData?.error || 'تعذّر إصدار إذن رفع الملف');
-
-      const blob = await put(pathname, file, {
-        access: 'public', token: tokenData.clientToken,
-        contentType: mimeByExtension[extension] || file.type,
-        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
-      });
-
+      const blob = await uploadLessonAttachmentBlob(lesson.id, file, setUploadProgress);
       // سجل المرفق يكتبه callback الخادمي بعد إتمام الرفع؛ ننتظره قبل تأكيد النجاح.
       let saved = false;
       for (let attempt = 0; attempt < 10; attempt++) {
