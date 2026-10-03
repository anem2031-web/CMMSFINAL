import { pmv2SlaRules } from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";

export const PMV2_SLA_ROLE_CATALOG = [
  { roleKey: "team", label: "فريق الصيانة" },
  { roleKey: "technician", label: "الفني" },
  { roleKey: "warehouse", label: "المستودع" },
  { roleKey: "maintenance_manager", label: "مدير الصيانة" },
  { roleKey: "purchase_manager", label: "إدارة المشتريات" },
  { roleKey: "purchase_requester", label: "منشئ طلب الشراء" },
  { roleKey: "delegate", label: "مندوب المشتريات" },
  { roleKey: "accountant", label: "الحسابات" },
  { roleKey: "senior_management", label: "الإدارة العليا" },
  { roleKey: "ticket_team", label: "قسم البلاغات / الصيانة" },
] as const;

function isMissingTableError(error: unknown) {
  const anyError = error as any;
  return anyError?.code === "ER_NO_SUCH_TABLE" || String(anyError?.message || "").includes("pmv2_sla_rules");
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  return db;
}

export type Pmv2SlaRuleView = {
  roleKey: string;
  label: string;
  slaMinutes: number | null;
  reminderMinutes: number | null;
  isActive: boolean;
  configured: boolean;
};

export class Pmv2SlaService {
  async listRules(): Promise<Pmv2SlaRuleView[]> {
    const db = await requireDb();
    let rows: any[] = [];
    try {
      rows = await db.select().from(pmv2SlaRules);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      rows = [];
    }
    const byRole = new Map(rows.map((row) => [String(row.roleKey), row]));
    return PMV2_SLA_ROLE_CATALOG.map((entry) => {
      const row = byRole.get(entry.roleKey);
      return {
        roleKey: entry.roleKey,
        label: entry.label,
        slaMinutes: row?.slaMinutes == null ? null : Number(row.slaMinutes),
        reminderMinutes: row?.reminderMinutes == null ? null : Number(row.reminderMinutes),
        isActive: row ? Number(row.isActive) === 1 : true,
        configured: !!row,
      };
    });
  }

  async getRuleMap() {
    const rules = await this.listRules();
    return new Map(rules.map((rule) => [rule.roleKey, rule]));
  }

  async upsertRule(input: { roleKey: string; slaMinutes: number | null; reminderMinutes: number | null; isActive: boolean; updatedById: number }) {
    if (!PMV2_SLA_ROLE_CATALOG.some((entry) => entry.roleKey === input.roleKey)) {
      throw new Error("دور SLA غير معتمد في PM V2");
    }
    const db = await requireDb();
    try {
      await db.insert(pmv2SlaRules).values({
        roleKey: input.roleKey,
        slaMinutes: input.slaMinutes,
        reminderMinutes: input.reminderMinutes,
        isActive: input.isActive ? 1 : 0,
        updatedById: input.updatedById,
      }).onDuplicateKeyUpdate({
        set: {
          slaMinutes: input.slaMinutes,
          reminderMinutes: input.reminderMinutes,
          isActive: input.isActive ? 1 : 0,
          updatedById: input.updatedById,
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error("يلزم تطبيق ترحيل PATCH139 لجدول إعدادات SLA أولًا");
      }
      throw error;
    }
    return this.listRules();
  }

  evaluate(roleKey: string | null | undefined, since: string | null | undefined, ruleMap: Map<string, Pmv2SlaRuleView>, now = new Date()) {
    const rule = roleKey ? ruleMap.get(roleKey) : null;
    const sinceMs = since ? new Date(since).getTime() : NaN;
    const elapsedMinutes = Number.isFinite(sinceMs) ? Math.max(0, Math.floor((now.getTime() - sinceMs) / 60000)) : null;
    if (!rule || !rule.isActive || rule.slaMinutes == null || rule.slaMinutes <= 0 || elapsedMinutes == null) {
      return { status: "not_configured" as const, elapsedMinutes, slaMinutes: rule?.slaMinutes ?? null, breachMinutes: 0 };
    }
    const breachMinutes = Math.max(0, elapsedMinutes - rule.slaMinutes);
    return {
      status: breachMinutes > 0 ? "overdue" as const : "within" as const,
      elapsedMinutes,
      slaMinutes: rule.slaMinutes,
      breachMinutes,
    };
  }
}

export const pmv2SlaService = new Pmv2SlaService();
