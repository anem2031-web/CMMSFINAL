import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const sync = read('server/pmv2/tickets/closure-sync-service.ts');
const closure = read('server/routers/tickets/tickets.closure.ts');

// Strict boundary: normal Tickets without a PM V2 source link are a no-op.
assert.match(sync, /if \(!initial\) return \{ linked: false, completed: false, reason: "not_linked"/);
assert.match(sync, /initial\.ticketStatus !== "closed"/);

// Only the exact PM V2 dependency state is completed automatically.
assert.match(sync, /row\.itemStatus !== "waiting_ticket" \|\| row\.itemResult !== "needs_ticket"/);
assert.match(sync, /set\(\{ status: "completed", result: "fixed" \}\)/);
assert.match(sync, /action: "ticket_closed_completion"/);
assert.match(sync, /completionSource: "ticket_closed"/);

// Defensive concurrency / duplicate guard.
assert.match(sync, /FOR UPDATE/);
assert.match(sync, /other_active_ticket/);
assert.match(sync, /ne\(tickets\.status, "closed"\)/);
assert.match(sync, /ne\(tickets\.status, "requester_confirmed"\)/);

// Recompute the parent Task without auto-ending a Visit.
assert.match(sync, /function deriveTaskStatus/);
assert.match(sync, /set\(\{ status: taskStatus \}\)/);
assert.doesNotMatch(sync, /pmv2Visits|endedAt/);

// Every final Ticket-close entry point runs the sync inside the same DB transaction.
const syncCalls = closure.match(/pmv2TicketClosureSyncService\.syncClosedTicketWithDb\(tx/g) ?? [];
assert.equal(syncCalls.length, 4);
assert.match(closure, /closeParentTicket:[\s\S]*syncClosedTicketWithDb\(tx/);
assert.match(closure, /close: ticketManagerProcedure[\s\S]*db\.withTransaction\(async \(tx: any\)[\s\S]*syncClosedTicketWithDb\(tx/);
assert.match(closure, /closeBySupervisor:[\s\S]*db\.withTransaction\(async \(tx: any\)[\s\S]*syncClosedTicketWithDb\(tx/);
assert.match(closure, /finalClose:[\s\S]*db\.withTransaction\(async \(tx: any\)[\s\S]*syncClosedTicketWithDb\(tx/);

console.log('PASS Patch 123 PM V2 Ticket closure sync regression assertions');
