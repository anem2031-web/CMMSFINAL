import { and, asc, eq, gte, notInArray } from "drizzle-orm";
import {
  assets,
  pmv2Checklists,
  pmv2Programs,
  pmv2ProgramTargets,
  pmv2Specialties,
  pmv2Tasks,
  pmv2Teams,
  sections,
  sites,
} from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import { pmv2TaskTimelineService } from "../tracking/timeline-service";
import { pmv2SlaService } from "./sla-service";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  return db;
}

function riyadhDateDaysAgo(days: number) {
  const date = new Date(Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function minutesSince(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const started = new Date(value).getTime();
  if (!Number.isFinite(started)) return null;
  return Math.max(0, Math.floor((now.getTime() - started) / 60000));
}

export class Pmv2MonitoringService {
  async getOverview() {
    const db = await requireDb();
    const now = new Date();
    const recentStartDate = riyadhDateDaysAgo(29);
    const [rows, ruleMap, recentRows] = await Promise.all([
      db.select({
        id: pmv2Tasks.id,
        taskNumber: pmv2Tasks.taskNumber,
        dueDate: pmv2Tasks.dueDate,
        status: pmv2Tasks.status,
        teamId: pmv2Tasks.teamId,
        teamCode: pmv2Teams.code,
        specialtyName: pmv2Specialties.name,
        checklistName: pmv2Checklists.name,
        siteName: sites.name,
        sectionName: sections.name,
        assetId: pmv2ProgramTargets.assetId,
        assetName: assets.name,
      })
        .from(pmv2Tasks)
        .innerJoin(pmv2Teams, eq(pmv2Teams.id, pmv2Tasks.teamId))
        .innerJoin(pmv2Specialties, eq(pmv2Specialties.id, pmv2Teams.specialtyId))
        .innerJoin(pmv2Programs, eq(pmv2Programs.id, pmv2Tasks.programId))
        .innerJoin(pmv2Checklists, eq(pmv2Checklists.id, pmv2Programs.checklistId))
        .innerJoin(pmv2ProgramTargets, eq(pmv2ProgramTargets.id, pmv2Tasks.programTargetId))
        .leftJoin(sites, eq(sites.id, pmv2ProgramTargets.siteId))
        .leftJoin(sections, eq(sections.id, pmv2ProgramTargets.sectionId))
        .leftJoin(assets, eq(assets.id, pmv2ProgramTargets.assetId))
        .where(notInArray(pmv2Tasks.status, ["completed", "cancelled"]))
        .orderBy(asc(pmv2Tasks.dueDate), asc(pmv2Tasks.id)),
      pmv2SlaService.getRuleMap(),
      db.select({
        id: pmv2Tasks.id,
        dueDate: pmv2Tasks.dueDate,
        status: pmv2Tasks.status,
        teamId: pmv2Tasks.teamId,
        teamCode: pmv2Teams.code,
        specialtyId: pmv2Specialties.id,
        specialtyName: pmv2Specialties.name,
      })
        .from(pmv2Tasks)
        .innerJoin(pmv2Teams, eq(pmv2Teams.id, pmv2Tasks.teamId))
        .innerJoin(pmv2Specialties, eq(pmv2Specialties.id, pmv2Teams.specialtyId))
        .where(and(
          gte(pmv2Tasks.dueDate, recentStartDate),
          notInArray(pmv2Tasks.status, ["cancelled"]),
        )),
    ]);

    const details = await Promise.all(rows.map(async (row) => {
      const timeline = await pmv2TaskTimelineService.getForManagement(Number(row.id));
      const current = timeline.summary.currentResponsibility;
      const sla = pmv2SlaService.evaluate(current?.roleKey, current?.since, ruleMap, now);
      const currentMinutes = minutesSince(current?.since, now);
      return {
        ...row,
        id: Number(row.id),
        teamId: Number(row.teamId),
        assetId: row.assetId == null ? null : Number(row.assetId),
        summary: timeline.summary,
        currentResponsibility: current,
        responsibilities: timeline.responsibilities,
        currentMinutes,
        sla,
      };
    }));

    const byRoleMap = new Map<string, { roleKey: string; roleLabel: string; count: number; oldestMinutes: number; totalMinutes: number }>();
    const byPersonMap = new Map<string, { userId: number; name: string; roleLabel: string; count: number; oldestMinutes: number }>();
    const byTeamMap = new Map<string, { teamId: number; teamCode: string; count: number }>();
    const bySpecialtyMap = new Map<string, { specialtyName: string; count: number; slaBreaches: number }>();
    const byStatusMap = new Map<string, { status: string; count: number }>();
    const byAssetMap = new Map<string, { assetId: number; assetName: string; count: number }>();
    let totalAgeMinutes = 0;
    let totalWorkMinutes = 0;
    let slaBreaches = 0;

    for (const item of details) {
      totalAgeMinutes += Number(item.summary.totalAgeMinutes || 0);
      totalWorkMinutes += Number(item.summary.actualWorkMinutes || 0);
      if (item.sla.status === "overdue") slaBreaches += 1;
      const current = item.currentResponsibility;
      if (current) {
        const minutes = item.currentMinutes ?? 0;
        const role = byRoleMap.get(current.roleKey) || { roleKey: current.roleKey, roleLabel: current.roleLabel, count: 0, oldestMinutes: 0, totalMinutes: 0 };
        role.count += 1;
        role.oldestMinutes = Math.max(role.oldestMinutes, minutes);
        role.totalMinutes += minutes;
        byRoleMap.set(current.roleKey, role);
        if (current.responsibleUserId && current.responsibleUserName) {
          const key = String(current.responsibleUserId);
          const person = byPersonMap.get(key) || { userId: Number(current.responsibleUserId), name: current.responsibleUserName, roleLabel: current.roleLabel, count: 0, oldestMinutes: 0 };
          person.count += 1;
          person.oldestMinutes = Math.max(person.oldestMinutes, minutes);
          byPersonMap.set(key, person);
        }
      }
      const teamKey = String(item.teamId);
      const team = byTeamMap.get(teamKey) || { teamId: item.teamId, teamCode: String(item.teamCode), count: 0 };
      team.count += 1;
      byTeamMap.set(teamKey, team);
      const specialtyKey = String(item.specialtyName || "بدون تخصص");
      const specialty = bySpecialtyMap.get(specialtyKey) || { specialtyName: specialtyKey, count: 0, slaBreaches: 0 };
      specialty.count += 1;
      if (item.sla.status === "overdue") specialty.slaBreaches += 1;
      bySpecialtyMap.set(specialtyKey, specialty);
      const statusKey = String(item.status);
      const statusRow = byStatusMap.get(statusKey) || { status: statusKey, count: 0 };
      statusRow.count += 1;
      byStatusMap.set(statusKey, statusRow);
      if (item.assetId && item.assetName) {
        const assetKey = String(item.assetId);
        const asset = byAssetMap.get(assetKey) || { assetId: item.assetId, assetName: String(item.assetName), count: 0 };
        asset.count += 1;
        byAssetMap.set(assetKey, asset);
      }
    }

    const recentTeamMap = new Map<string, { teamId: number; teamCode: string; assigned: number; completed: number }>();
    const recentSpecialtyMap = new Map<string, { specialtyId: number; specialtyName: string; assigned: number; completed: number }>();
    for (const row of recentRows) {
      const teamKey = String(row.teamId);
      const team = recentTeamMap.get(teamKey) || { teamId: Number(row.teamId), teamCode: String(row.teamCode), assigned: 0, completed: 0 };
      team.assigned += 1;
      if (row.status === "completed") team.completed += 1;
      recentTeamMap.set(teamKey, team);
      const specialtyKey = String(row.specialtyId);
      const specialty = recentSpecialtyMap.get(specialtyKey) || { specialtyId: Number(row.specialtyId), specialtyName: String(row.specialtyName), assigned: 0, completed: 0 };
      specialty.assigned += 1;
      if (row.status === "completed") specialty.completed += 1;
      recentSpecialtyMap.set(specialtyKey, specialty);
    }
    const recentByTeam = [...recentTeamMap.values()].map((row) => ({ ...row, completionRate: row.assigned ? Math.round((row.completed / row.assigned) * 100) : 0 }))
      .sort((a, b) => b.assigned - a.assigned || b.completionRate - a.completionRate);
    const recentBySpecialty = [...recentSpecialtyMap.values()].map((row) => ({ ...row, completionRate: row.assigned ? Math.round((row.completed / row.assigned) * 100) : 0 }))
      .sort((a, b) => b.assigned - a.assigned || b.completionRate - a.completionRate);

    const blockedStatuses = new Set(["waiting_material", "waiting_ticket", "ready_to_complete"]);
    const owner = {
      openTasks: details.length,
      blockedTasks: details.filter((item) => blockedStatuses.has(String(item.status))).length,
      waitingMaterial: details.filter((item) => item.status === "waiting_material").length,
      waitingTicket: details.filter((item) => item.status === "waiting_ticket").length,
      readyToComplete: details.filter((item) => item.status === "ready_to_complete").length,
      slaBreaches,
      averageAgeMinutes: details.length ? Math.round(totalAgeMinutes / details.length) : 0,
      totalWorkMinutes,
      totalWaitingMinutes: Math.max(0, totalAgeMinutes - totalWorkMinutes),
      byRole: [...byRoleMap.values()].map((row) => ({ ...row, averageMinutes: row.count ? Math.round(row.totalMinutes / row.count) : 0 })).sort((a, b) => b.count - a.count || b.oldestMinutes - a.oldestMinutes),
      byPerson: [...byPersonMap.values()].sort((a, b) => b.count - a.count || b.oldestMinutes - a.oldestMinutes),
      byTeam: [...byTeamMap.values()].sort((a, b) => b.count - a.count),
      bySpecialty: [...bySpecialtyMap.values()].sort((a, b) => b.count - a.count || b.slaBreaches - a.slaBreaches),
      byStatus: [...byStatusMap.values()].sort((a, b) => b.count - a.count),
      byAsset: [...byAssetMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      recent30Days: {
        startDate: recentStartDate,
        totalAssigned: recentRows.length,
        totalCompleted: recentRows.filter((row) => row.status === "completed").length,
        byTeam: recentByTeam,
        bySpecialty: recentBySpecialty,
      },
      oldest: [...details].sort((a, b) => (b.currentMinutes ?? b.summary.totalAgeMinutes ?? 0) - (a.currentMinutes ?? a.summary.totalAgeMinutes ?? 0)).slice(0, 10).map((item) => ({
        id: item.id,
        taskNumber: item.taskNumber,
        reason: item.currentResponsibility?.reason || "مهمة مفتوحة",
        roleLabel: item.currentResponsibility?.roleLabel || "فريق الصيانة",
        responsibleUserName: item.currentResponsibility?.responsibleUserName || null,
        currentMinutes: item.currentMinutes,
        totalAgeMinutes: item.summary.totalAgeMinutes,
      })),
    };

    return { generatedAt: now.toISOString(), items: details, owner };
  }

  async getTaskDetail(taskId: number) {
    const overview = await this.getOverview();
    const task = overview.items.find((item) => item.id === taskId) || null;
    const timeline = await pmv2TaskTimelineService.getForManagement(taskId);
    return { task, timeline };
  }
}

export const pmv2MonitoringService = new Pmv2MonitoringService();
