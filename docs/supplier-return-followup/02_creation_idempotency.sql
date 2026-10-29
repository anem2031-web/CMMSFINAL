-- Manual execution ONLY on copycmms2. No runtime migration.
-- Nullable for compatibility with any existing cases; new feature writes both.
ALTER TABLE `copycmms2`.`supplier_return_cases`
  ADD COLUMN `creationKey` VARCHAR(100) NULL;
-- Run separately: TiDB rejected adding columns and their index together.
ALTER TABLE `copycmms2`.`supplier_return_cases`
  ADD COLUMN `creationRequestHash` CHAR(64) NULL;
ALTER TABLE `copycmms2`.`supplier_return_cases`
  ADD UNIQUE KEY `uq_supplier_return_case_creation` (`createdById`, `creationKey`);
