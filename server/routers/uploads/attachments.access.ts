/**
 * ══════════════════════════════════════════════════════════════════════════
 * التحقق من صلاحية الوصول للمرفقات حسب نوع الكيان المرتبط بها
 * ══════════════════════════════════════════════════════════════════════════
 *
 * الخلفية: كان `attachments.list`/`attachments.add` يستقبلان `entityType`
 * كنص حر و`entityId` كرقم، بدون أي تحقق من علاقة المستخدم بالكيان — أي مستخدم
 * مسجّل دخول يقدر يستعرض/يرفع مرفقات لأي كيان بمجرد تخمين الرقم (IDOR).
 *
 * المبدأ المطبَّق هنا:
 *  1. **قائمة سماح صريحة (Allowlist)** لأنواع الكيانات المدعومة فعليًا — أي
 *     نوع غير مذكور يُرفض (Default Deny). هذا وحده يمنع كتابة مرفقات بأنواع
 *     كيانات عشوائية غير موجودة أصلًا بالنظام.
 *  2. **فحص ملكية لكل نوع** بما يطابق **بالضبط** قواعد الوصول الخاصة بوحدة
 *     ذلك الكيان نفسها — لا أشد ولا أضعف.
 *
 * `catalog_item` بيانات مرجعية مشتركة للقراءة داخل بعض الـworkflows، لكن الكتابة
 * على مرفقاته تعتبر إدارة Master Data. وفق سياسة 2B-10 لا يسمح بالكتابة إلا
 * للمالك/الأدمن والأدوار المخوّلة بإدارة الكتالوج نفسه، بما فيها المستودع.
 * يجب أن تبقى صلاحية صورة الصنف متطابقة مع صلاحية إنشاء/تعديل الصنف حتى لا ينجح
 * حفظ الـMaster Data ثم يفشل ربط الصورة لنفس المستخدم.
 *
 * `improvement_idea` و`ticket` على النقيض: وحدتاهما تفرضان فعليًا قيود ملكية
 * حقيقية، فكان تجاوزهما عبر المرفقات ثغرة حقيقية — وكلاهما مُغلَق الآن هنا
 * بتكرار قاعدة كل وحدة حرفيًا.
 * (ملاحظة: قيد `ticket` أُضيف بتاريخ 2026-07-28 بعد إغلاق `tickets.getById`
 *  نفسها مباشرةً — قبل ذلك كانت وحدة التذاكر مفتوحة فلم يكن للتشديد هنا معنى.)
 */

import { TRPCError } from "@trpc/server";
import * as ideasDb from "../../services/improvement-ideas/improvementIdeas";
import * as db from "../../_core/db";
import { assertTicketReadable, isTicketReadOnlyForUser } from "../tickets/tickets.access";
import { APP_ROLE, MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "../../../shared/roles";
import { assertPmv2ItemActionEvidenceAccess } from "../../pmv2/technician/evidence-access";

/** نفس القائمة المستخدمة بـimprovement-ideas.router.ts حرفيًا */
const IDEA_FULL_VISIBILITY_ROLES = [
  "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "senior_management", "executive_director", "owner", "admin",
];

/** أنواع الكيانات المدعومة فعليًا للمرفقات — أي نوع آخر يُرفض (Default Deny) */
export const ALLOWED_ATTACHMENT_ENTITY_TYPES = [
  "ticket",
  "improvement_idea",
  "catalog_item",
  "pmv2_item_action",
] as const;

export type AttachmentEntityType = (typeof ALLOWED_ATTACHMENT_ENTITY_TYPES)[number];

interface AttachmentAccessUser {
  id: number;
  role: string;
}

/**
 * يتحقق من أن المستخدم يملك صلاحية الوصول لمرفقات هذا الكيان، ويرمي
 * FORBIDDEN/BAD_REQUEST عند الرفض. يُستدعى من list() و add() معًا.
 */
export async function assertCanAccessAttachments(
  user: AttachmentAccessUser,
  entityType: string,
  entityId: number,
  mode: "read" | "write" = "read"
): Promise<void> {
  if (!ALLOWED_ATTACHMENT_ENTITY_TYPES.includes(entityType as AttachmentEntityType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "نوع الكيان غير مدعوم للمرفقات",
    });
  }

  if (entityType === "improvement_idea") {
    const idea = await ideasDb.getImprovementIdeaById(entityId);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });

    const hasFullVisibility = IDEA_FULL_VISIBILITY_ROLES.includes(user.role);
    if (!hasFullVisibility && (idea as any).submittedById !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "لا يمكنك الاطلاع على مرفقات مقترحات الآخرين",
      });
    }
  }

  if (entityType === "catalog_item" && mode === "write") {
    const catalogManagers = [
      APP_ROLE.OWNER,
      APP_ROLE.ADMIN,
      APP_ROLE.MAINTENANCE_MANAGER,
      APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
      APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
      APP_ROLE.WAREHOUSE,
    ];
    if (!catalogManagers.includes(user.role as any)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لتعديل مرفقات أصناف الكتالوج" });
    }
  }

  if (entityType === "pmv2_item_action") {
    try {
      await assertPmv2ItemActionEvidenceAccess(user, entityId, mode);
    } catch (error: any) {
      throw new TRPCError({
        code: error?.message?.includes("غير موجود") ? "NOT_FOUND" : "FORBIDDEN",
        message: error?.message || "ليس لديك صلاحية الوصول إلى دليل تنفيذ PM V2",
      });
    }
    return;
  }

  if (entityType === "ticket") {
    const ticket = await db.getTicketById(entityId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(user, ticket as any, "لا يمكنك الاطلاع على مرفقات هذا البلاغ");
    // البلاغ الإنشائي المحوّل إلى المدير قابل للإدارة؛ أما الاستثناء القادم من
    // طلب شراء مرتبط ببلاغ عام فيبقى للقراءة فقط.
    if (mode === "write" && isTicketReadOnlyForUser(user, ticket as any)) {
      // في النموذج الجديد قد تكون الإنشاءات جهة ثانوية، وبالتالي لا تنعكس على
      // أعمدة رأس البلاغ التي يفحصها الحارس المتزامن القديم. السماح هنا ضيق:
      // فقط مدير الإنشاءات المعيّن فعليًا كمسؤول للجهة على هذا البلاغ.
      const managesConstructionDepartment =
        user.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER &&
        await db.hasTicketDepartmentAssignment(
          ticket.id,
          MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
          user.id,
        );
      if (!managesConstructionDepartment) {
        throw new TRPCError({ code: "FORBIDDEN", message: "البلاغ المرتبط متاح للعرض فقط" });
      }
    }
  }

  // catalog_item: القراءة مرجعية مشتركة؛ الكتابة تطابق أدوار إدارة الكتالوج نفسها.
}
