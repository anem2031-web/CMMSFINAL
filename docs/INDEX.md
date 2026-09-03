# فهرس المشروع — نظام إدارة الصيانة (CMMS)

> تم تنظيم المشروع حسب **المجال الوظيفي (Domain)**: كل جزء يخدم نفس الهدف التجاري/الوظيفي مجمّع في مكان واحد، في الواجهة والخادم معاً.
> آخر تحديث للتوثيق: 2026-09-02

---

## 1) الخريطة العامة

| المسار | الوصف |
|---|---|
| `client/` | تطبيق الواجهة (React + Vite + Tailwind + tRPC client) |
| `server/` | الخادم (tRPC + Drizzle ORM + MySQL) |
| `shared/` | أنواع وثوابت مشتركة بين الواجهة والخادم (`@shared/*`) |
| `drizzle/` | مخطط قاعدة البيانات (`schema.ts`) وملفات الترحيل SQL |
| `scripts/` | سكربتات الصيانة والترحيل والتهيئة (seed) |
| `scanner-helper/` | أداة مساعدة سطح المكتب للماسح الضوئي |
| `docs/` | الوثائق والتقارير والأرشيف (هذا الملف هنا) |
| `.github/workflows/` | خطوط CI (فحص الأنواع + البناء) |

**أسماء الاستيراد (Aliases):** `@/*` → `client/src/*` — `@shared/*` → `shared/*`

---

## 2) المجالات الوظيفية (Domains)

كل مجال له — حيثما ينطبق — راوتر في الخادم، وصفحات ومكوّنات في الواجهة:

| المجال | الوصف | راوترات الخادم | صفحات الواجهة | مكوّنات الواجهة |
|---|---|---|---|---|
| **auth** | المصادقة والجلسات | `server/routers/auth/` | `pages/auth/` (Login) | `components/auth/` |
| **users** | إدارة المستخدمين والأدوار | `server/routers/users/` | `pages/admin/Users` | — |
| **tickets** | البلاغات/الصيانة التصحيحية ودورة عملها | `server/routers/tickets/` | `pages/tickets/` | `components/tickets/` (SLATimer, TechnicianCombobox) |
| **preventive** | الصيانة الوقائية (خطط PM وتنفيذها) | `server/routers/system/preventive.router.ts` | `pages/preventive/` | `components/preventive/` (BranchTree) |
| **assets** | الأصول: سجل، تصنيفات، تاريخ، NFC/مسح | `server/routers/assets/` | `pages/assets/` | — |
| **inventory** | المخزون والمستودعات: استلام، إرجاع، جرد، تحويلات | `server/routers/inventory/` | `pages/inventory/` | `components/inventory/` |
| **purchase** | المشتريات: أوامر الشراء، الموافقات، المورّدون | `server/routers/purchase/` | `pages/purchase/` | — |
| **catalog** | كتالوج الأصناف والوحدات والتصنيفات والمورّدين | `server/routers/catalog/` | `pages/catalog/` | `components/catalog/` |
| **construction** | مشاريع الإنشاءات: مراحل، مهام، Gantt/Kanban | `server/routers/construction/` | `pages/construction/` | `components/construction/` |
| **reports** | التقارير والتحليلات (تكلفة، دورات، أقسام…) | `server/routers/reports/` | `pages/reports/` | — |
| **notifications** | الإشعارات وWeb Push | `server/routers/notifications/` | `pages/admin/Notifications` | — |
| **ai** | المساعد الذكي، الصور، الصوت، LLM | `server/routers/ai/` | `pages/ai/` | `components/ai/` (AIChatBox) |
| **translation** | نظام الترجمة الآلية للمحتوى | `server/routers/translation/` | `pages/admin/TranslationMonitor` | — |
| **improvement** | مركز التحسين والتطوير (الأفكار) | `server/routers/improvement-ideas/` | `pages/improvement/` | — |
| **sites / sections / technicians** | المواقع والأقسام والفنيون | `server/routers/{sites,sections,technicians}/` | `pages/admin/` | — |
| **system** | لوحة التحكم، KPI، التدقيق، النسخ الاحتياطي | `server/routers/system/` | `pages/dashboard/`, `pages/admin/` | `components/dashboard/` |
| **uploads** | رفع الملفات والمرفقات | `server/routers/uploads/` | — | `components/common/DropZone` |

---

## 3) بنية الخادم `server/`

```
server/
├── _core/                  # البنية التحتية المشتركة (ليست مجالاً وظيفياً)
│   ├── index.ts            # نقطة تشغيل الخادم (Express + tRPC + مسارات PDF)
│   ├── db/                 # طبقة الوصول لقاعدة البيانات — مقسّمة حسب المجال:
│   │   ├── index.ts        #   نقطة التجميع (كل استيرادات ../_core/db القديمة تعمل كما هي)
│   │   ├── client.ts       #   الاتصال (Pool) + withTransaction + resetDb
│   │   ├── users.ts        #   المستخدمون + المصادقة الثنائية (2FA)
│   │   ├── org.ts          #   المواقع والأقسام والفنيون
│   │   ├── tickets.ts      #   البلاغات وسجل حالاتها وتأكيداتها
│   │   ├── purchase.ts     #   أوامر الشراء وبنودها ودفعات التسعير
│   │   ├── inventory.ts    #   المخزون والبحث بالباركود
│   │   ├── warehouse-receipts.ts / warehouse-returns.ts / invoice-drafts.ts
│   │   ├── assets.ts       #   الأصول: السجل، RFID، الفحوص، الفئات، المؤشرات
│   │   ├── preventive.ts   #   خطط PM والشجرة وأوامر العمل
│   │   ├── notifications.ts / audit.ts / reports.ts / attachments.ts
│   │   └── deletes.ts / backups.ts
│   ├── storage.ts          # التخزين السحابي للملفات (S3-متوافق)
│   ├── trpc.ts / context.ts / systemRouter.ts
│   ├── cache.ts / rateLimiter.ts / cookies.ts / env.ts / config.ts
│   ├── llm.ts / imageGeneration.ts / voiceTranscription.ts / map.ts
│   ├── oauth.ts / twoFactor.ts / twoFactorEnforcement.ts
│   └── notification.ts / sdk.ts / dataApi.ts / vite.ts
│
├── routers/                # واجهات tRPC مقسّمة حسب المجال
│   ├── index.ts            # تجميع كل الراوترات في appRouter
│   ├── _shared/            # middleware، صلاحيات، إجراءات، validators مشتركة
│   ├── auth/  users/  sites/  sections/  technicians/
│   ├── tickets/            # مقسّم داخلياً: workflow, approvals, closure, external…
│   ├── assets/             # assets, categories, history, documents, nfc, inspection
│   ├── inventory/          # stock, receipts(+v2), returns, transfers, disposal, count…
│   ├── purchase/           # purchase-orders, approvals, vendors, delivery-documents
│   ├── catalog/            # catalog.router + catalogImportExport.router
│   ├── construction/       # projects, phases, tasks, activities…
│   ├── reports/            # analytics + تقارير الصيانة/الشراء/المخزون
│   ├── notifications/  uploads/  ai/  translation/
│   ├── improvement-ideas/
│   └── system/             # dashboard, kpi, audit, backups, preventive
│
├── services/               # منطق الأعمال المعقد حسب المجال
│   ├── pdf/                # توليد PDF: تذاكر، أوامر عمل PM، سير العمل + محرك HTML→PDF
│   ├── export/             # exportService: تصدير البيانات (Excel/ملفات)
│   ├── translation/        # translationEngine + خدمة الترجمة
│   ├── notifications/      # webPush: إشعارات المتصفح
│   ├── catalog/            # استيراد/تصدير/تحقق الكتالوج
│   ├── ocr/                # OCR للفواتير
│   └── improvement-ideas/  # وصول قاعدة بيانات مركز التحسين
│
├── jobs/                   # المهام المجدولة (cron): pm-automation, sla-overdue-push…
├── tests/                  # كل اختبارات Vitest (كانت مبعثرة في جذر server/)
└── fonts/                  # خطوط توليد PDF
```

## 4) بنية الواجهة `client/src/`

```
client/src/
├── main.tsx / App.tsx      # نقطة الدخول + تعريف المسارات (wouter)
├── pages/                  # الصفحات حسب المجال
│   ├── auth/  dashboard/  tickets/  preventive/  assets/
│   ├── inventory/  purchase/  catalog/  construction/
│   ├── reports/  improvement/  ai/  admin/  dev/
│   └── NotFound.tsx        # صفحة 404 العامة
├── components/
│   ├── ui/                 # مكتبة shadcn/ui الأساسية (أزرار، جداول، نوافذ…)
│   ├── layout/             # DashboardLayout + الهيكل العام
│   ├── common/             # مكوّنات عامة: ErrorBoundary, Map, DropZone, BarcodeScanner…
│   └── {domain}/           # مكوّنات خاصة بكل مجال (catalog, construction, tickets…)
├── hooks/  _core/hooks/    # الخطافات المشتركة (useAuth, usePushNotifications…)
├── contexts/               # اللغة والثيم
├── i18n/                   # الترجمات: ar / en / ur
├── lib/                    # trpc client + أدوات مساعدة
└── types/                  # تعريفات أنواع إضافية
```

## 5) قاعدة البيانات والوثائق والسكربتات

- **المخطط:** `drizzle/schema.ts` (+ `schema.additions.ts`, `relations.ts`) — **الترحيلات:** `drizzle/00xx_*.sql` — التطبيق: `pnpm db:push`
- **الوثائق:** `docs/ARCHITECTURE.md` (المعمارية)، `docs/ROLLBACK.md`، `docs/INVENTORY_ROADMAP.md`، `docs/todo.md`، تقارير المراحل في `docs/reports/`، ملفات قديمة/مهملة في `docs/archive/`
- **السكربتات:** `scripts/` — تهيئة المدير (`seed-admin.mjs` القياسي، و`seed-admin.env.mjs` النسخة الآمنة بمتغير بيئة `ADMIN_SEED_PASSWORD`)، بذر البيانات `seed-db.mjs`، وسكربتات ترحيل/تحقق FK

## 6) أوامر التشغيل

| الأمر | الوظيفة |
|---|---|
| `pnpm dev` | تشغيل التطوير (خادم + واجهة) |
| `pnpm build` | بناء الإنتاج (vite + esbuild → `dist/`) |
| `pnpm start` | تشغيل نسخة الإنتاج |
| `pnpm check` | فحص أنواع TypeScript |
| `pnpm test` | تشغيل الاختبارات (`server/tests/`) |
| `pnpm db:push` | توليد وتطبيق ترحيلات قاعدة البيانات |

## 7) ملاحظات إعادة الهيكلة (2026-07-12)

- نُقلت 115 ملفاً وحُدّثت الاستيرادات في 130 ملفاً آلياً؛ تم التحقق ببناء كامل ناجح (`pnpm build`) ومقارنة أخطاء `tsc` مع النسخة الأصلية (لا أخطاء استيراد جديدة).
- `server/routers.ts.backup.ts` القديم نُقل إلى `docs/archive/` (كان يضيف 36 خطأ نوع للفحص).
- خطأ `server/_core/sdk.ts → ./types/manusTypes` **موجود قبل إعادة الهيكلة** (ملف مفقود أصلاً) ولم يُعالج.
- أخطاء الأنواع المتبقية في `pnpm check` (نحو 160) كلها موجودة في النسخة الأصلية وليست ناتجة عن النقل.

## 8) تقسيم طبقة قاعدة البيانات (2026-07-13)

- `server/_core/db.ts` (4714 سطراً، 233 دالة) قُسّم إلى **17 وحدة مجالية** داخل `server/_core/db/`.
- التوافق الخلفي كامل: `db/index.ts` يعيد تصدير كل شيء، فكل الملفات المستهلكة (55+ بنمط `import * as db` و19 بنمط `getDb`) تعمل **بدون أي تعديل**.
- الاعتماديات المتقاطعة بين الوحدات (9 معرّفات مثل `getDb` و`withTransaction` و`buildTicketsWhere`) حُوّلت لاستيرادات صريحة بين الوحدات.
- تم التحقق: بناء إنتاج ناجح + مقارنة أخطاء `tsc` قبل/بعد (لا فرق حقيقي).

## 9) توثيق تحديث 2026-08-03 — المسار A وطلبات الشراء

- `docs/TICKET_ARCHIVE_REASSIGNMENT_INBOX_CHANGES.md` — السلوك التشغيلي وتكامل واجهة البلاغات.
- `docs/TEST_REPORT_PATH_A_PURCHASE_ORDER_GUARD.md` — تغطية واختبارات منع طلب شراء جديد في المسار A.

## 10) توثيق تحديث 2026-08-03 — بوابة بدء الإصلاح للمسار A

- `docs/TEST_REPORT_PATH_A_REPAIR_START_GATE.md` — يوضح إخفاء قسم رفع نتيجة الإصلاح حتى الضغط على «بدء الإصلاح»، وحماية الخادم والاختبارات المرتبطة.

## 11) توثيق تحديث 2026-08-03 — متطلبات إكمال إصلاح المسار A

- `docs/TEST_REPORT_PATH_A_REPAIR_EVIDENCE_REQUIREMENTS.md` — إلزام ملاحظات الإصلاح وصورة ما بعد الإصلاح قبل تفعيل زر الإكمال، مع حماية الخادم والاختبارات.

## 12) توثيق تحديث 2026-08-04 — تسليم مواد البلاغ من المخزون

- `docs/PATH_B_TICKET_MATERIAL_DELIVERY.md` — فصل كمية الشراء عن حصة البلاغ، وإلزام اختيار المستلم الفعلي، وتثبيت الفني المسند للبلاغ، وتحويل الرصيد الزائد إلى مخزون عام بعد اكتمال احتياج البلاغ.

- [المسار C — صيانة الأصول خارج الشركة](PATH_C_EXTERNAL_MAINTENANCE_WORKFLOW.md)
- [تقرير اختبار المسار C](TEST_REPORT_PATH_C_EXTERNAL_MAINTENANCE_WORKFLOW.md)

## 13) توثيق تحديث 2026-08-08 — البلاغ متعدد الجهات والمسارات (الخطوة 1)

- [تسليم الخطوة 1 — بنود البلاغ](تسليم-الخطوة-1-بنود-البلاغ.md) — خطوات التطبيق والتجربة والتراجع بلغة مبسّطة.
- التفاصيل التقنية الكاملة: `docs/CHANGELOG_TECHNICAL.md` (بند 2026-08-08).
- **الخطوات 2→7 لم تبدأ بعد** — راجع `docs/PENDING_TASKS.md` قبل أي عمل على هذه الميزة.

**جدول جديد:** `ticket_items` — بنود البلاغ (مهام متعددة داخل البلاغ الواحد)، بنفس نمط
`purchase_orders → purchase_order_items`. كل بلاغ له بند واحد على الأقل؛ البلاغات السابقة لهذا التاريخ
لها بند واحد مُرحَّل تلقائيًا (`isLegacySingleItem = 1`).

| الطبقة | الملف |
|---|---|
| الترحيل | `drizzle/migrations/2026_08_08_ticket_items_multi_task.sql` |
| المخطط | `drizzle/schema.ts` (`ticketItems`، مُعرَّف قبل `tickets` مباشرة) |
| قاعدة البيانات | `server/_core/db/tickets.ts` (قسم TICKET ITEMS) — و`deletes.ts` (حذف البنود قبل البلاغ) |
| الراوتر | `server/routers/tickets/tickets.router.ts` (`tickets.items` — قراءة فقط) |

⚠️ أعمدة `tickets` القديمة (`status`, `maintenancePath`, ...) **باقية عمدًا** كـ"ملخص" لضمان عمل كل
الشاشات والتقارير القائمة دون كسر — راجع القاعدة الحرجة #11 في `/CLAUDE.md`.

## 14) توثيق تحديث 2026-08-12 — تعارض ترقيم البلاغات على قاعدة مشتركة

- `docs/TICKET_NUMBERING_SHARED_DB_COMPATIBILITY_FIX.md` — يشرح حادثة تكرار `00224/00225`، سبب اختلاف
  `ticket_number_counter` عن الأرقام الفعلية أثناء تعايش النسختين، تنظيف البيانات، والحل الانتقالي الذي أعاد
  `getNextTicketNumber()` للاعتماد على أعلى رقم بلاغ رئيسي فعلي مع استبعاد البلاغات الفرعية.
- التفاصيل التنفيذية المختصرة موجودة أيضًا في `docs/CHANGELOG_TECHNICAL.md` تحت تاريخ 2026-08-12.

## 15) توثيق 2026-08-19 — 2B-10-1 حوكمة وصلاحيات الكتالوج

- `docs/CMMS_2B10_1_CATALOG_PERMISSIONS_UAT_CLOSURE_2026-08-19.md` — إغلاق 2B-10-1، سياسة صلاحيات الكتالوج المعتمدة، نتيجة UAT، فحص تكرار أكواد الأصناف النشطة، وسلوك Soft Delete للموردين.
- التفاصيل التقنية المختصرة موجودة أيضًا في `docs/CHANGELOG_TECHNICAL.md`.
- مشكلة `PR-2026-0378` المكتشفة أثناء UAT مؤجلة ومسجلة في `docs/PENDING_TASKS.md`.


## 16) توثيق 2026-08-19 — 2B-10-2A Catalog Audit Trail

- `docs/CMMS_2B10_2A_CATALOG_AUDIT_TRAIL_IMPLEMENTATION_2026-08-19.md` — تنفيذ Audit Trail للـCatalog: old/new values، Audit إلزامي داخل Transaction، تغطية Units، سجلات Create الناتجة من Candidates، وعرض Catalog Audit لـOwner/Admin.
- `docs/CMMS_2B10_2A_CATALOG_AUDIT_TRAIL_UAT_CLOSURE_2026-08-19.md` — إغلاق UAT الرسمي: Items / Nodes / Units / Suppliers / Item Candidates / Supplier Candidates = PASS، مع توثيق Supplier boolean fix.
- الحالة النهائية: **✅ COMPLETE / UAT PASSED**؛ لا DB Schema/SQL/Migration ولا Backfill.
- نقطة التوقف: **BEFORE 2B-10-2B — Catalog Relationship & Inactive Data Protection**.

## 17) توثيق 2026-08-19 — 2B-10-2B Catalog Relationship & Inactive Data Protection

- `docs/CMMS_2B10_2B_CATALOG_RELATIONSHIP_INACTIVE_PROTECTION_IMPLEMENTATION_2026-08-19.md` — تنفيذ حماية العلاقات الجديدة من Master Data المفقودة/المعطلة مع الحفاظ على الروابط التاريخية، وإدارة Deactivate/Reactivate للأصناف والتصنيفات والوحدات والموردين.
- `docs/CMMS_2B10_2B_CATALOG_RELATIONSHIP_INACTIVE_PROTECTION_UAT_CLOSURE_2026-08-19.md` — إغلاق UAT الرسمي مع أدلة `PR-2026-0382` و`PR-2026-0383` و`PR-2026-0384`، Item `910001`, Node `1051`, Unit `م3`, Supplier `30003`.
- الحالة النهائية: **✅ COMPLETE / UAT PASSED**.
- لا SQL / Migration / Schema / FK / UNIQUE / Backfill.
- نقطة التوقف: **BEFORE 2B-10-2C — Integrity Rules, UAT & Closure**.

## 18) قرار 2026-08-19 — تأجيل 2B-10-2C إلى الإغلاق النهائي

- `docs/CMMS_2B10_2C_DEFERRAL_DECISION_2026-08-19.md` — القرار المعتمد لتأجيل **Integrity Rules, UAT & Closure** إلى Final Project Hardening / Closure، مع إبقاء 2B-10-1 و2B-10-2A و2B-10-2B مغلقة بنجاح وعدم اعتبار 2B-10 Final Closed قبل العودة إلى 2C.
- القرار توثيقي فقط: لا Code / DB / Schema / FK / UNIQUE / Migration / Backfill change.

## 19) توثيق 2026-08-20 — النطاق المعتمد للمرحلة الرئيسية 3: تطوير الجرد

- `docs/CMMS_PHASE3_INVENTORY_COUNT_APPROVED_SCOPE_2026-08-20.md` — يوثق النطاق التنفيذي المعتمد للمرحلة الرئيسية 3 في ثلاث خطوات: تثبيت Snapshot الجرد عند الفتح، استكمال منطق النتائج والتقارير، ثم UAT والإغلاق.
- القرار المالي المعتمد: **متوسط التكلفة المرجعي للجرد هو المتوسط الفعلي وقت فتح الجرد ويظل ثابتًا تاريخيًا لذلك الجرد**.
- الحالة النهائية: ✅ **COMPLETE / RUNTIME UAT PASSED / CLOSED**.
- لا Code / DB / Schema / Migration change ضمن توثيق القرار نفسه.

## 20) تنفيذ 2026-08-20 — Main Phase 3 / Step 1 — Opening Snapshot

- `docs/CMMS_PHASE3_STEP1_INVENTORY_COUNT_OPENING_SNAPSHOT_IMPLEMENTATION_2026-08-20.md` — تنفيذ Snapshot ثابتة للجرد الدوري عند الفتح: كمية النظام + `inventory.averageCost` الفعلي بدقة 4 منازل.
- `inventory_count_snapshots` تم إنشاؤه والتحقق من بنيته في Live DB.
- الجرد الجزئي QR يبقى فارغًا في الواجهة، لكن مسح Lot لاحقًا يعتمد Snapshot الافتتاحية ويرفض Lot دخل بعد الفتح.
- **Step 1 = COMPLETE / Runtime UAT PASSED; Step 2 = COMPLETE / Runtime UAT PASSED; Step 3 = COMPLETE / Runtime UAT PASSED; Main Phase 3 = CLOSED.**

## 21) تنفيذ 2026-08-20 — Receipt Inventory Identity Future Guard

- `docs/CMMS_RECEIPT_INVENTORY_IDENTITY_FUTURE_GUARD_IMPLEMENTATION_2026-08-20.md` — إصلاح مستقبلي لمسار الاستلام بحيث يعاد استخدام Inventory الوحيد لنفس `Catalog Item + Warehouse` بدل إنشاء سجل مكرر جديد.
- عند وجود أكثر من Legacy Inventory لنفس الصنف والمستودع يمنع Backend إنشاء سجل ثالث ولا يدمج أو يحذف البيانات القديمة.
- يشمل `receipts.v2` وApproved Receipt Drafts.
- لا SQL / Migration / FK / UNIQUE / Backfill.
- الحالة: **IMPLEMENTED / RUNTIME UAT PASSED**.

## 22) إغلاق UAT 2026-08-20 — Main Phase 3 / Step 1

- `docs/CMMS_PHASE3_STEP1_INVENTORY_COUNT_OPENING_SNAPSHOT_UAT_CLOSURE_2026-08-20.md` — يثبت ثبات Snapshot الكمية بعد الصرف `DLV-2026-300181` وثبات Snapshot التكلفة بعد `PR-2026-0389` رغم تغير Moving Weighted Average الحالي.
- `CNT-2026-60028`: **Step 1 COMPLETE / RUNTIME UAT PASSED**.

## 23) تنفيذ 2026-08-20 — Main Phase 3 / Step 2 — Results & Reports

- `docs/CMMS_PHASE3_STEP2_INVENTORY_COUNT_RESULTS_REPORTS_IMPLEMENTATION_2026-08-20.md` — تقييم فرق الجرد باستخدام `averageCostSnapshot` فقط، وإظهار متوسط التكلفة وقت الفتح وقيمة الفرق في الشاشة والطباعة.
- لا fallback إلى `inventory.averageCost` الحالي للجرد التاريخي.
- لا SQL / Migration / Schema change جديد.
- **Step 2 = COMPLETE / RUNTIME UAT PASSED.**


## 22) تنفيذ 2026-08-20 — Main Phase 3 / Step 2 — Results & Reports

- `docs/CMMS_PHASE3_STEP2_INVENTORY_COUNT_RESULTS_REPORTS_IMPLEMENTATION_2026-08-20.md` — ربط نتائج الجرد بـ`averageCostSnapshot` المحفوظة وقت الفتح وحساب `diffValue = diffQuantity × averageCostSnapshot`.
- شاشة الجرد ووثيقة الطباعة تعرضان متوسط التكلفة وقت الفتح وقيمة الفرق وإجمالي النقص/الزيادة وصافي الأثر المالي من Snapshot فقط.
- لا fallback إلى `inventory.averageCost` الحالي للجرد التاريخي الذي لا يملك Cost Snapshot؛ يبقى التقييم المالي غير متاح صراحةً.
- لا SQL / Migration / Schema change في Step 2، والعد/الإكمال يظلان non-posting؛ Settlement فقط يغيّر الرصيد.
- الحالة: **COMPLETE / RUNTIME UAT PASSED**.

## 24) إغلاق UAT 2026-08-20 — Main Phase 3 / Step 2

- `docs/CMMS_PHASE3_STEP2_INVENTORY_COUNT_RESULTS_REPORTS_UAT_CLOSURE_2026-08-20.md` — يثبت على `CNT-2026-60028` أن `diffValue` يستخدم `averageCostSnapshot=5.0000` رغم أن Current Average Cost أصبح `10.0000`، وأن Final Save لا يطبق Settlement تلقائياً.
- **Step 2 = COMPLETE / RUNTIME UAT PASSED.**

## 25) تنفيذ 2026-08-20 — Main Phase 3 / Step 3 — Settlement Cut-off & Lot Freeze

- `docs/CMMS_PHASE3_STEP3_SETTLEMENT_CUTOFF_IMPLEMENTATION_2026-08-20.md` — تنفيذ Cut-off مهني للتسوية: Count Lots المستهدفة تُجمّد للحركات الناقصة/الناقلة، Receipt Lots الجديدة تبقى مستقلة، وSettlement يطبق فرق الجرد المحفوظ فوق الرصيد الحالي بدلاً من استبداله بكمية عد قديمة.
- `completedAt` و`appliedAt` مستخدمان كوقت Final Save وSettlement بدون Schema جديد.
- Finalized Count غير قابل للتعديل من شاشة Settlement، وتطبيق نفس Settlement مرتين مرفوض Backend.
- **Step 3 = COMPLETE / RUNTIME UAT PASSED; Main Phase 3 = CLOSED.**


## 26) الإغلاق الرسمي 2026-08-20 — Main Phase 3 — Inventory Count Development

- `docs/CMMS_PHASE3_INVENTORY_COUNT_FINAL_CLOSURE_2026-08-20.md` — وثيقة الإغلاق الرسمية للمرحلة الرئيسية الثالثة مع Runtime UAT النهائي.
- `CNT-2026-60028`: Count Lot `10` مُنع من الصرف قبل Settlement بسبب فرق غير مسوّى = PASS.
- `ADJ-2026-30006`: طبق `+1` على Lot `10` من `2→3`; بعد التسوية `inventory.quantity=4` و`SUM(lot balances)=4` = PASS.
- بعد التسوية تم فك التجميد ونجح `DLV-2026-300182`; الفحص النهائي أعاد `inventory.quantity=3` و`SUM(lot balances)=3` = PASS.
- **Main Phase 3 = ✅ COMPLETE / RUNTIME UAT PASSED / CLOSED.**
- `2B-10-2C` يبقى مؤجلاً؛ Main Phase 4 لا تبدأ تلقائيًا ضمن هذا التوثيق.


## 27) Main Phase 4 — Three-Step Plan & Status — 2026-08-20

- `docs/CMMS_PHASE4_SETTLEMENT_THREE_STEP_PLAN_AND_STATUS_2026-08-20.md` — المرجع المعتمد لتقسيم Settlement Development إلى ثلاث خطوات فقط.
- **الحالة النهائية:** Main Phase 4 = ✅ **COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED**.
- لا يبدأ Main Phase 5 تلقائيًا بعد هذا الإغلاق.

## 28) Main Phase 4 / Step 2 — Valuation & Posting Logic Implementation — 2026-08-22

- `docs/CMMS_PHASE4_STEP2_SETTLEMENT_VALUATION_POSTING_IMPLEMENTATION_2026-08-22.md` — تنفيذ 4.2.1/4.2.2/4.2.3:
  - مزامنة Schema مع حقول Live DB الموجودة مسبقًا.
  - Count Settlement تستخدم Opening `averageCostSnapshot`.
  - حفظ `unitCostUsed` / `adjustmentValue`.
  - دعم `reference` ضمن النطاق المعتمد.
  - جميع مسارات Posting المدعومة تعمل داخل DB Transaction.
- **Step 2 = ✅ IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME VALIDATED IN STEP 3.**

## 29) Main Phase 4 / Step 3 — Settlement UI + Runtime UAT — 2026-08-22

- `docs/CMMS_PHASE4_STEP3_SETTLEMENT_UI_RUNTIME_UAT_2026-08-22.md` — وثيقة تنفيذ الحد الأدنى للـUI ونتائج Runtime UAT الفعلية.
- UAT المغطى:
  - `CNT-2026-60030` / `ADJ-2026-30008` — Count Surplus + Snapshot valuation بعد تغير Current Average Cost + freeze/unfreeze + duplicate guard.
  - `CNT-2026-60031` / `ADJ-2026-30009` — Count Shortage + financial posting + freeze/unfreeze.
  - `CNT-2026-60032` — forced rollback داخل Transaction ثم نجاح `ADJ-2026-30011` بعد إزالة failpoint.
  - Manual Aggregate Settlement guard مع Lots Enabled.
- **Step 3 = ✅ COMPLETE / RUNTIME UAT PASSED / CLOSED.**

## 30) Main Phase 4 — Final Runtime UAT & Official Closure — 2026-08-22

- `docs/CMMS_PHASE4_SETTLEMENT_FINAL_CLOSURE_2026-08-22.md` — وثيقة الإغلاق الرسمية الشاملة للمرحلة الرابعة، وتشمل القيم الفعلية للاختبارات، نتائج الـSQL، Settlement/Delivery references، وAtomicity/Rollback evidence.
- **Main Phase 4 — Settlement Development = ✅ COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- لا Historical Backfill / Legacy Cleanup / Revaluation / New Approval Workflow / Manual Lot Workflow ضمن الإغلاق.
- `2B-10-2C` يبقى مؤجلًا إلى Final Project Hardening / Closure.

## 31) إعادة تجميع وترقيم المراحل الرئيسية المتبقية — 2026-08-22

- `docs/CMMS_INVENTORY_MAIN_PHASES_RENUMBERING_2026-08-22.md` — قرار صاحب المشروع لإعادة تجميع وترقيم Roadmap المخزون بعد الإغلاق الرسمي لـMain Phase 4.
- الخريطة الحالية:
  - Main Phase 5 = المراحل القديمة 5 + 6 + 7 + 8.
  - Main Phase 6 = المرحلة القديمة 9.
  - Main Phase 7 = المرحلة القديمة 10.
  - Main Phase 8 = المرحلة القديمة 11.
- تم تحديث `docs/inventory/INVENTORY_DEVELOPMENT_PLAN_AND_CHANGE_CONTROL.md` و`docs/PENDING_TASKS.md` وفق القرار.
- لا Code/SQL/Live DB/Workflow change ضمن قرار إعادة الترقيم نفسه؛ **هذه حالة تاريخية وقت القرار، وقد بدأت Main Phase 5 لاحقًا في نفس التاريخ وأُغلق 5.1 رسميًا — راجع القسمين 32 و33.**
- وثائق الإغلاق التاريخية لـMain Phase 3 و4 لم تُعدّل.

## 32) Main Phase 5 / 5.1 — Disposal / Write-off Implementation — 2026-08-22

- `docs/CMMS_PHASE5_STEP1_DISPOSAL_IMPLEMENTATION_2026-08-22.md` — Gap Analysis + تنفيذ hardening لمسار Disposal الحالي دون إعادة بناء الـWorkflow.
- Legacy non-Lot Disposal أصبح يضم Number/Header/Items/Inventory quantity+value/Inventory Transaction داخل DB Transaction واحدة، مع `FOR UPDATE` وخصم شرطي.
- Lot-aware path بقي QR/warehouse-scoped وTransactional مع حفظ `lotId`، وتبقى Current `inventory.averageCost` على الخادم هي مصدر تكلفة الاستبعاد.
- لا SQL/Migration/Backfill/Cleanup/Approval Workflow.
- **Historical checkpoint at 5.1 implementation:** Main Phase 5 = IN PROGRESS; 5.1 = COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED; 5.2 was IN PROGRESS at that point. That historical status was later superseded: 5.2 closed, and 5.3 was explicitly started on 2026-08-23; 5.4 remains NOT STARTED.



## 33) Main Phase 5 / 5.1 — Disposal Runtime UAT & Official Closure — 2026-08-22

- `docs/CMMS_PHASE5_STEP1_DISPOSAL_RUNTIME_UAT_CLOSURE_2026-08-22.md` — وثيقة Runtime UAT والإغلاق الرسمي للجزء 5.1.
- `DO-2026-000003`: successful Lot-aware Disposal; Live DB quantity/value/Lot/transaction invariants = PASS.
- Over-quantity attempt `10` against available `9` blocked by UI = PASS.
- `DO-2026-000004`: second successful Disposal; Lot/Inventory/SUM Lots `6.000`, Total Value `6.00`, movement `out/disposal` `4.000 @ 1.0000 = 4.00` = PASS.
- Detail view + printed Disposal document for `DO-2026-000004` = PASS.
- Accepted limit: legacy non-Lot path was not Runtime-exercised because deployed workflow has Lots enabled; targeted regression/source checks remain the evidence for that hardened branch.
- No SQL/Migration/Backfill/Cleanup/Approval Workflow.
- **5.1 = ✅ COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- **5.2 بدأ بموافقة صريحة؛ لا يبدأ 5.3 قبل إغلاق 5.2.**


## 34) Main Phase 5 / 5.2 — Returns Implementation — 2026-08-22

- `docs/CMMS_PHASE5_STEP2_RETURNS_IMPLEMENTATION_2026-08-22.md` — Gap Analysis وتنفيذ hardening لمسار Supplier Return الحالي مع إبقاء Recipient-to-Warehouse Return خلف بوابة قرار صريحة.
- Supplier Return Lots Enabled يبقى Warehouse + QR/Lot sourced؛ الترحيل المالي يستخدم Current Average Cost من الخادم ويقفل Aggregate Inventory داخل Transaction.
- Legacy non-Lot Supplier Return core posting أصبح Transactional دون تغيير الـWorkflow.
- `server/tests/inventoryReturnsPhase5Step2.test.ts` — source regression guards لـatomicity/source linkage/valuation boundaries.
- لا SQL/Migration/Backfill/Cleanup/Approval Workflow.
- This is the initial implementation checkpoint. Recipient-to-Warehouse was later approved/implemented and fresh 5.2 Runtime UAT subsequently passed; see sections 35–36.

## 35) Main Phase 5 / 5.2 — Recipient → Warehouse Return — 2026-08-22

- `docs/CMMS_PHASE5_STEP2_RECIPIENT_RETURN_IMPLEMENTATION_2026-08-22.md` — القرار المعتمد، Live DB evidence، source linkage، same-Lot/original-cost posting، partial/over-return guards والـatomicity.
- `warehouse_returns.sourceDeliveryDocumentId INT NULL` + `idx_warehouse_returns_source_delivery` أُضيفا يدويًا إلى Live DB بأوامر منفصلة ومتحقق منهما؛ لا Backfill/FK/UNIQUE ولا migration يعاد تشغيله آليًا.
- `drizzle/schema.ts` — مزامنة code model مع Live DB المؤكد.
- `server/_core/db/warehouse-returns.ts` — resolve original Delivery + atomic Recipient Return posting.
- `server/routers/inventory/returns.router.ts` — `resolveRecipientReturnSource` + `createRecipientReturn`.
- `client/src/pages/inventory/WarehouseReturn.tsx` — اختيار صريح بين Supplier Return وRecipient→Warehouse، مع عرض سند الصرف/الـLot/التكلفة/المتبقي.
- `client/src/pages/inventory/WarehouseReturnsList.tsx` + `client/src/lib/printReturnDocument.ts` — traceability لسند الصرف الأصلي في القائمة والطباعة.
- `server/tests/inventoryReturnsPhase5Step2.test.ts` — targeted source regression checks.
- **Status: IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME UAT PASSED; 5.2 OFFICIALLY CLOSED.**


## 36) Main Phase 5 / 5.2 — Returns Runtime UAT & Official Closure — 2026-08-22

- `docs/CMMS_PHASE5_STEP2_RETURNS_RUNTIME_UAT_CLOSURE_2026-08-22.md` — Fresh Runtime UAT evidence and official 5.2 closure.
- Supplier Return `RTN-2026-60003` from `RCV-2026-420140` = PASS: quantity/value decrement, Lot/Inventory invariant and `out/return` movement verified in Live DB.
- Recipient Return `RTN-2026-60004` from `DLV-2026-300204` = PASS: same original Lot/Inventory, original issue cost, explicit Delivery link and `in/return` movement verified in Live DB.
- Full-return retry against `DLV-2026-300204` rejected after quantity had already been returned = PASS.
- Partial/over-return case `DLV-2026-300205` / `RTN-2026-60005` = PASS: `3 > 2` rejected, `1` returned, cumulative prior return = `1`, remaining returnable = `1`, UI and Live DB agreed.
- Accepted limits: Legacy non-Lot Supplier Return not separately Runtime-exercised under Lots-enabled deployment; Recipient list/print source traceability remains targeted-check evidence.
- **5.2 = ✅ COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- **Historical stop immediately after 5.2 closure:** 5.3 was NOT STARTED at that point. **Current status:** Main Phase 5 = IN PROGRESS; 5.3 = CLOSED; 5.4 = NOT STARTED.


## 37) Main Phase 5 / 5.3 — Receipt / Issue / Warehouse Transfer Review — 2026-08-23

- `docs/CMMS_PHASE5_STEP3_RECEIPT_ISSUE_TRANSFER_IMPLEMENTATION_2026-08-23.md` — implementation/gap-analysis checkpoint; targeted checks passed and Runtime UAT subsequently closed 5.3.
- `docs/CMMS_CENTRALIZED_DOCUMENT_NUMBERING_DEFERRED_2026-08-23.md` — deferred centralized numbering design/approval gate; existing numbering remains in place until separately approved.
- Current roadmap source: `docs/inventory/INVENTORY_DEVELOPMENT_PLAN_AND_CHANGE_CONTROL.md`.

## 38) Main Phase 5 / 5.3 — Runtime UAT & Official Closure — 2026-08-23

- `docs/CMMS_PHASE5_STEP3_RECEIPT_ISSUE_TRANSFER_RUNTIME_UAT_CLOSURE_2026-08-23.md` — fresh Receipt/Delivery/Transfer Runtime evidence and official closure.
- `RCV-2026-420150` = PASS: two fresh Lot-aware receipt items in `WH-MAIN` with correct quantity/value and `in/purchase` movements.
- `DLV-2026-300213` = PASS: same Lot/Inventory decrement, value `40.00`, `out/delivery` trace.
- `TRB-2026-030005` / `TRF-2026-030005` = PASS: same Lot moved from `WH-MAIN` to `SUB-1`; source `3`, destination `1`, company-wide Lot quantity `4`, paired transfer movements.
- Over-quantity transfer `4 > 3` rejected = PASS.
- Centralized numbering remains documented/deferred; current numbering mechanisms unchanged.
- **5.3 = ✅ COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- **Historical stop after 5.3 closure:** 5.4 was NOT STARTED at that point; superseded by sections 39–41 below.


## 39) Main Phase 5 / 5.4 — Approved Scope — 2026-08-23

- `docs/CMMS_PHASE5_STEP4_INVENTORY_RECONCILIATION_APPROVED_SCOPE_2026-08-23.md` — النطاق المعتمد لـInventory Reconciliation المستقبلية والـRead-only.
- التقسيم: 5.4.1 Integrity Rules → 5.4.2 Read-only Engine → 5.4.3 Exception Report → 5.4.4 Runtime UAT & Closure.
- البيانات التاريخية/التجريبية تبقى untouched؛ لا Baseline table، لا Historical Ledger Reconstruction، لا Cleanup/Backfill/Revaluation.
- Centralized Numbering، Batch all-or-nothing، Workflow/Accounting redesign، والـProduction Cutover خارج 5.4.
- **5.4 = IN PROGRESS.**

## 40) Main Phase 5 / 5.4.1 — Inventory Integrity Rules Official Closure — 2026-08-23

- `docs/CMMS_PHASE5_STEP4_1_INVENTORY_INTEGRITY_RULES_CLOSURE_2026-08-23.md` — وثيقة القواعد المعتمدة وLive DB read-only evidence.
- Inventory-with-Lot quantity mismatches=`0`; global Lot mismatches=`0`; negative stock/Lot rows=`0`; Lot reference/warehouse integrity exceptions=`0`.
- Current value rule uses `ROUND(quantity × averageCost, 2)` with approved rounding tolerance; two old experimental value mismatches were observed and explicitly left untouched.
- No code or data writes were performed in 5.4.1.
- **5.4.1 = ✅ COMPLETE / LIVE DB READ-ONLY DISCOVERY PASSED / RULES APPROVED / OFFICIALLY CLOSED.**
- **Historical stop after 5.4.1 closure:** before 5.4.2; superseded by section 41 below.


## 41) Main Phase 5 / 5.4.2 — Read-only Reconciliation Engine — 2026-08-23

- `docs/CMMS_PHASE5_STEP4_2_READ_ONLY_RECONCILIATION_ENGINE_IMPLEMENTATION_2026-08-23.md` — backend-only read-only engine implementation.
- New core evaluator + SELECT-only DB service + query-only tRPC endpoint + targeted regression test.
- No UI report yet; 5.4.3 remains NOT STARTED.
- No Auto-fix, Historical Reconstruction/Backfill/Cleanup/Revaluation or DB schema/data changes.
- Deployed Live DB verification after owner extraction/restart: `readOnly=true`, `53/53` checks PASS, `0` exceptions; tracked Inventory=`5`, Lots=`4`, Lot Balance rows=`5`.
- `docs/CMMS_PHASE5_STEP4_2_READ_ONLY_RECONCILIATION_ENGINE_CLOSURE_2026-08-23.md` — official 5.4.2 closure and deployed Runtime evidence.
- **5.4.2 = ✅ COMPLETE / TARGETED CHECKS PASSED / LIVE DB RUNTIME VERIFICATION PASSED / OFFICIALLY CLOSED.**
- **Current stop:** before 5.4.3; 5.4.3 remains NOT STARTED until explicit owner instruction.


## 42) Main Phase 5 / 5.4.3 — Reconciliation Exception Report — 2026-08-23

- `docs/CMMS_PHASE5_STEP4_3_RECONCILIATION_EXCEPTION_REPORT_IMPLEMENTATION_2026-08-23.md` — read-only report UI over the 5.4.2 engine, route/navigation/translations, filters/refresh and targeted source checks.
- `docs/CMMS_PHASE5_STEP4_3_RECONCILIATION_EXCEPTION_REPORT_CLOSURE_2026-08-23.md` — Runtime UI evidence and official closure.
- Runtime UI matched engine state: `53/53` checks PASS, `0` exceptions; Lot-tracked Inventory=`5`, total Inventory=`698`, Lots=`4`, Lot Balances=`5`.
- One-page Arabic **دليل تقرير مطابقة المخزون** is downloadable from the report; owner confirmed the button works.
- No Auto-fix/mutation/SQL/migration/data change. No artificial DB exception was introduced merely to test exception rendering.
- **5.4.3 = ✅ IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME UI VERIFICATION PASSED / OFFICIALLY CLOSED.**
- **Historical stop at 5.4.3 closure:** before 5.4.4; this checkpoint was later superseded when the owner explicitly started and completed 5.4.4 Runtime UAT.

## 43) Main Phase 5 / 5.4.4 — Runtime UAT & Closure Approved Plan — 2026-08-23

- `docs/CMMS_PHASE5_STEP4_4_RUNTIME_UAT_AND_CLOSURE_APPROVED_PLAN_2026-08-23.md` — الخطة المعتمدة لاختبار Runtime النهائي وإغلاق 5.4 بعد نجاحه.
- UAT موجه للحركات الجديدة فقط؛ البيانات القديمة/التجريبية ليست هدف إصلاح أو Historical Reconstruction.
- No artificial Live DB corruption is required to manufacture an exception.
- **Historical plan status:** 5.4.4 = SCOPE APPROVED / DOCUMENTED — NOT STARTED; Main Phase 5.4 = IN PROGRESS.
- This plan checkpoint is **superseded by section 44**, where 5.4.4 Runtime UAT passed and 5.4/Main Phase 5 were closed.

## 44) Main Phase 5 / 5.4.4 — Runtime UAT & Official Closure — 2026-08-23

- `docs/CMMS_PHASE5_STEP4_4_RUNTIME_UAT_CLOSURE_2026-08-23.md` — final deployed Runtime UAT evidence and official closure of 5.4.4 / Main Phase 5.4.
- Pre-UAT report: `53/53` PASS, `0` exceptions.
- `RCV-2026-420151`: after two new Lot-aware receipt items, report=`75/75` PASS, `0` exceptions.
- `DLV-2026-300215`: after Delivery, report=`75/75` PASS, `0` exceptions.
- `TRB-2026-030006`: after one-item Warehouse Transfer, report=`84/84` PASS, `0` exceptions; Lots remained `6`, Lot Balances increased to `8` as the Lot distribution expanded to another warehouse Inventory identity.
- No artificial Live DB mismatch, Auto-fix, Historical Cleanup/Backfill/Revaluation, Centralized Numbering, Batch Transfer redesign, Workflow/Accounting redesign, or Production Cutover.
- **5.4.4 = ✅ COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- **Main Phase 5.4 = ✅ COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**

## 45) Main Phase 5 — Final Official Closure — 2026-08-23

- `docs/CMMS_MAIN_PHASE5_FINAL_CLOSURE_2026-08-23.md` — consolidated closure record for Main Phase 5.
- 5.1 Disposal / Write-off = OFFICIALLY CLOSED.
- 5.2 Returns = OFFICIALLY CLOSED.
- 5.3 Receipt / Issue / Warehouse Transfer Review = OFFICIALLY CLOSED.
- 5.4 Inventory Reconciliation = OFFICIALLY CLOSED.
- **Main Phase 5 = ✅ COMPLETE / OFFICIALLY CLOSED.**
- **Current stop:** before Main Phase 6 — Inventory / Accounting Reports; Main Phase 6 remains NOT STARTED.



## توثيق 2026-08-23 — Main Phase 6 Inventory / Accounting Reports — Approved Scope

- `docs/CMMS_MAIN_PHASE6_INVENTORY_ACCOUNTING_REPORTS_APPROVED_SCOPE_2026-08-23.md` — النطاق المعتمد قبل التنفيذ: مركز تقارير مخزنية موحد، التقارير الأساسية للحالة والحركات، التقارير المالية، وتأجيل **تحليل المخزون** (Slow/Dead Moving, ABC, Aging, Turnover) إلى آخر Main Phase 6.
- `docs/CMMS_MAIN_PHASE6_UNIFIED_REPORT_TOOLBAR_AND_EXPORT_STANDARD_APPROVED_2026-08-23.md` — قرار معتمد لـ6.1 يوحد شريط التقرير (`تحديث` / `إعادة تعيين الفلاتر` / `طباعة` / `تصدير`) ويعتمد Excel `.xlsx` وPDF المنظمين، تاريخ/وقت إنشاء التقرير، احترام الفلاتر، ودعم العربية/RTL والبيانات الهجينة بدون تشويه.
- الحالة الحالية: **Main Phase 6 = SCOPE APPROVED / DOCUMENTED — IMPLEMENTATION NOT STARTED; current stop before 6.1.**


## توثيق 2026-08-23 — Main Phase 6 / 6.1 Reports Foundation implementation

- `docs/CMMS_MAIN_PHASE6_STEP6_1_REPORTS_FOUNDATION_IMPLEMENTATION_2026-08-23.md` — تنفيذ مركز التقارير المخزنية والـFoundation الموحد للأزرار والفلاتر وتاريخ الإنشاء وExcel/PDF/Print مع إعادة استخدام `exceljs` وChromium الموجودين.
- **Main Phase 6 = IN PROGRESS.**
- **6.1 implementation checkpoint = IMPLEMENTED / TARGETED CHECKS PASSED / DEPLOYED VERIFICATION PENDING; superseded by official Runtime closure below.**
- 6.2/6.3 لم تبدأ، و6.4 تبقى مؤجلة للتنفيذ في الأخير.
- Historical implementation stop: deploy/verify/close 6.1 before starting 6.2; superseded by the closure entry below.


## توثيق 2026-08-23 — Main Phase 6 / 6.1 Reports Foundation — Runtime UAT Closure

- `docs/CMMS_MAIN_PHASE6_STEP6_1_REPORTS_FOUNDATION_RUNTIME_UAT_CLOSURE_2026-08-23.md` — إغلاق 6.1 بعد تصحيح الأزرار والتحقق Runtime من Refresh / Reset Filters / Print / Excel / PDF.
- Targeted tests: **4/4 PASS** للـexport foundation و**3/3 PASS** للـfunctional actions.
- تم توليد وفتح Excel `.xlsx` وPDF فعليين من المركز.
- **6.1 = OFFICIALLY CLOSED. Main Phase 6 = IN PROGRESS. 6.2 = NOT STARTED.**
- **Current stop:** after 6.1 closure / before 6.2.

## توثيق 2026-08-23 — Main Phase 6 / 6.2 Stock Balance & Movement Reports — Approved Scope

- `docs/CMMS_MAIN_PHASE6_STEP6_2_STOCK_BALANCE_MOVEMENT_REPORTS_APPROVED_SCOPE_2026-08-23.md` — النطاق التنفيذي المعتمد لـ6.2 بعد إغلاق 6.1.
- التقسيم: 6.2.1 Stock Balance & Status → 6.2.2 Stock Card & Unified Movement Report → 6.2.3 Unified Export & Review → 6.2.4 Runtime UAT & Closure.
- 6.2 تستخدم نفس Reports Center والToolbar/Filters/Excel/PDF/Print Foundation المغلقة في 6.1 ولا تعيد بناءها.
- Read-only فقط؛ لا Auto-fix/Backfill/Legacy Cleanup/Accounting redesign/Posting Engine.
- **Status: 6.2 = SCOPE APPROVED / DOCUMENTED — IMPLEMENTATION NOT STARTED. Current stop: before 6.2.1.**

## توثيق 2026-08-23 — Main Phase 6 / 6.2.1 Stock Balance & Status — Implementation

- `docs/CMMS_MAIN_PHASE6_STEP6_2_1_STOCK_BALANCE_STATUS_IMPLEMENTATION_2026-08-23.md` — تنفيذ أول تقرير فعلي داخل مركز التقارير: رصيد المخزون والحالة، فلاتر المخزن/الصنف/الحالة، Lot drill-down، وإعادة استخدام Print/Excel/PDF Foundation المغلقة في 6.1.
- التقرير Read-only ويعرض `totalCostValue` المخزنة كما هي ولا يعمل Revaluation أو Historical Cleanup.
- **6.2.1 = IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / DEPLOYED RUNTIME VERIFICATION PENDING.**
- **Current stop:** deploy/restart/test 6.2.1 before closure; 6.2.2 NOT STARTED.


## توثيق 2026-08-23 — Main Phase 6 / 6.2.1 Runtime Verification Checkpoint

- `docs/CMMS_MAIN_PHASE6_STEP6_2_1_STOCK_BALANCE_STATUS_RUNTIME_CHECKPOINT_2026-08-23.md` — دليل الحالة الفعلية بعد تشغيل التقرير والاختبار المستهدف.
- Runtime UI confirmed: 709 rows; 141 normal; 0 low; 568 zero; 0 negative; 8 Lot Tracking inventory.
- Targeted test: 4/4 PASS.
- **Not a closure document:** final Runtime checks for status filtering, Lot drill-down, and filtered Excel/PDF export are still pending owner confirmation.
- Current stop: continue 6.2.1 Runtime verification; 6.2.2 NOT STARTED.


## توثيق 2026-08-23 — Main Phase 6 / 6.2.1 Stock Balance & Status — Runtime UAT Closure

- `docs/CMMS_MAIN_PHASE6_STEP6_2_1_STOCK_BALANCE_STATUS_RUNTIME_CLOSURE_2026-08-23.md` — الإغلاق الرسمي بعد نجاح الاختبارات المستهدفة والتحقق Runtime من فلتر الحالة، Lot drill-down، وExcel/PDF مع الفلاتر.
- **6.2.1 = COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- **Current stop:** after 6.2.1 official closure; 6.2.2 NOT STARTED.

- `CMMS_MAIN_PHASE6_STEP6_2_2_STOCK_CARD_UNIFIED_MOVEMENT_IMPLEMENTATION_2026-08-23.md` — 6.2.2 implementation checkpoint; Runtime verification pending.


## توثيق 2026-08-23 — Main Phase 6 / 6.2.2 Stock Card & Unified Movement Report — Runtime UAT Closure

- `docs/CMMS_MAIN_PHASE6_STEP6_2_2_STOCK_CARD_UNIFIED_MOVEMENT_RUNTIME_CLOSURE_2026-08-23.md` — الإغلاق الرسمي لـ6.2.2 بعد التحقق Runtime من **جميع الحركات** و**بطاقة الصنف**.
- Targeted test: **4/4 PASS**.
- Runtime filters = PASS.
- Filter-aware Excel/PDF export = PASS.
- التقرير يبقى Read-only ولا ينشئ Opening Balance تاريخي أو يعمل Historical Reconstruction/Backfill.
- **6.2.2 = COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- **Current stop:** after 6.2.2 official closure; 6.2.3 NOT STARTED.


## توثيق 2026-08-23 — Main Phase 6 / 6.2.3 Unified Export & Review — Implementation

- `docs/CMMS_MAIN_PHASE6_STEP6_2_3_UNIFIED_EXPORT_REVIEW_IMPLEMENTATION_2026-08-23.md` — مراجعة وتوحيد Export/Print الفعلي على تقريري 6.2.1 و6.2.2 بدون إنشاء Export architecture ثانية.
- أضيف اختبار cross-report للتأكد من RTL/Arabic، Generated-at، XLSX المنظم، Print HTML، الفلاتر والبيانات الهجينة.
- تم تحسين ملخص فلتر المخزن في Movement/Stock Card export ليظهر `warehouse code + name` بدل رقم `warehouseId` الخام عند توفر metadata.
- **6.2.3 = IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / DEPLOYED RUNTIME VERIFICATION PENDING.**
- **6.2.4 = NOT STARTED. Current stop: deploy/test 6.2.3.**


## توثيق 2026-08-23 — Main Phase 6 / 6.2.3 Unified Export & Review — Runtime Closure

- `docs/CMMS_MAIN_PHASE6_STEP6_2_3_UNIFIED_EXPORT_REVIEW_RUNTIME_CLOSURE_2026-08-23.md` — الإغلاق الرسمي لـ6.2.3 بعد نجاح اختبار cross-report **4/4 PASS** والتحقق Runtime من الفلاتر وExcel وPDF والطباعة واحترام النتائج المفلترة.
- 6.2.3 تبقى مبنية على Foundation واحدة مغلقة من 6.1 بدون Export architecture موازية.
- ملاحظة التوقيت: فرض `Asia/Riyadh` لم يعتمد كمتطلب حاجب حاليًا بقرار المالك؛ لا تدعي وثيقة الإغلاق ضمان توقيت الرياض في جميع بيئات النشر.
- **6.2.3 = OFFICIALLY CLOSED.**
- **Current stop:** after 6.2.3 official closure; 6.2.4 NOT STARTED.


## توثيق 2026-08-23 — Main Phase 6 / 6.2.4 Runtime UAT & 6.2 Closure

- `docs/CMMS_MAIN_PHASE6_STEP6_2_4_RUNTIME_UAT_AND_STEP6_2_CLOSURE_2026-08-23.md` — الإغلاق الرسمي لـ6.2.4 و6.2 بعد Runtime UAT مقابل Live DB.
- Stock Balance + Unified Movements + Stock Card = PASS.
- Stock Card search fix targeted test = **4/4 PASS** + Runtime re-test = PASS.
- Reports remain Read-only; no Historical Reconstruction/Backfill/Cleanup/Revaluation or DB mutation.
- **6.2 = COMPLETE / OFFICIALLY CLOSED.**
- **Current stop:** after 6.2 official closure; 6.3 NOT STARTED.


## توثيق 2026-08-23 — Main Phase 6 / 6.3 Inventory Valuation & Accounting Reports — Approved Scope

- `docs/CMMS_MAIN_PHASE6_STEP6_3_INVENTORY_VALUATION_ACCOUNTING_REPORTS_APPROVED_SCOPE_2026-08-23.md` — النطاق المعتمد قبل التنفيذ للتقارير المالية/القيمية.
- التقسيم: 6.3.1 Inventory Valuation Report → 6.3.2 Value by Warehouse / Category → 6.3.3 Inventory Variance & Accounting Review → 6.3.4 Runtime UAT & Closure.
- Read-only؛ لا Revaluation / Auto-fix / Historical Backfill / Legacy Cleanup / Posting Engine / Accounting redesign.
- يعاد استخدام Foundation المغلقة في 6.1 وExport/Print behavior المقبول في 6.2.
- **Status: 6.3 = SCOPE APPROVED / DOCUMENTED — IMPLEMENTATION NOT STARTED. Current stop: before 6.3.1.**


## توثيق 2026-08-24 — Main Phase 6 / 6.3.1 Inventory Valuation Report — Runtime UAT Closure

- `docs/CMMS_MAIN_PHASE6_STEP6_3_1_INVENTORY_VALUATION_REPORT_RUNTIME_CLOSURE_2026-08-24.md` — إغلاق 6.3.1 بعد نجاح الاختبار المستهدف والـRuntime UI والتصدير/الطباعة.
- التقرير يعرض `totalCostValue` المخزنة فعليًا مع quantity/averageCost بدون Revaluation أو تعديل بيانات.
- Targeted test = **4/4 PASS**; search/warehouse/value-status filters + Excel/PDF/Print = **Runtime PASS**.
- **Status: 6.3 = IN PROGRESS; 6.3.1 = OFFICIALLY CLOSED; 6.3.2 = NOT STARTED. Current stop before 6.3.2.**


## توثيق 2026-08-24 — Main Phase 6 / 6.3.2 Value by Warehouse / Category — Implementation

- `docs/CMMS_MAIN_PHASE6_STEP6_3_2_VALUE_BY_WAREHOUSE_CATEGORY_IMPLEMENTATION_2026-08-24.md` — تنفيذ 6.3.2 كاملة في دفعة واحدة داخل صفحة القيمة والمحاسبة الحالية.
- أضيف عرض **حسب المخزن** وعرض **حسب التصنيف** مع الإبقاء على 6.3.1 كما هي.
- كل التجميعات تستخدم stored `totalCostValue` من 6.3.1 بدون Revaluation أو تعديل قيمة/تكلفة.
- التصنيف يعيد استخدام Catalog Taxonomy المقبول في 2B-9، ويعرض غير المربوط كـ`غير مصنف` بدون Backfill/Cleanup.
- Excel/PDF/Print والفلاتر تعمل من نفس Report Foundation على مستوى الكود؛ Runtime verification على المشروع المنشور ما زال مطلوبًا قبل الإغلاق الرسمي.
- **Status: 6.3 = IN PROGRESS; 6.3.1 = OFFICIALLY CLOSED; 6.3.2 = IMPLEMENTED IN CODE / RUNTIME VERIFICATION PENDING; 6.3.3 = NOT STARTED.**


## توثيق 2026-08-24 — Main Phase 6 / 6.3.2 Value by Warehouse / Category — Runtime UAT Closure

- `docs/CMMS_MAIN_PHASE6_STEP6_3_2_VALUE_BY_WAREHOUSE_CATEGORY_RUNTIME_CLOSURE_2026-08-24.md` — الإغلاق الرسمي لـ6.3.2 بعد نجاح الاختبار المستهدف وقبول الـRuntime.
- Targeted Vitest: **5/5 PASS** (`inventoryValueDistributionReportPhase6Step3_2.test.ts`).
- Runtime: عروض 6.3.1 / حسب المخزن / حسب التصنيف تعمل؛ المالك أكد أن Excel / PDF / Print تعمل.
- التجميع ما زال مبنيًا على stored `totalCostValue`؛ لا Revaluation ولا تعديل `averageCost`/`totalCostValue`.
- غير المربوط بالتصنيف يبقى `غير مصنف / Uncategorized` بدون Backfill أو Cleanup.
- **Status: 6.3 = IN PROGRESS; 6.3.1 = OFFICIALLY CLOSED; 6.3.2 = OFFICIALLY CLOSED; 6.3.3 = NOT STARTED. Current stop after 6.3.2 / before 6.3.3.**


## توثيق 2026-08-24 — 6.3 two-part merge + Current 6.3.2 Accounting Review implementation

- `docs/CMMS_MAIN_PHASE6_MERGED_STEP6_3_2_INVENTORY_VARIANCE_ACCOUNTING_REVIEW_IMPLEMENTATION_2026-08-24.md` — مرجع تنفيذ التقسيم الجديد والمراجعة المحاسبية Read-only.
- التقسيم الحالي: **6.3.1 = Valuation + Value Distribution (CLOSED)**؛ **6.3.2 = Variance + Accounting Review + Runtime Closure (IMPLEMENTED / VERIFICATION PENDING)**.
- الملف الجديد: `server/services/reports/inventoryAccountingReviewReport.ts`.
- الاختبار الجديد: `server/tests/inventoryAccountingReviewReportPhase6Step3_2Merged.test.ts`.
- الواجهة: تبويب `Accounting Review / المراجعة المحاسبية` داخل `/inventory/reports/valuation`.
- Export: `/api/reports/inventory/valuation/accounting-review.xlsx|pdf|/print`.
- لا تغيير DB/Schema ولا Revaluation/Auto-fix/Backfill/Legacy Cleanup.


## توثيق 2026-08-24 — Current 6.3.2 Runtime UAT + Main Phase 6.3 Official Closure

- `docs/CMMS_MAIN_PHASE6_MERGED_STEP6_3_2_RUNTIME_UAT_AND_PHASE6_3_CLOSURE_2026-08-24.md` — إغلاق الـcheckpoint الثاني بعد نجاح الاختبار المستهدف 6/6 وقبول Runtime UAT.
- التقسيم الحالي يبقى: **6.3.1 = Valuation + Value Distribution (OFFICIALLY CLOSED)**؛ **6.3.2 = Variance + Accounting Review + Runtime Closure (OFFICIALLY CLOSED)**.
- Runtime confirmed: Accounting Review page/tab + search + warehouse + value-status + category + review-status filters + Excel/PDF/Print.
- المراجعة تبقى Read-only وتعيد استخدام 6.3.1 stored `totalCostValue` + 5.4 reconciliation evidence؛ لا Revaluation/Auto-fix/Backfill/Legacy Cleanup.
- **Main Phase 6.3 = COMPLETE / OFFICIALLY CLOSED.**
- **Current stop: after Main Phase 6.3 official closure. 6.4 remains DOCUMENTED FOR LATER / EXECUTE LAST / NOT STARTED; 6.5 = NOT STARTED. Do not start either automatically.**

### Main Phase 6.4 — Inventory Analytics & Planning — implementation checkpoint (2026-08-24)

- `docs/CMMS_MAIN_PHASE6_STEP6_4_INVENTORY_ANALYTICS_PLANNING_IMPLEMENTATION_2026-08-24.md` — implementation scope, analytics semantics, safety boundaries, targeted test command, and required Runtime UAT. Current status: implemented in code / verification pending.

### Main Phase 6.4 — Inventory Analytics & Planning — Runtime UAT Closure (2026-08-24)

- `docs/CMMS_MAIN_PHASE6_STEP6_4_INVENTORY_ANALYTICS_PLANNING_RUNTIME_UAT_CLOSURE_2026-08-24.md` — official closure after targeted Vitest **8/8 PASS** and owner Runtime acceptance.
- Runtime owner confirmation: filters + export + Print work correctly.
- Turnover remains a planning indicator only; no formal accounting COGS/Average Inventory claim or historical reconstruction.
- **Status: Main Phase 6.4 = COMPLETE / OFFICIALLY CLOSED. Main Phase 6.5 = NOT STARTED.**
- **Current stop: after 6.4 official closure / before 6.5. Do not start 6.5 automatically.**


### Main Phase 6.5 — Final Runtime UAT & Closure Gate (2026-08-24)

- `docs/CMMS_MAIN_PHASE6_STEP6_5_FINAL_RUNTIME_UAT_CLOSURE_GATE_2026-08-24.md` — final regression/UAT gate after 6.1–6.4 official closures; no new feature or DB/accounting/workflow change.
- Targeted final gate: `server/tests/mainPhase6FinalClosurePhase6Step5.test.ts`.
- **Status:** 6.5 = IN PROGRESS / final regression + owner Runtime acceptance pending. Main Phase 6 remains IN PROGRESS until accepted.


### Main Phase 6.5 / Main Phase 6 Final Runtime UAT & Official Closure (2026-08-24)

- `docs/CMMS_MAIN_PHASE6_FINAL_RUNTIME_UAT_AND_OFFICIAL_CLOSURE_2026-08-24.md` — final accepted closure record for Main Phase 6.
- Final regression gate: `server/tests/mainPhase6FinalClosurePhase6Step5.test.ts` = **9/9 PASS / 1 file passed** after correction of test-only false-positive keyword checks.
- Runtime: cleaned five-card Reports Center accepted; owner confirmed all five cards open and work.
- Main Phase 6 report services remain Read-only; stored `totalCostValue` valuation basis remains unchanged; no Revaluation/Auto-fix/Backfill/Cleanup.
- Centralized Numbering remains deferred; no project `receipt_number_counter`; Batch Transfer remains per-item/partial-result.
- **6.5 = OFFICIALLY CLOSED. Main Phase 6 = COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED.**
- **Current stop: after Main Phase 6 official closure / before Main Phase 7 — Inventory Posting Engine.**


## توثيق 2026-08-24 — Main Phase 7 Deferral + Future Option B Shared Posting Core

- `docs/CMMS_MAIN_PHASE7_DEFERRAL_AND_OPTION_B_SHARED_POSTING_CORE_DECISION_2026-08-24.md` — قرار صاحب المشروع بعد إغلاق Main Phase 6: **تأجيل Main Phase 7 الآن وعدم بدء Coding**.
- عند العودة مستقبلًا، الاتجاه المعتمد هو **Option B — Shared Posting Core صغير ومحافظ** بدل Full Centralized Inventory Posting Engine.
- Business Rules وسياسات التكلفة تبقى داخل Receipt/Issue/Return/Transfer/Disposal/Settlement المتخصصة؛ الـCore يقتصر على primitives مشتركة ذات فائدة واضحة.
- Batch Transfer يبقى per-item/partial success؛ Centralized Numbering و`receipt_number_counter` يبقيان مؤجلين؛ لا Historical Cleanup/Backfill/Revaluation/Renumbering ولا Cutover ولا Workflow/Accounting redesign تلقائيًا.
- **Main Phase 7 = DEFERRED / NOT STARTED. Main Phase 8 = NOT STARTED / DO NOT AUTO-START.**

## توثيق 2026-08-24 — Main Phase 8 Optional Operational Enhancements Decision

- `docs/CMMS_MAIN_PHASE8_OPTIONAL_OPERATIONAL_ENHANCEMENTS_DECISION_2026-08-24.md` — قرار صاحب المشروع بأن Main Phase 8 **لا تُنفذ كمرحلة كاملة إلزامية**.
- Main Phase 8 أصبحت **DEFERRED / OPTIONAL / NOT STARTED**: قائمة Candidates تشغيلية وليست Scope تنفيذ تلقائي.
- كل عنصر يحتاج تقييم `Need / Don't Need` ومناقشة أثر وموافقة صريحة مستقلة قبل Coding/SQL/Workflow change.
- الـWorkflow الحالي يبقى كما هو افتراضيًا؛ لا Maker/Checker/Approvals/In-Transit/Rack-Bin/Planning policies تلقائيًا.
- لا Centralized Numbering، ولا Batch Transfer all-or-nothing، ولا Historical Cleanup/Backfill/Revaluation/Renumbering، ولا Cutover ضمن هذا القرار.
- **Main Phase 8 تبقى آخر Main Phase اسمًا في الـRoadmap، لكنها ليست Gate إلزامية يجب تنفيذها بالكامل قبل الإغلاق النهائي.**



## توثيق 2026-08-24 — Inventory Module Development & Modernization Current Approved Scope Official Closure

- `docs/CMMS_INVENTORY_MODULE_DEVELOPMENT_MODERNIZATION_CURRENT_SCOPE_OFFICIAL_CLOSURE_2026-08-24.md` — إعلان صاحب المشروع إغلاق بناء وتحديث وحدة المخزون ضمن النطاق الحالي المعتمد.
- **Inventory Module Development & Modernization = COMPLETE / CURRENT APPROVED SCOPE CLOSED.**
- Main Phase 7 تبقى DEFERRED / NOT STARTED باتجاه Option B مستقبلًا فقط إذا اعتُمد الاستئناف.
- Main Phase 8 تبقى DEFERRED / OPTIONAL / NOT STARTED وليست Gate إلزامية.
- Final Project Hardening / Closure وIndependent Inventory Cutover يبقيان خطوتين منفصلتين لاحقتين وغير منفذتين ضمن هذا الإغلاق.
- Documentation-only؛ لا Code/Schema/SQL/Live DB/Workflow/Accounting/Historical-data change.


## توثيق 2026-08-29 → 2026-09-02 — Purchase Packages / Lot Delivery / PR Numbering

- `docs/CMMS_PURCHASE_ORDER_BATCHES_FOUR_PHASE_IMPLEMENTATION_PLAN_2026-08-30.md` — الخطة الأصلية لأربع مراحل، وتم تحديث حالتها في 2026-09-02 لتعكس التنفيذ الفعلي للمراحل 1–4 بدل checkpoint القديم.
- `docs/PURCHASE_ORDER_BATCHES_PHASE1_IMPLEMENTATION_REPORT_2026-08-30.md` — صلاحيات الحزم ونموذج البيانات الأساسي.
- `docs/PURCHASE_ORDER_BATCHES_PHASE2_DELEGATE_UI_IMPLEMENTATION_2026-08-30.md` — شاشة المندوب وإجراءات الصنف والإرسال من الحزمة.
- `docs/PURCHASE_ORDER_BATCHES_PHASE2_ACCOUNTING_IMPLEMENTATION_2026-08-31.md` — اعتماد الحسابات على مستوى Submission وعهدة واحدة للدفعة.
- `docs/CMMS_PURCHASE_PACKAGES_CURRENT_WORKFLOW_REVIEW_AND_RUNTIME_CLOSURE_2026-09-02.md` — المرجع الحالي النهائي لمسار جمع الطلبات في الحزم، اعتماد الحسابات/الإدارة، Runtime UAT، وملاحظات Hardening غير المنفذة.
- `docs/CMMS_LOT_QR_TICKET_DELIVERY_LINK_FIX_2026-09-02.md` — إصلاح استخدام Lot الممسوح كمصدر الحقيقة لربط PO Item/Ticket عند التسليم، مع Live verification.
- `docs/CMMS_PR_NUMBERING_ATOMIC_COUNTER_AND_DUPLICATE_CLEANUP_2026-09-02.md` — Root cause لتكرار PR، تنظيف 11 سجلًا، عداد ذري، UNIQUE guard، واختبار 0471/0472.
- `docs/CMMS_PURCHASE_NUMBERING_ANNUAL_RESET_DEFERRED_2026-09-02.md` — مهمة مؤجلة قبل 2027 لتقرير/تنفيذ Year-aware reset للـPR ومراجعة PB counter، بدون تغيير الإنتاج الآن.
- `docs/CMMS_PURCHASE_PACKAGES_HANDOFF_2026-09-02.md` — Handoff الحالي ونقطة التوقف بعد Railway deployment.

**الحالة الحالية:** Purchase Packages تعمل على Live ضمن Workflow المعتمد؛ PR numbering duplicate issue مغلقة تشغيليًا؛ Annual reset قبل 2027 يبقى DEFERRED.
