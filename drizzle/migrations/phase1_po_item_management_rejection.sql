-- ============================================================
-- Phase 1 Migration: PO Item Management Rejection
-- Date: 2026-05-17
-- Safe to run on live data: YES (additive only, no data moved)
-- ============================================================
ALTER TABLE `purchase_order_items` ADD `managementRejectionReason` text;