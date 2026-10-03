import {
  PMV2_MANAGEMENT_ROLES,
  PMV2_TECHNICIAN_EXECUTION_ROLES,
  PMV2_WAREHOUSE_ROLES,
  canRoleAccessPmv2Warehouse,
  canRoleExecutePmv2Technician,
  canRoleManagePmv2,
} from "@shared/roles";

/**
 * PM V2 scoped authorization policy.
 * Management and technician execution remain distinct permissions.
 */
export const PMV2_FOUNDATION_MANAGEMENT_ROLES = PMV2_MANAGEMENT_ROLES;
export const PMV2_TECHNICIAN_ROLES = PMV2_TECHNICIAN_EXECUTION_ROLES;
export const PMV2_WAREHOUSE_ACCESS_ROLES = PMV2_WAREHOUSE_ROLES;

export function canManagePmv2Foundation(role?: string | null): boolean {
  return canRoleManagePmv2(role);
}

export function canAccessPmv2TechnicianExecution(role?: string | null): boolean {
  return canRoleExecutePmv2Technician(role);
}

export function canAccessPmv2WarehouseQueue(role?: string | null): boolean {
  return canRoleAccessPmv2Warehouse(role);
}
