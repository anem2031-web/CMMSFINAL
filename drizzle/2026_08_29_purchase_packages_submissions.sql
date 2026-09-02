-- ============================================================
-- استئناف ميزة حزمة طلبات الشراء (PB) — الأجزاء الجديدة فقط
-- Date: 2026-08-29
--
-- خلفية: جدول purchase_packages وعمودا purchase_orders.packageId /
-- po_pricing_batches.packageId موجودون فعليًا بقاعدة البيانات منذ
-- 2026-08-26 (محاولة سابقة لنفس الميزة، أُزيل كودها من المستودع وقتها
-- بينما بقيت القاعدة كما هي). بتاريخ 2026-08-29 تم:
--   1) تصفير purchase_orders.packageId على 7 طلبات حقيقية كانت متأثرة.
--   2) حذف الصفوف الثلاثة التجريبية من purchase_packages.
--   3) التأكد أن po_pricing_batches.packageId = 0 صفوف مستخدَمة أصلًا
--      (التنفيذ القديم لم يصل لمستوى تسعير المندوب عبر الحزمة).
--
-- هذه الهجرة تضيف فقط ما هو مفقود فعليًا لاستئناف العمل — لا تُنشئ من
-- جديد أي جدول أو عمود أو فهرس موجود بالفعل (idx_purchase_orders_
-- packageId و idx_po_pricing_batches_packageId موجودان ومُتحقَّق منهما).
-- ============================================================

-- 1) عدّاد ترقيم مستقل للحزمة — جديد بالكامل، لم يكن موجودًا بالتنفيذ
--    السابق (الأرقام PB-2026-0000X القديمة أُنشئت بطريقة غير موثقة/غير
--    آمنة للتزامن، ولا داعي لإعادة استخدامها). نفس نمط
--    ticket_number_counter المعتمد بالمشروع.
CREATE TABLE IF NOT EXISTS `purchase_package_number_counter` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `year`      INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- 2) الدفعة الفرعية — تتبّع إرسال واحد من المندوب قد يضم أصنافًا من عدة
--    طلبات داخل نفس الحزمة (مثال: PB01-1 ثم PB01-2 لاحقًا للأصناف
--    الباقية). جديدة بالكامل — مستوى لم يصل إليه التنفيذ السابق أصلًا.
--    عرضي بحت للتتبّع والمستندات — لا يُستخدم كمفتاح في أي منطق اعتماد.
CREATE TABLE IF NOT EXISTS `purchase_package_submissions` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `purchasePackageId` INT NOT NULL,
  `subNumber`         INT NOT NULL,
  `createdById`       INT NOT NULL,
  `createdAt`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_package_submissions_uq` (`purchasePackageId`, `subNumber`)
) ENGINE=InnoDB;

CREATE INDEX `purchase_package_submissions_pkg_idx`
  ON `purchase_package_submissions` (`purchasePackageId`);

-- 3) ربط دفعة التسعير الحالية (طلب واحد) بالدفعة الفرعية التي أُرسلت
--    ضمنها — عمود جديد بالكامل، منفصل عن packageId الموجود أصلًا على
--    نفس الجدول (packageId يربط دفعة التسعير بالحزمة العليا مباشرة —
--    غير مستخدَم اليوم؛ هذا العمود الجديد يربطها بإرسال فرعي محدد داخل
--    تلك الحزمة). صفر تعديل على أي عمود أو منطق قائم آخر بالجدول.
ALTER TABLE `po_pricing_batches`
  ADD COLUMN `purchasePackageSubmissionId` INT NULL AFTER `packageId`;

CREATE INDEX `po_pricing_batches_submission_idx`
  ON `po_pricing_batches` (`purchasePackageSubmissionId`);

-- ============================================================
-- اختبار التراجع الحاسم بعد التنفيذ (يجب أن ينجح):
--   UPDATE purchase_orders SET packageId = NULL;
--   → يجب أن يعيد كل شاشات النظام لعرض الطلبات مفردة كسلوك اليوم حرفيًا.
--
-- التراجع الكامل (Rollback) عند الحاجة فقط — لا يحذف purchase_packages
-- ولا عمودي packageId الأصليين لأنهما أقدم من هذه الهجرة:
--   ALTER TABLE `po_pricing_batches` DROP COLUMN `purchasePackageSubmissionId`;
--   DROP TABLE `purchase_package_submissions`;
--   DROP TABLE `purchase_package_number_counter`;
-- ============================================================
