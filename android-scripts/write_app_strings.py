"""يكتب اسم التطبيق العربي في res/values/strings.xml بترميز UTF-8.

سبب الوجود: تمرير الاسم عبر `gradle -P...` أو `resValue` كان يفسد الحروف
العربية (تظهر «ÙØ§Ø´ÙŠØ± Ø³Ù†Ø¯» على الشاشة الرئيسية) لأن ترميز سطر الأوامر
ليس UTF-8. الكتابة المباشرة في الملف تحل المشكلة نهائياً.
"""
import sys
from pathlib import Path

label = sys.argv[1]
package_id = sys.argv[2]
res = Path(__file__).resolve().parent.parent / 'android' / 'app' / 'src' / 'main' / 'res' / 'values'
res.mkdir(parents=True, exist_ok=True)

xml = f'''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">{label}</string>
    <string name="title_activity_main">{label}</string>
    <string name="package_name">{package_id}</string>
    <string name="custom_url_scheme">{package_id}</string>
</resources>
'''
(res / 'strings.xml').write_text(xml, encoding='utf-8')
print('strings.xml:', label, '|', package_id)
