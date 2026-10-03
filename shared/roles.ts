/**
 * Central role codes and role families used by both client and server.
 *
 * The two split maintenance roles intentionally start from the legacy
 * maintenance_manager capability set, then exclude only the modules defined
 * below. Keep module-specific allow/deny decisions here instead of scattering
 * string comparisons across the application.
 */
export const APP_ROLE = {
  USER: "user",
  ADMIN: "admin",
  OWNER: "owner",
  OPERATOR: "operator",
  TECHNICIAN: "technician",
  IT_MANAGER: "it_manager",
  MAINTENANCE_MANAGER: "maintenance_manager",
  GENERAL_MAINTENANCE_MANAGER: "general_maintenance_manager",
  CONSTRUCTION_PROCUREMENT_MANAGER: "construction_procurement_manager",
  SUPERVISOR: "supervisor",
  PURCHASE_MANAGER: "purchase_manager",
  PURCHASE_REQUESTER: "purchase_requester",
  DELEGATE: "delegate",
  ACCOUNTANT: "accountant",
  SENIOR_MANAGEMENT: "senior_management",
  EXECUTIVE_DIRECTOR: "executive_director",
  WAREHOUSE: "warehouse",
  GATE_SECURITY: "gate_security",
  FOOD_WAREHOUSE_MANAGER: "food_warehouse_manager",
  FOOD_WAREHOUSE_ASSISTANT: "food_warehouse_assistant",
} as const;

export type AppRole = (typeof APP_ROLE)[keyof typeof APP_ROLE];

/** PM V2 scoped roles. Keep technician execution separate from management. */
export const PMV2_MANAGEMENT_ROLES = [
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
] as const;

export const PMV2_TECHNICIAN_EXECUTION_ROLES = [
  APP_ROLE.TECHNICIAN,
  APP_ROLE.IT_MANAGER,
] as const;

/** Phase 4 warehouse queue is separate from PM V2 management and technician execution. */
export const PMV2_WAREHOUSE_ROLES = [
  APP_ROLE.WAREHOUSE,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
] as const;

export function canRoleManagePmv2(role?: string | null): boolean {
  return !!role && (PMV2_MANAGEMENT_ROLES as readonly string[]).includes(role);
}

export function canRoleExecutePmv2Technician(role?: string | null): boolean {
  return !!role && (PMV2_TECHNICIAN_EXECUTION_ROLES as readonly string[]).includes(role);
}

export function canRoleAccessPmv2Warehouse(role?: string | null): boolean {
  return !!role && (PMV2_WAREHOUSE_ROLES as readonly string[]).includes(role);
}

/** Standalone Catalog module access approved in 2B-10. */
export const CATALOG_MODULE_ROLES = [
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.WAREHOUSE,
] as const;

export function canRoleAccessCatalogModule(role?: string | null): boolean {
  return !!role && (CATALOG_MODULE_ROLES as readonly string[]).includes(role);
}

export function isCatalogAdminRole(role?: string | null): boolean {
  return role === APP_ROLE.OWNER || role === APP_ROLE.ADMIN;
}

/**
 * تعطيل/إعادة تفعيل أصناف الكتالوج (isActive toggle): كان مقصوراً على
 * Owner/Admin فقط. وُسِّع ليشمل مدير الصيانة والمستودع أيضاً، دون منحهما
 * بقية صلاحيات catalogAdmin (settings, import/export, حذف تصنيفات/وحدات).
 */
export const CATALOG_ITEM_LIFECYCLE_ROLES = [
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.WAREHOUSE,
] as const;

export function canManageCatalogItemLifecycle(role?: string | null): boolean {
  return !!role && (CATALOG_ITEM_LIFECYCLE_ROLES as readonly string[]).includes(role);
}

/**
 * Stable, globally distinctive values stored on maintenance tickets.
 * The long names intentionally avoid collisions with generic department/type enums.
 */
export const MAINTENANCE_RESPONSIBLE_DEPARTMENT = {
  GENERAL: "maintenance_report_department_general",
  CONSTRUCTION: "maintenance_report_department_construction",
  IT: "maintenance_report_department_it",
} as const;

export type MaintenanceResponsibleDepartment =
  (typeof MAINTENANCE_RESPONSIBLE_DEPARTMENT)[keyof typeof MAINTENANCE_RESPONSIBLE_DEPARTMENT];


/** Distinct workflow values for the ticket inspection stage. */
export const MAINTENANCE_INSPECTION_WORKFLOW_STATUS = {
  PENDING_SUBMISSION: "maintenance_inspection_pending_submission",
  SUBMITTED_FOR_REVIEW: "maintenance_inspection_submitted_for_review",
  RETURNED_FOR_CORRECTION: "maintenance_inspection_returned_for_correction",
  APPROVED: "maintenance_inspection_approved",
} as const;

export type MaintenanceInspectionWorkflowStatus =
  (typeof MAINTENANCE_INSPECTION_WORKFLOW_STATUS)[keyof typeof MAINTENANCE_INSPECTION_WORKFLOW_STATUS];

/** Per-revision status stored on inspection_results. */
export const MAINTENANCE_INSPECTION_RESULT_STATUS = {
  DRAFT: "maintenance_inspection_result_draft",
  SUBMITTED: "maintenance_inspection_result_submitted",
  RETURNED: "maintenance_inspection_result_returned",
  APPROVED: "maintenance_inspection_result_approved",
  SUPERSEDED: "maintenance_inspection_result_superseded",
} as const;

export type MaintenanceInspectionResultStatus =
  (typeof MAINTENANCE_INSPECTION_RESULT_STATUS)[keyof typeof MAINTENANCE_INSPECTION_RESULT_STATUS];

/** Legacy manager + both derived manager roles. */
export const MAINTENANCE_MANAGER_FAMILY = [
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
] as const;

/** Roles that retain the reports/tickets/triage module. */
export const TICKET_MAINTENANCE_MANAGER_ROLES = [
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
] as const;

/** Legacy construction-workflow family; standalone Catalog access is defined separately above. */
export const CONSTRUCTION_MAINTENANCE_MANAGER_ROLES = [
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
] as const;

/** Both derived roles retain purchase-order manager behavior. */
export const PURCHASE_MAINTENANCE_MANAGER_ROLES = MAINTENANCE_MANAGER_FAMILY;

export function isMaintenanceManagerFamily(role?: string | null): boolean {
  return !!role && (MAINTENANCE_MANAGER_FAMILY as readonly string[]).includes(role);
}

export function isTicketMaintenanceManager(role?: string | null): boolean {
  return !!role && (TICKET_MAINTENANCE_MANAGER_ROLES as readonly string[]).includes(role);
}

export function isConstructionMaintenanceManager(role?: string | null): boolean {
  return !!role && (CONSTRUCTION_MAINTENANCE_MANAGER_ROLES as readonly string[]).includes(role);
}

/**
 * Client route exclusions for the two derived roles.
 * This is a UI guard; sensitive server routers also enforce the same split.
 */
const GENERAL_MANAGER_DENIED_PREFIXES = [
  "/inventory",
  "/inventory-operations",
  "/warehouse",
  "/documents",
  "/item-tracker",
  "/construction",
  "/purchase-cycle",
  "/external-maintenance",
] as const;

const CONSTRUCTION_MANAGER_DENIED_PREFIXES = [
  "/scan-asset",
  "/tag",
  // ⚠️ 2026-08-13: أُزيلت "/tickets/inbox" من هذه القائمة عمدًا — قرار صريح من
  // صاحب المشروع بتمكين مدير الإنشاءات والمشتريات من استعراض صندوق البلاغات
  // العام وكل البلاغات (بلا اقتصار على جهته)، على أن يبقى استعراضًا فقط خارج
  // نطاقه. "/triage" يبقى محجوبًا عمدًا — لم يُطلب منح صلاحية الفرز/التصنيف
  // لبلاغات خارج جهته، هذا قرار منفصل لم يُحسم بعد. راجع
  // docs/CONSTRUCTION_MANAGER_TICKET_READ_ACCESS.md.
  "/triage",
  "/inventory",
  "/inventory-operations",
  "/warehouse",
  "/documents",
  "/item-tracker",
  "/purchase-cycle",
  "/external-maintenance",
] as const;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function canRoleAccessPath(role: string | null | undefined, path: string): boolean {
  if (!role) return false;
  const normalizedPath = path.split(/[?#]/, 1)[0] || "/";
  if (matchesPrefix(normalizedPath, "/catalog")) {
    return canRoleAccessCatalogModule(role);
  }
  if (matchesPrefix(normalizedPath, "/scheduled-maintenance/my-tasks")) {
    return canRoleExecutePmv2Technician(role);
  }
  if (matchesPrefix(normalizedPath, "/scheduled-maintenance/warehouse-requests")) {
    return canRoleAccessPmv2Warehouse(role);
  }
  if (matchesPrefix(normalizedPath, "/scheduled-maintenance")) {
    return canRoleManagePmv2(role);
  }
  if (role === APP_ROLE.IT_MANAGER) {
    // IT role: scoped ticket execution + own purchase orders; PM V2 execution is handled above.
    // Inventory, purchase-cycle management and Catalog UI remain closed; PM V2 execution is limited to My Tasks by the route guard above.
    if (normalizedPath === "/" || normalizedPath === "/tickets" || normalizedPath === "/tickets/inbox" || normalizedPath === "/tickets/new") return true;
    if (/^\/tickets\/\d+$/.test(normalizedPath)) return true;
    if (matchesPrefix(normalizedPath, "/purchase-orders")) return true;
    return false;
  }
  if (role === APP_ROLE.GENERAL_MAINTENANCE_MANAGER) {
    return !GENERAL_MANAGER_DENIED_PREFIXES.some((prefix) => matchesPrefix(normalizedPath, prefix));
  }
  if (role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
    // القائمة والتفاصيل الرقمية متاحة بنطاق الخادم، وإنشاء بلاغ جديد متاح
    // حتى يستطيع مدير الإنشاءات إنشاء بلاغه الشخصي ثم تعديله قبل الفرز.
    // الفرز العام وبقية مسارات /tickets/* تبقى محجوبة.
    if (normalizedPath === "/tickets" || normalizedPath === "/tickets/inbox" || normalizedPath === "/tickets/new") return true;
    if (/^\/tickets\/\d+$/.test(normalizedPath)) return true;
    if (normalizedPath.startsWith("/tickets/")) return false;
    return !CONSTRUCTION_MANAGER_DENIED_PREFIXES.some((prefix) => matchesPrefix(normalizedPath, prefix));
  }
  return true;
}
