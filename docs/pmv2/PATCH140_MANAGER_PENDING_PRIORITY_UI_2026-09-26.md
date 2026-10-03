# PATCH140 — Manager pending-work priority UI — 2026-09-26

## Purpose
Simplify the PM V2 maintenance-manager monitoring tab introduced by PATCH139 without removing any monitoring fact, Timeline detail, owner indicator, filter, SLA rule, alert control, or external source-of-truth integration.

The manager should answer first:
1. What needs my intervention now?
2. What is still under action elsewhere?
3. Who currently owns the action and for how long?

## Scope
Presentation-only change inside PM V2 `ScheduledMaintenance`.

### Manager summary
The first row now focuses on four operational signals:
- **المهام المعلقة**;
- **تحتاج تدخلك الآن**;
- **تجاوز SLA**;
- **أقدم تعليق**.

`تحتاج تدخلك الآن` is deliberately conservative and deterministic:
- current responsibility is `maintenance_manager`; or
- the current responsibility has exceeded an explicitly configured SLA.

No other task is labelled as requiring manager intervention merely because it is old.

### Work organization
The former wide management table is reorganized into two progressive sections:
- **تحتاج تدخلك الآن** — intervention items first;
- **معلقة وتحت الإجراء** — the remaining open work.

Each compact task card keeps the PATCH139 facts:
- task/checklist/team/asset context;
- blocking reason/status;
- current stage;
- current role and assigned person;
- elapsed time with the current responsibility;
- total task age;
- SLA state;
- **عرض المسار** drill-down.

### Search / filters
- primary text search remains visible;
- role/person/team/SLA filters remain available under **بحث وفلاتر متقدمة**;
- no filter capability is removed.

### Detail and administration
The following PATCH139 surfaces remain unchanged in capability:
- full management Timeline;
- stage/responsibility durations;
- detailed events;
- owner/admin executive indicators;
- SLA/reminder editing;
- manual alert sweep.

The SLA/reminder editor is collapsed by default as **إعدادات SLA والتذكيرات** to reduce daily manager-screen clutter.

## Non-goals / boundaries
- no server or API change;
- no SQL/schema migration;
- no SLA rule semantic change;
- no alert behavior change;
- no Purchase, Inventory, Ticket, Accounting, or other external workflow mutation;
- no removal of PATCH139 monitoring data.

## Files
- `client/src/pages/pmv2/ScheduledMaintenance.tsx`
- `server/tests/pmv2-patch140-manager-pending-priority-ui.node.mjs`
- PM V2 documentation files.

## Verification
- PATCH140 focused: **6/6 PASS**.
- PATCH139 + PATCH140 compatibility: **16/16 PASS**.
- broad PM V2 after PATCH140: **361/380 PASS, 19 fail**.
- PATCH139 baseline: **355/374 PASS, 19 fail**.
- the 19 failing test names are identical: **0 new broad-suite failures**.
- changed TSX syntax via TypeScript `transpileModule`: **PASS**.
- full production build/typecheck remains unverified in the source-only environment because `node_modules` is absent.
