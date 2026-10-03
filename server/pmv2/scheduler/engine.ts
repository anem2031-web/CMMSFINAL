import type { MaintenanceTargetAdapter } from "../adapters/contracts";
import { isPmv2RecurrenceDueOnDate } from "../checklists/recurrence";
import { validatePmv2ChecklistItemWrite } from "../checklists/validation";
import { formatPmv2ChecklistScheduleLabel } from "../checklists/schedule-config";

export interface Pmv2SchedulerRunResult {
  date: string;
  createdTasks: number;
  existingTasks: number;
  createdTaskItems: number;
  errors: string[];
}

export interface Pmv2SchedulerDueProgram {
  id: number;
  title: string | null;
}

export interface Pmv2SchedulerProgramRecord {
  id: number;
  title: string | null;
  teamId: number;
  checklistId: number;
  createdAt: string;
}

export interface Pmv2SchedulerChecklistItemRecord {
  id: number;
  checklistId: number;
  title: string;
  sortOrder: number;
  isRequired: number;
  isActive: number;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual";
  frequencyValue: number | null;
  weekday: number | null;
  monthDay: number | null;
  anchorDate: string | null;
  scheduleConfigJson: string | null;
}

export interface Pmv2SchedulerTargetRecord {
  id: number;
  siteId: number | null;
  sectionId: number | null;
  assetId: number | null;
}

export interface Pmv2SchedulerRepository {
  listActivePrograms(): Promise<Pmv2SchedulerProgramRecord[]>;
  listActiveChecklistItems(checklistId: number): Promise<Pmv2SchedulerChecklistItemRecord[]>;
  listProgramTargets(programId: number): Promise<Pmv2SchedulerTargetRecord[]>;
  getOrCreateTask(input: {
    programId: number;
    programTargetId: number;
    teamId: number;
    dueDate: string;
  }): Promise<{ id: number; created: boolean }>;
  ensureTaskItem(input: {
    taskId: number;
    sourceChecklistItemId: number;
    titleSnapshot: string;
    sortOrderSnapshot: number;
    frequencySnapshot: Pmv2SchedulerChecklistItemRecord["frequency"];
    frequencyValueSnapshot: number | null;
    weekdaySnapshot: number | null;
    monthDaySnapshot: number | null;
    anchorDateSnapshot: string | null;
    recurrenceLabelSnapshot: string | null;
    scheduledDate: string;
  }): Promise<boolean>;
}

export class Pmv2SchedulerEngine {
  private readonly repository: Pmv2SchedulerRepository;
  private readonly targetAdapter: MaintenanceTargetAdapter;

  constructor(
    repository: Pmv2SchedulerRepository,
    targetAdapter: MaintenanceTargetAdapter,
  ) {
    this.repository = repository;
    this.targetAdapter = targetAdapter;
  }

  private async listDueChecklistItems(
    program: Pmv2SchedulerProgramRecord,
    date: string,
    onValidationError?: (item: Pmv2SchedulerChecklistItemRecord, error: unknown) => void,
  ): Promise<Pmv2SchedulerChecklistItemRecord[]> {
    const programStartDate = String(program.createdAt).slice(0, 10);
    if (date < programStartDate) return [];

    const rawItems = await this.repository.listActiveChecklistItems(program.checklistId);
    return rawItems.filter((item) => {
      try {
        const valid = validatePmv2ChecklistItemWrite({
          checklistId: item.checklistId,
          title: item.title,
          sortOrder: item.sortOrder,
          isRequired: Number(item.isRequired) === 1,
          isActive: Number(item.isActive) === 1,
          frequency: item.frequency,
          frequencyValue: item.frequencyValue,
          weekday: item.weekday,
          monthDay: item.monthDay,
          anchorDate: item.anchorDate,
          scheduleConfigJson: item.scheduleConfigJson,
        });
        return isPmv2RecurrenceDueOnDate(valid, date);
      } catch (error) {
        onValidationError?.(item, error);
        return false;
      }
    });
  }

  async listDueProgramsForDate(date: string): Promise<Pmv2SchedulerDueProgram[]> {
    // Reuse the production recurrence validator so the manual picker shows only
    // programs that are genuinely due on the selected calendar date.
    isPmv2RecurrenceDueOnDate(
      {
        frequency: "daily",
        frequencyValue: null,
        weekday: null,
        monthDay: null,
        anchorDate: null,
        scheduleConfigJson: null,
      },
      date,
    );

    const programs = await this.repository.listActivePrograms();
    const duePrograms: Pmv2SchedulerDueProgram[] = [];

    for (const program of programs) {
      const dueItems = await this.listDueChecklistItems(program, date);
      if (dueItems.length > 0) duePrograms.push({ id: program.id, title: program.title });
    }

    return duePrograms;
  }

  async runForDate(date: string, programId?: number): Promise<Pmv2SchedulerRunResult> {
    isPmv2RecurrenceDueOnDate(
      {
        frequency: "daily",
        frequencyValue: null,
        weekday: null,
        monthDay: null,
        anchorDate: null,
        scheduleConfigJson: null,
      },
      date,
    );

    const result: Pmv2SchedulerRunResult = {
      date,
      createdTasks: 0,
      existingTasks: 0,
      createdTaskItems: 0,
      errors: [],
    };

    const activePrograms = await this.repository.listActivePrograms();
    const programs = programId == null
      ? activePrograms
      : activePrograms.filter((program) => program.id === programId);

    for (const program of programs) {
      try {
        const dueItems = await this.listDueChecklistItems(program, date, (item, error) => {
          result.errors.push(
            `Program ${program.id} checklist item ${item.id}: ${String(error)}`,
          );
        });
        if (dueItems.length === 0) continue;

        const targets = await this.repository.listProgramTargets(program.id);
        for (const target of targets) {
          try {
            const targetRef =
              target.siteId != null
                ? { type: "site" as const, siteId: target.siteId }
                : target.sectionId != null
                  ? { type: "section" as const, sectionId: target.sectionId }
                  : target.assetId != null
                    ? { type: "asset" as const, assetId: target.assetId }
                    : null;
            if (!targetRef || !(await this.targetAdapter.validateTarget(targetRef))) {
              result.errors.push(
                `Program ${program.id} target ${target.id}: target is no longer valid`,
              );
              continue;
            }

            const task = await this.repository.getOrCreateTask({
              programId: program.id,
              programTargetId: target.id,
              teamId: program.teamId,
              dueDate: date,
            });
            if (task.created) result.createdTasks += 1;
            else result.existingTasks += 1;

            for (const item of dueItems) {
              if (
                await this.repository.ensureTaskItem({
                  taskId: task.id,
                  sourceChecklistItemId: item.id,
                  titleSnapshot: item.title,
                  sortOrderSnapshot: item.sortOrder,
                  frequencySnapshot: item.frequency,
                  frequencyValueSnapshot: item.frequencyValue,
                  weekdaySnapshot: item.weekday,
                  monthDaySnapshot: item.monthDay,
                  anchorDateSnapshot: item.anchorDate,
                  recurrenceLabelSnapshot: formatPmv2ChecklistScheduleLabel(item),
                  scheduledDate: date,
                })
              ) {
                result.createdTaskItems += 1;
              }
            }
          } catch (error) {
            result.errors.push(
              `Program ${program.id} target ${target.id}: ${String(error)}`,
            );
          }
        }
      } catch (error) {
        result.errors.push(`Program ${program.id}: ${String(error)}`);
      }
    }

    return result;
  }
}
