-- PM V2 — Phase 1 — Manual DB Step 3
-- Table: pmv2_team_members
-- Execute manually only after pmv2_teams was created successfully.
--
-- Ownership policy:
--   teamId = INTERNAL PM V2 relation => physical FK.
--   userId = EXISTING-SYSTEM external reference => indexed ID only,
--   validated through UsersAdapter; intentionally NO physical FK to users.
-- Membership history contract:
--   UNIQUE(teamId, userId) prevents duplicate membership rows.
--   Re-adding a previous member must reactivate the existing row instead of inserting a duplicate.

CREATE TABLE `pmv2_team_members` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `teamId` INT NOT NULL,
  `userId` INT NOT NULL,
  `isActive` TINYINT NOT NULL DEFAULT 1,
  `joinedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `leftAt` TIMESTAMP NULL DEFAULT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pmv2_team_members_team_user` (`teamId`, `userId`),

  KEY `idx_pmv2_team_members_team` (`teamId`),
  KEY `idx_pmv2_team_members_user` (`userId`),
  KEY `idx_pmv2_team_members_active` (`isActive`),

  CONSTRAINT `fk_pmv2_team_members_team`
    FOREIGN KEY (`teamId`)
    REFERENCES `pmv2_teams` (`id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
