# PMV2 PATCH MANIFEST

## Patch

`PMV2_PATCH_001_documentation_integration_decisions`

## النوع

Documentation-only patch.

## الهدف

توثيق قرارات التكامل التي تم اعتمادها بعد فحص النسخة الحالية من المشروع، بدون أي تعديل كود أو Workflow أو قاعدة بيانات.

## القرارات الموثقة

1. الصرف من مخزن الفريق الفرعي يستخدم نفس آلية المخزون/المستودع الحالية بكل متطلباتها، بما فيها QR/Lot Tracking عند انطباقها.
2. PM V2 لا تخصم المخزون مباشرة، بل تحفظ مرجع حركة النظام الحالي.
3. عند عدم توفر المادة، يبدأ المستودع طلب الشراء الخارجي من PM V2.
4. PM V2 تنشئ/تربط بلاغ الجسر المطلوب لـ Path B وتحافظ على الربط بالمهمة الأصلية.
5. سلسلة الربط: `Task → Task Item → Material Request → Bridge Ticket/Item → Purchase Order`.
6. لا تضاف صلاحية إنشاء Purchase Order لدور `warehouse` داخل Path B؛ يكمل الـPO المستخدم المخول أصلًا حسب صلاحيات Path B الحالية.
7. أي تغيير مستقبلي على قاعدة البيانات ينفذ يدويًا بواسطة المستخدم، أمرًا خطوة بخطوة، وبعد كل نتيجة يتم الانتقال للأمر التالي.
8. عند أي تغيير Schema يجب تحديث ملف الـSchema وتسليمه للمستخدم للاستبدال.

## الملفات المعدلة

- `docs/pmv2/README.md`
- `docs/pmv2/00_WORKING_RULES.md`
- `docs/pmv2/01_PLAN.md`
- `docs/pmv2/02_ARCHITECTURE.md`
- `docs/pmv2/03_DATABASE.md`
- `docs/pmv2/04_WORKFLOWS.md`
- `docs/pmv2/05_SCREENS.md`
- `docs/pmv2/06_IMPLEMENTATION_STATUS.md`
- `docs/pmv2/08_DECISIONS.md`
- `docs/pmv2/10_RELEASE_NOTES.md`
- `docs/pmv2/REFERENCE_FULL_TECHNICAL_DESIGN.md`

## ملف جديد

- `docs/pmv2/PATCH_MANIFEST.md`

## الملفات المحذوفة

لا يوجد.

## تغييرات الكود

لا يوجد.

## Migration / Database

لا يوجد أي Migration أو أمر قاعدة بيانات في هذه الحزمة.

## خطوات التطبيق

فك الحزمة في Root المشروع واستبدال الملفات الموجودة بنفس المسارات.

## التحقق

- التأكد أن `06_IMPLEMENTATION_STATUS.md` ما زال يذكر أن تنفيذ الكود لم يبدأ.
- التأكد أن القرارات DEC-019 إلى DEC-022 موجودة في `08_DECISIONS.md`.
- التأكد أن لا توجد ملفات خارج `docs/pmv2/` داخل الحزمة.

## Rollback

استرجاع النسخ السابقة من ملفات التوثيق فقط. لا يوجد أثر على الكود أو قاعدة البيانات.
