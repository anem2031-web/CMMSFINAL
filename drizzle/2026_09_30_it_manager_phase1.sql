-- 2026-09-30 — المرحلة الأولى لدور مدير تقنية المعلومات وبلاغات IT.
-- TiDB/MySQL: نفّذ كل ALTER TABLE كعبارة مستقلة.

ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM(
    'user','admin','operator','technician','it_manager','maintenance_manager',
    'general_maintenance_manager','construction_procurement_manager','supervisor',
    'purchase_manager','purchase_requester','delegate','accountant','senior_management',
    'executive_director','warehouse','gate_security','owner',
    'food_warehouse_manager','food_warehouse_assistant'
  ) NOT NULL DEFAULT 'user';

ALTER TABLE `tickets`
  MODIFY COLUMN `category` ENUM(
    'electrical','plumbing','hvac','structural','mechanical','general','safety','cleaning','it'
  ) NOT NULL DEFAULT 'general';

ALTER TABLE `tickets`
  MODIFY COLUMN `maintenanceResponsibleDepartment` ENUM(
    'maintenance_report_department_general',
    'maintenance_report_department_construction',
    'maintenance_report_department_it'
  ) NULL;

ALTER TABLE `ticket_items`
  MODIFY COLUMN `responsibleDepartment` ENUM(
    'maintenance_report_department_general',
    'maintenance_report_department_construction',
    'maintenance_report_department_it'
  ) NULL;

ALTER TABLE `ticket_departments`
  MODIFY COLUMN `department` ENUM(
    'maintenance_report_department_general',
    'maintenance_report_department_construction',
    'maintenance_report_department_it'
  ) NOT NULL;
