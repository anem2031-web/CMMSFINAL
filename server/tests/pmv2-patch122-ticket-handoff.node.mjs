import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const handoff = read('server/pmv2/tickets/handoff-service.ts');
const ticketsRouter = read('server/routers/tickets/tickets.router.ts');
const techRouter = read('server/routers/pmv2/technician.ts');
const readService = read('server/pmv2/technician/read-service.ts');
const createTicket = read('client/src/pages/tickets/CreateTicket.tsx');
const myTasks = read('client/src/pages/pmv2/Pmv2MyTasks.tsx');
const contracts = read('server/pmv2/adapters/contracts.ts');
const currentSystem = read('server/pmv2/adapters/current-system.ts');

// Atomic source link: lock source item, reject another active Ticket, insert source link.
assert.match(handoff, /FOR UPDATE/);
assert.match(handoff, /ne\(tickets\.status, "closed"\)/);
assert.match(handoff, /ne\(tickets\.status, "requester_confirmed"\)/);
assert.match(handoff, /pmv2TaskTicketLinks\)\.values/);
assert.match(handoff, /action: "ticket_linked"/);

// PM V2 Ticket creation uses the existing Ticket create mutation, but create + source link share one transaction.
assert.match(ticketsRouter, /pmv2TaskItemId: z\.number\(\)\.int\(\)\.positive\(\)\.optional\(\)/);
assert.match(ticketsRouter, /db\.withTransaction\(async \(tx\)/);
assert.match(ticketsRouter, /db\.createTicket\([\s\S]*?, tx\)/);
assert.match(ticketsRouter, /linkAtomicCreatedTicket\(tx/);
assert.match(ticketsRouter, /else \{[\s\S]*ticketNumber = await db\.getNextTicketNumber\(\);[\s\S]*id = await db\.createTicket/);

// Same existing Ticket page is reused and receives authoritative PM V2 context.
assert.match(techRouter, /ticketHandoffContext/);
assert.match(createTicket, /trpc\.pmv2\.technician\.ticketHandoffContext\.useQuery/);
assert.match(createTicket, /pmv2TaskItemId/);
assert.match(createTicket, /تم إنشاء البلاغ .* وربطه بـ PM V2 آليًا/);
assert.match(myTasks, /\/tickets\/new\?pmv2TaskItemId=/);
assert.match(myTasks, /إنشاء البلاغ المرتبط/);
assert.match(myTasks, /فتح البلاغ/);
assert.match(myTasks, /تحويل البند إلى بلاغ صيانة/);
assert.match(myTasks, /اكتب ملاحظة توضح سبب تحويل البند إلى بلاغ صيانة/);
assert.match(myTasks, /متابعة لإنشاء البلاغ/);
assert.match(handoff, /pmv2ItemActions\.note/);
assert.match(handoff, /eq\(pmv2ItemActions\.result, "needs_ticket"\)/);
assert.match(handoff, /ticketDescription/);
assert.match(createTicket, /context\.ticketDescription/);
assert.doesNotMatch(createTicket, /بلاغ ناتج من مهمة الصيانة المجدولة/);

// Live Ticket status/path is read through the external Ticket adapter, not duplicated into PM V2.
assert.match(contracts, /interface TicketAdapter/);
assert.match(currentSystem, /currentTicketAdapter: TicketAdapter/);
assert.match(readService, /currentTicketAdapter\.getTicketsByIds/);
assert.match(readService, /linkedTicket/);

console.log('PASS Patch 122 PM V2 Ticket handoff regression assertions');
