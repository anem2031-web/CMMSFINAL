import {
  pmv2MaterialRequestService,
} from "./request-service";
import {
  pmv2TeamIssueHandoffService,
} from "./team-issue-handoff-service";

type TechnicianCatalogMaterialInput = {
  taskId: number;
  taskItemId: number;
  catalogItemId: number;
  quantity: number;
  unit: string;
};

type AuditContext = {
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Technician self-service orchestration for Team-Warehouse stock.
 *
 * PM V2 still does not mutate Inventory directly. The need is persisted through
 * the normal PM V2 routing service, then the authoritative Inventory/Delivery
 * workflow is invoked through the existing issue adapter with the technician as
 * the actual receiver. If stock changed and a shortage now exists, the request
 * service creates only the shortage and no partial issue is attempted.
 */
export class Pmv2TechnicianMaterialSelfService {
  async submitAndReceive(
    technicianUserId: number,
    input: TechnicianCatalogMaterialInput,
    auditContext?: AuditContext,
  ) {
    const route = await pmv2MaterialRequestService.submitMaterialNeed(
      technicianUserId,
      {
        ...input,
        unlistedItemName: undefined,
      },
      auditContext,
    );

    if (route.route !== "team_inventory") {
      return {
        ...route,
        receivedFromTeamWarehouse: false as const,
        issue: null,
      };
    }

    const issue = await pmv2TeamIssueHandoffService.issueReadyRequirementToSelf(
      technicianUserId,
      { routeDecisionActionId: route.routeDecisionActionId },
      auditContext,
    );

    return {
      ...route,
      receivedFromTeamWarehouse: Boolean(issue.completed && !issue.partial),
      issue,
    };
  }
}

export const pmv2TechnicianMaterialSelfService = new Pmv2TechnicianMaterialSelfService();
