# تصميم الشاشات — PM V2

## مبادئ UX

- Mobile/Tablet first للفني.
- أقل كتابة ممكنة.
- حالة واضحة بدون نسخ تفاصيل الأنظمة الأخرى.
- الروابط الخارجية تفتح نفس شاشة/نافذة الوحدة الحالية حيث أمكن.

# الإدارة

## 1. Specialties
إدارة التخصصات والمسؤول/التفعيل.

## 2. Teams
Specialty + Members + Team Warehouse + Device User عند الحاجة.

## 3. Maintenance Targets
اختيار Site أو Section أو Asset من Master Data الحالية.

## 4. Checklists
Template + Items + Recurrence.

## 5. Programs
Optional manager-facing title + Team + Checklist + Targets + activation/schedule metadata.

- عنوان البرنامج اختياري ويظهر كالعنوان الرئيسي عندما يكون موجودًا.
- إذا كان فارغًا يبقى العرض القديم `برنامج #N`.
- رقم البرنامج يبقى ظاهرًا كسطر مرجعي صغير عند وجود عنوان.
- البحث في البرامج يشمل العنوان إضافة إلى الرقم والفريق وقائمة الصيانة.
- العنوان قابل للتعديل حتى بعد توليد المهام لأنه وصف إداري لا يغيّر السجل التشغيلي.

## 6. Monitoring
Tasks حسب الحالة/الفريق/التخصص/Target، مع روابط Material/Ticket/PO عند وجودها.

# الفني

## 7. مهامي اليوم
بطاقات مبسطة: Task number, Target, due, الحالة، Progress.

## 8. تنفيذ Task Item

الخيارات الأساسية:

- **سليم**
- **تم الإصلاح**
- **تحتاج مواد**
- **تحتاج بلاغ صيانة**

مع Note/Image حسب contract.

## 9. تحتاج مواد

- اختيار Catalog Item يتم من **حقل بحث/اختيار واحد (searchable combobox)**؛ يكتب الفني جزءًا من اسم المادة أو الكود فتظهر النتائج مباشرة في نفس القائمة.
- كل نتيجة تعرض اسم المادة، الكود التشغيلي عند توفره، ورصيد مخزن الفريق/الوحدة، مع تعطيل المواد التي لها احتياج فعال أو جاهز للصرف بالفعل.
- مسار **المادة غير الموجودة في الدليل** يبقى إجراءً ثانويًا واضحًا أسفل الباحث ولا ينشئ Master Data من شاشة الفني.
- الكمية والوحدة.
- إذا متوفر في Team Warehouse: استخدام المسار الحالي.
- إذا غير متوفر: إنشاء Material Request للمستودع الرئيسي.
- عرض الحالة البسيطة من PM V2، مع رابط PO عند وجود شراء خارجي.

## 10. تحتاج بلاغ صيانة

- فتح **نفس نافذة إنشاء البلاغ الحالية**.
- بعد الإنشاء يظهر Ticket number/status/link.
- لا تظهر A/B/C كState Machine جديدة داخل PM V2؛ تقرأ من Ticket الحالي.

## 11. جاهز للإكمال

عند زوال تبعية المادة/البلاغ، تظهر المهمة في قائمة **جاهز للإكمال** ليعود الفني ويكمل العمل.

# المستودع

## 12. PM V2 Material Requests

قائمة واضحة لطلبات PM V2:

- Task/Target/Team.
- المواد والكميات.
- متوفر → Warehouse Transfer الحالي.
- غير متوفر → Start/Create PO من مصدر PM V2 إذا الصلاحية Scoped متاحة.
- اختيار المستلم الحقيقي يتم في Workflow التسليم الحالي وقت التسليم، وليس داخل Team Device binding.

### Step 4.2A — Patch 102

- Route مستقل: `/scheduled-maintenance/warehouse-requests` لدور `warehouse` مع `owner/admin` للاختبار/الإدارة؛ لا يفتح شاشة إدارة PM V2 العامة للمستودع.
- Header يوضح Main Warehouse المحلول ديناميكيًا وعدد البنود `waiting_warehouse`.
- كل بطاقة تعرض Request/Request Item، Task number وTask Item، Team، Team Warehouse destination، المادة، الكمية، وهوية Catalog إن وجدت.
- تعرض نتيجة فحص Main Warehouse: **متوفر في المستودع الرئيسي** أو **غير متوفر بالكامل** أو **غير موجود في الدليل**.
- Integrity exceptions تظهر بوضوح بدل قرار كاذب: Catalog غير متاح، أكثر من Inventory identity، أو اختلاف وحدة الصرف عن وحدة الطلب.
- الشاشة تنص صراحة أنها **لا تصرف ولا تحوّل المخزون**؛ زرها التشغيلي الوحيد في هذا Slice هو تحديث/إعادة قراءة الرصيد.

# الروابط الخارجية

## 13. Purchase Order

PO الناتج يظهر في صفحة `purchase-orders` العادية ويملك نفس الوظائف الحالية. PM V2 تعرض PO number/status/link فقط كمصدر متابعة.

## 14. Ticket

Ticket الناتج يظهر ويعمل كشأن أي بلاغ حالي. PM V2 تعرض الرابط والمصدر Task number فقط.

## 15. حمل الفرق — Phase 2 manager view

صفحة إدارية مبسطة داخل `الصيانة المجدولة` لعرض حمل الفرق أسبوعيًا:
- صف لكل فريق فعال وعمود لكل يوم من الأحد إلى السبت.
- كل خلية تعرض فقط: عدد المهام، إجمالي المدة التقديرية، وحالة الحمل (`متاح / متوسط / مرتفع / تعارض`).
- إذا كانت بعض المهام بلا مدة تقديرية تظهر الخلية `مدة ناقصة` بدل إعطاء حالة مكتملة مضللة.
- أزرار بسيطة للتنقل: الأسبوع السابق / هذا الأسبوع / الأسبوع التالي.
- الضغط على خلية فيها مهام يعرض مهام ذلك الفريق في اليوم المختار أسفل الجدول.
- المهام الملغاة لا تدخل في الحمل ولا تفاصيل الخلية؛ المكتملة تبقى جزءًا من سجل حمل ذلك اليوم.
- لا يوجد حجز زمني أو توزيع أفراد في هذه الخطوة؛ العرض يعتمد فقط على المدة التقديرية اليومية المتفق عليها في Phase 2.

### تحسين القراءة التشغيلية — Patch 069
لإبقاء شاشة `حمل الفرق` مفهومة أثناء الاستخدام اليومي بدون تحويلها إلى شاشة فلاتر معقدة:
- الأسبوع الحالي يبقى السياق الأساسي، لكن العرض الافتراضي فيه هو **من اليوم وما بعده**.
- يمكن للمدير التبديل ببساطة إلى **الأسبوع كامل** عند الحاجة لمراجعة الأيام السابقة.
- اليوم الحالي مميز بصريًا، والأيام السابقة تكون باهتة عند عرض الأسبوع كاملًا، بينما الأيام القادمة تبقى واضحة للتخطيط.
- فلتر واحد فقط للفرق: **كل الفرق / فريق محدد**.
- يظهر تنبيه مستقل بعدد المهام المتأخرة (ويتبع فلتر الفريق عند اختياره).
- المهام المتأخرة تبقى بتاريخها الأصلي ولا تُضاف تلقائيًا إلى حمل اليوم؛ مراجعتها تبقى من `المهام المجدولة → المتأخرة`.
- الأسابيع السابقة والقادمة تُعرض كاملة؛ مفهوم **من اليوم وما بعده** يخص الأسبوع الحالي فقط.
- لا تضيف هذه الخطوة إعادة جدولة، أوقات بداية/نهاية، أو توزيع أفراد.

### وصول مباشر للمتأخرات — Patch 070
- تنبيه المهام المتأخرة داخل `حمل الفرق` أصبح عنصرًا قابلًا للضغط بدل أن يكون نصًا إرشاديًا فقط.
- الضغط ينقل مباشرة إلى `المهام المجدولة` مع تفعيل بطاقة/نطاق **المتأخرة**.
- إذا كان المدير قد اختار فريقًا في `حمل الفرق` ينتقل نفس الفريق إلى فلتر المهام، فتظهر متأخرات ذلك الفريق فقط.
- لا تُنقل تواريخ المهام ولا يحدث أي ترحيل تلقائي للحمل؛ التغيير تنقل/فلترة في الواجهة فقط.

### وضوح مدة كل مهمة — Patch 073
- عند الضغط على خلية فريق/يوم، يعرض قسم **مهام اليوم المختار** المدة التقديرية بجانب كل مهمة بصيغة ساعات/دقائق سهلة القراءة.
- إذا لم تكن للمهمة مدة تقديرية، تظهر **غير محددة** بدل افتراض قيمة.
- هذا العرض يفسر بصريًا إجمالي مدة الخلية ولا يغير حساب الحمل أو الجدولة.

## Patch 074 — ترتيب بنود القائمة تلقائيًا
- مدير الصيانة لا يُطلب منه إدخال رقم `الترتيب` عند إضافة بند جديد.
- الإنشاء العادي يحدد الرقم التالي تلقائيًا داخل القائمة.
- القائمة تعرض أرقامًا بشرية متسلسلة تبدأ من `1` حسب موضع البند الحالي، لذلك لا يظهر `0` في واجهة الإدارة حتى لو وُجد سجل اختبار قديم بهذه القيمة داخليًا.
- لا توجد شاشة إعادة ترتيب/سحب وإفلات في هذه الخطوة؛ الهدف فقط إزالة الإدخال اليدوي المربك.

## Patch 076 — صياغة التكرار بلغة مدير الصيانة
- داخل التكرار المخصص تستبدل الواجهة التسميات التقنية `نوع الجدول المخصص` و`كرر كل` بـ **التكرار حسب** و**فترة التكرار**.
- يظهر أسفل الحقول تفسير فوري للمدير، مثل: `2 + أسابيع = كل أسبوعين`، `2 + أشهر = كل شهرين`، و`2 + كل 3 أشهر = كل 6 أشهر`.
- اختيار الربع لا يعرض للمدير صيغة `كل 2 أرباع سنة`; يحولها العرض إلى مدة مفهومة بالأشهر/السنوات (`كل 6 أشهر`, `كل سنة`, ...).
- تظهر ملاحظة بحسب نوع الجدول توضح أن الأسبوع/الشهر/الربع/السنة يمكن أن يحتوي على موعد واحد أو عدة مواعيد داخل دورة التنفيذ.
- ملخص الحفظ وبطاقات بنود القائمة تستخدم نفس اللغة البشرية: `يوميًا`, `كل أسبوع`, `كل شهر`, `كل 3 أشهر`, `كل 6 أشهر`, `سنويًا` مع تفاصيل الأيام/التواريخ.
- لا تتغير بنية `scheduleConfigJson` ولا منطق الاستحقاق؛ هذا تحسين عرض وشرح فقط.


## Patch 077 — أبسط تدفق للتكرار المخصص
- يبقى السؤال الرئيسي **متى يتكرر الفحص؟** مع الخيارات المباشرة المعتادة.
- عند اختيار **مخصص** لا تظهر حقول باسم `التكرار حسب` أو `فترة التكرار`؛ بدلًا منها تُقرأ الإعدادات كجملة واحدة: **يتكرر الفحص كل [رقم] [وحدة]**.
- يظهر تفسير فوري تحت الجملة باسم **النتيجة**، مثل `كل أسبوعين` أو `كل 6 أشهر`.
- بعد ذلك يظهر سؤال منفصل واحد: **متى يتم التنفيذ؟** وتظهر فقط عناصر الاختيار المناسبة للوحدة المختارة.
- تاريخ البداية، عندما يلزم لنمط أكبر من دورة واحدة، يسمى **يبدأ هذا النمط من** بدل أي مصطلح تقني مثل تاريخ الارتكاز.
- بنية التخزين ومنطق الاستحقاق لم يتغيرا؛ هذا تبسيط واجهة فقط.

## Patch 079 — نطاق التشغيل اليدوي للـScheduler
- لوحة **تشغيل الجدولة اليدوي للاختبار** تبدأ باختيار تاريخ التشغيل.
- بعد التاريخ يختار المدير **كل البرامج المستحقة** أو **برنامج محدد**.
- عند اختيار **برنامج محدد** تظهر قائمة تحتوي فقط البرامج المستحقة فعليًا في التاريخ المختار وفق نفس منطق التكرار المستخدم في Scheduler.
- اسم البرنامج الاختياري يظهر في القائمة مع `برنامج #N` كمرجع؛ البرنامج بلا عنوان يظهر بالمرجع فقط.
- إذا لم توجد برامج مستحقة يظهر نص واضح **لا توجد برامج مستحقة في هذا التاريخ** ويكون زر التشغيل غير متاح.
- هذا النطاق خاص بالتشغيل اليدوي/الاختبار؛ التشغيل التلقائي الإنتاجي يبقى يفحص كل البرامج المستحقة كالمعتاد.

## Patch 103 — هوية الصنف التشغيلية في طابور المستودع
- بطاقة طلب المادة المعروفة في Catalog تعرض **اسم الصنف** ثم **كود الصنف** من `catalog_items.code`، وليس `catalogItemId` الداخلي لقاعدة البيانات.
- تعرض البطاقة **التصنيف** كمسار كامل من شجرة `catalog_nodes` حتى عقدة الصنف، بصيغة عربية مثل `الجذر › الفرع › التصنيف`.
- `catalogItemId` يبقى مرجعًا تقنيًا داخليًا للربط ولا يظهر للمستخدم بصيغة `Catalog #...`.
- المادة غير الموجودة في الدليل تبقى صريحة كـ **غير موجودة في الدليل**؛ لا يعرض لها النظام كودًا أو تصنيفًا وهميًا.
- هذا تحسين قراءة فقط؛ لا يضيف Transfer أو PO أو تغيير مخزون/حالة.

## Step 4.2B UI — Patch 105 — CLOSED / PASS after Patch 108

بطاقة طلب المادة المعروفة في شاشة المستودع تعرض الآن:
- **احتياج المهمة**: إجمالي ما طلبه الفني في Step 4.1.
- **المتاح في مخزن الفريق وقت الطلب**: Snapshot الرصيد الذي بُني عليه قرار النقص.
- **المطلوب من المستودع الرئيسي**: مقدار النقص الذي أنشئ له Material Request Item.
- **المتبقي للتحويل**: ما لم يُغطَّ بعد من ذلك الطلب.
- **المتاح في الرئيسي الآن**: قراءة حية منفصلة من Inventory/Lots.
- مخزن الفريق المستهدف.

القابل للتحويل الآن لا يحتاج سطرًا منفصلًا في البطاقة؛ يظل محسوبًا Server-side كالأقل من المتبقي والمتاح ويظهر في زر **بدء تحويل المتاح — [الكمية]**.

يظهر إجراء **بدء تحويل المتاح** فقط عندما تكون هوية Catalog سليمة ويوجد مقدار قابل للتحويل > 0. الإجراء يعيد الفحص Server-side ثم يفتح Warehouse Transfer الحالي؛ لا ينفذ Stock mutation داخل PM V2. حالات `0 available` و`unlisted` تبقى بدون Transfer action.

شراء العجز، زيادة كمية الشراء للمخزون العام، Receiving، وربط الكمية المستلمة مؤجلة إلى Slice شراء لاحق وليست جزءًا من 4.2B.


في Warehouse Transfer عند وجود سياق PM V2:
- المصدر والهدف مقفلان على Main → Team Warehouse، والصنف مقيد بالـInventory الذي أعاده الخادم.
- تظهر بطاقة مرجع PM V2 والكمية القصوى لهذا handoff.
- يمكن توزيع الكمية على أكثر من Lot عند تفعيل Lots، دون تجاوز السقف الكلي.
- بعد نجاح أي حركة فعلية، يمنع نفس السياق من تنفيذ Transfer ثانٍ قبل العودة للطابور وإعادة الفحص.
- إذا فشل ربط PM V2 بعد نجاح المخزون، تظهر **إعادة ربط التحويل بطلب PM V2**؛ هذه لا تعيد Stock movement.


في شاشة Warehouse Transfer عند الدخول من PM V2:
- يظهر مرجع المهمة وطلب المادة والكمية القصوى لهذا handoff.
- المصدر والوجهة مقيدان بسياق الطلب، والصنف مقيد ببطاقة Inventory التي أعاد الخادم فحصها.
- يمكن تقسيم الكمية على أكثر من Lot/QR، لكن مجموع Cart لا يتجاوز `transferableNow`.
- بعد نجاح الحركة يظهر تنبيه يطلب الرجوع إلى طابور PM V2 وإعادة الفحص قبل أي تحويل تالٍ.
- إذا فشل ربط PM V2 بعد نجاح الحركة تظهر **إعادة ربط التحويل بطلب PM V2** بدون إعادة التحويل.

## Technician material Catalog picker — Patch 143 implemented
- Full-Catalog search remains available by **name and item code**.
- The no-search state is now a **smart default list**: usable Team-Warehouse stock first, then real same-target / same-Team PM V2 usage evidence, then general Catalog fill.
- Each result exposes **material name, operator item code, Catalog taxonomy path, and current Team-Warehouse balance**.
- No specialty hard-filter or inferred specialty/category relationship is introduced.
- Existing duplicate-state labels and blocking remain authoritative.
- No SQL/schema and no external workflow mutation.


## Phase 4 Team-Warehouse Issue/Delivery UI — Patch 109
- Existing **المخزون → تسليم للفني** dialog remains the physical issue screen; no PM V2 delivery screen was duplicated.
- For `warehouse | owner | admin`, the dialog loads matching PM V2 material needs for the exact Inventory identity and offers **ربط الصرف باحتياج PM V2 (اختياري)**.
- Selecting a PM V2 need shows task number/title, full required quantity, actual usage already traced, and server-derived `issuableNow`; it limits the recipient list to active technicians in the task Team.
- The normal Lot QR/manual Lot lookup and Issue Cost Allocation controls remain unchanged and mandatory according to current Inventory rules.
- If the real Delivery succeeds but PM V2 trace linking fails, the page shows a persistent-in-session warning with the Delivery number and **إعادة ربط PM V2 فقط**; the operator is explicitly told not to repeat the physical issue.
- Without selecting a PM V2 need, existing general Inventory delivery behavior remains unchanged.

## Patch 114 — Technician Team-Warehouse self-service receipt UX

In **مهامي اليوم → تحتاج مواد**:

- Listed material with full Team-Warehouse availability shows **استلام المواد من مخزن الفريق**.
- The action opens a small confirmation containing material, quantity, and Team Warehouse. Confirming posts the real issue through the current Inventory/Delivery workflow and uses the logged-in technician as the actual recipient.
- If the need has a shortage, the action reads **تسجيل الاحتياج وطلب النقص**. The preview continues to show requested / available / shortage, and no default partial issue is posted.
- After a shortage has physically reached the Team Warehouse and the full remaining need becomes available, the existing material card changes to **جاهز للاستلام من مخزن الفريق** with the same receipt action.
- Multi-Lot allocation stays automatic and is only summarized to the technician; no Lot selection or QR scanning is added to the PM V2 technician screen.
- Unlisted material keeps its existing warehouse-review path and does not receive self-service stock behavior.

## Patch 115 — Warehouse shortage card and Purchase handoff

### `طلبات مواد PM V2`
A waiting shortage card must show separate operator-facing quantities, not collapse them into one number:
- **احتياج المهمة** — original technician need from the route-decision snapshot.
- **المتاح في مخزن الفريق وقت الطلب** — snapshot at routing time.
- **النقص المسجل على المهمة** — Material Request Item quantity sent to Main Warehouse.
- **المتبقي المطلوب تغطيته** — shortage not yet transferred to Team Warehouse.
- **المتاح في الرئيسي الآن** — live Inventory/Lot availability.

Actions:
- full remaining shortage available in Main → **تحويل النقص إلى مخزن الفريق — X**;
- Main cannot fully cover → **إنشاء طلب شراء للعجز — Y**, where `Y` is only the currently uncovered amount after live Main stock and active linked-purchase coverage;
- a linked in-flight purchase covering the gap → show the PO reference and suppress duplicate purchase action.

The full task need must not appear in the ready issue/receipt section while its shortage request is still waiting. After the shortage reaches Team Warehouse, Patch 114 technician self-service becomes the normal receipt action.

### Existing Purchase Order page
When opened from PM V2 shortage context, the first item is prefilled/locked to the Catalog identity and minimum required purchase units. The buyer may increase quantity for general stock. After create/save, PM V2 links only the needed shortage portion to the authoritative PO Item; all Purchase approvals and Receiving remain unchanged.

## Purchase screen — PM V2 linked mode (Patch 117)

When `/purchase-orders/new` is launched with valid PM V2 shortage context, the existing Purchase screen shows a dedicated reference card:
- badge: **مرتبط بمهمة صيانة مجدولة PM V2**;
- maintenance Task Number and PM V2 material request/item references;
- reason: **عجز مواد صيانة مجدولة**;
- linked Catalog item/code;
- total task need and Team-Warehouse stock-at-request snapshot when available;
- exact quantity to purchase.

In this mode the Catalog item and exact shortage quantity are locked, the resolved unit follows Patch 116 locking/fallback rules, and **إضافة صنف** is hidden. Outside PM V2 linked mode, the Purchase screen keeps its existing multi-item behavior unchanged.

## Purchase Order Detail — PM V2 existing-order relink (Patch 119)

When an existing Purchase Order contains the standard PM V2 reference (`طلب مواد #... / بند #...`) and exactly one active Catalog item, the detail page shows a PM V2 reference card with **ربط / إعادة ربط PM V2**.

The action links the already-created Purchase Order Item to the PM V2 shortage through the existing idempotent PM V2 endpoint. It does not create/save/submit another Purchase Order. Repeating the action after a successful link is safe and returns the existing link.

## Patch 134 — Technician persistent material attention

In **مهامي اليوم**, a new block appears above normal task cards whenever material needs still require the logged-in technician's attention:

- title: **مواد تحتاج انتباهك**;
- total attention count and ready-to-receive count;
- status badge for identity / warehouse / purchase / transfer / ready state;
- material name and Catalog code when resolved;
- original unlisted name when identity was resolved later;
- task reference and Task Item title;
- material quantities relevant to the route;
- **فتح المهمة** action;
- **استلام المواد من مخزن الفريق** when ready, followed by confirmation.

The block refreshes automatically every 60 seconds. Ready receipt is displayed before passive waiting states so actionable material does not disappear among many tasks.

## Patch 135 — Technician shortage-progress labels

The Patch 134 attention card now separates historical shortage from current supply progress:

- **المطلوب** — total task material need;
- **المتوفر في مخزن الفريق عند آخر تقييم** — routing/identity evaluation context;
- **النقص عند التسجيل** — original shortage captured by PM V2;
- **المتبقي من النقص** — current shortage still not issued/transferred into Team Warehouse;
- **وصل للمستودع الرئيسي** — confirmed warehouse receipt quantity when present;
- **حُوّل لمخزن الفريق** — confirmed issued/transferred quantity when present;
- **تم استكمال النقص لمخزن الفريق** — shown when the original shortage has been fully supplied to Team Warehouse.

The material selector also blocks a Catalog material that is already active through a warehouse-resolved identity, not only a request that originally carried that Catalog ID.

## Patch 136 — `scheduled-maintenance/warehouse-requests` visual organization

The warehouse page keeps all pre-existing information and actions, but presents them in one operational sequence:

1. **ملخص عمل المستودع** — Main Warehouse + waiting count + ready-to-issue count + pending-return count.
2. **طلبات تحتاج معالجة المستودع** — action-required queue first.
3. **مواد PM V2 الجاهزة للصرف للمهمة** — issue queue second.
4. **مرتجعات PM V2 المعلقة** — returns third.
5. The existing **PM V2 لا ينفذ حركة مخزون بنفسه** architecture notice remains visible after the operational sections.

Waiting-request cards are visually grouped into **الكميات**, **المخزون والوجهة**, **تفاصيل الطلب والحالة**, linked Purchase context, and **الإجراء**. No field or action from the Patch 115/119/131/135 warehouse flow is removed.

Ready issue retains requester, Team, quantities, target, Lot allocation, recipient selection, Delivery relink recovery, and issue action. Returns retain all issued/used/remaining values, prior recipient, single/multi-Lot handling, and confirmation.

## Patch 137 — `scheduled-maintenance/warehouse-requests` tabs + progressive details

Patch 137 keeps every Patch 136 field and action but reduces what is visible simultaneously.

Above the operational work, **ملخص عمل المستودع** remains unchanged. Below it, the operator switches between exactly three work tabs:

- **تحتاج معالجة** — default;
- **جاهزة للصرف**;
- **المرتجعات**.

Only the selected section is displayed at a time. The count for each queue remains visible on its tab.

Within each selected section, the existing card header remains visible while the detailed body starts collapsed. The operator expands it through **عرض التفاصيل والإجراء**, **عرض التفاصيل والصرف**, or **عرض التفاصيل والاستلام** and can collapse it again with **إخفاء التفاصيل**.

All Patch 136 quantity, inventory, request/status, Purchase, Transfer, issue/relink, recipient, Lot, and return content remains available after expansion. The PM V2 stock-ownership notice also remains visible.

## Patch 138 — شاشة الفني: استكمال العمل ومسار المهمة

داخل المهمة المختارة في `Pmv2MyTasks`:
- البند `ready_to_complete + needs_material` يعرض **استكمال العمل** بدل محاولة الإغلاق بدون Visit مفتوحة؛
- الاستكمال يبقى لنفس Task ويعيد البند إلى `in_progress` ثم يستخدم نموذج الاستخدام/المرتجع الحالي؛
- بطاقة **مسار المهمة والزمن** تعرض المسؤول الحالي، الجهة، الشخص إن كان معينًا، ووقت بدء المرحلة؛
- تعرض ملخص عمر المهمة، التنفيذ الفعلي، انتظار المواد، انتظار البلاغ، وفترة جاهزية المادة قبل الاستئناف؛
- التفاصيل القابلة للفتح تعرض الوقت حسب الجهة/المسؤول، مدد المراحل، والخط الزمني للأحداث.

لا تعرض الشاشة حكم "متأخر"؛ هذا يتطلب SLA لاحقًا.

## PATCH139 — Scheduled Maintenance / متابعة المعلق

New management tab: **متابعة المعلق**.

Manager surface:
- open task count / dependency-blocked count / SLA breach count / average age;
- task table with reason, stage, responsible role/person, elapsed current responsibility, age and SLA;
- filters by text, role, person, team and SLA;
- Timeline drill-down with stage segments and time by role/person.

Owner/Admin additions:
- current bottleneck roles;
- current responsible people;
- teams with most open tasks;
- assets with most open tasks;
- execution vs non-execution time summary.

SLA/alerts section:
- per-role SLA hours;
- per-role reminder hours;
- enable/disable;
- manual **فحص التنبيهات الآن** action.

## PATCH140 — Manager pending-work priority presentation

`ScheduledMaintenance > متابعة المعلق` now presents daily manager work in this order:

1. summary: **المهام المعلقة / تحتاج تدخلك الآن / تجاوز SLA / أقدم تعليق**;
2. **تحتاج تدخلك الآن** — current role is Maintenance Manager or SLA is explicitly overdue;
3. **معلقة وتحت الإجراء** — remaining open work;
4. **عرض المسار** — full PATCH139/PATCH138 Timeline and duration details;
5. owner indicators when role permits;
6. collapsed **إعدادات SLA والتذكيرات**.

Each task card retains the previous table facts: reason/status, stage, responsible role/person, current elapsed time, task age, SLA and Timeline action. Text search stays visible; role/person/team/SLA filters remain under **بحث وفلاتر متقدمة**.

## تقارير الصيانة المجدولة — PATCH141
Route: `/scheduled-maintenance/reports`

Management report screen contains:
- Date / Team / Technician filters.
- Daily assignment-vs-execution summary.
- Completed today / worked but pending / not started / carry-over sections.
- Technician notes on each task.
- Current blocking role/person for open tasks.
- Item status/result details and PATCH138 Timeline drill-down.
- Open-Visit warning for daily close review.

## PATCH142 — Report review + richer management indicators
`/scheduled-maintenance/reports`:
- when a team is selected, shows **تمت المراجعة / لم تتم المراجعة**;
- records reviewer, review timestamp and optional management note;
- review is recorded only from the whole-team view, not a technician-filtered subset.

Owner/Admin PM V2 monitoring additionally shows:
- open workload by specialty and status;
- average current wait by responsible role;
- 30-day scheduled completion counts/rates by specialty and team.
