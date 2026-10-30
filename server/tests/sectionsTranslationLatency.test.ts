import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSections: vi.fn(),
  getSectionById: vi.fn(),
  createSection: vi.fn(),
  updateSection: vi.fn(),
  createAuditLog: vi.fn(),
  queueTranslation: vi.fn(),
  localizeNamedRecords: vi.fn(),
}));

vi.mock("../_core/db", () => ({
  getSections: mocks.getSections,
  getSectionById: mocks.getSectionById,
  createSection: mocks.createSection,
  updateSection: mocks.updateSection,
  createAuditLog: mocks.createAuditLog,
}));
vi.mock("../services/translation/translation", () => ({ detectLanguage: vi.fn(async () => "ar") }));
vi.mock("../services/translation/translationEngine", () => ({ queueTranslation: mocks.queueTranslation }));
vi.mock("../services/translation/localizedMasterData", () => ({ localizeNamedRecords: mocks.localizeNamedRecords }));

import { sectionsRouter } from "../routers/sections/sections.router";

const caller = () => sectionsRouter.createCaller({ user: { id: 7, role: "admin", isActive: 1, preferredLanguage: "ar" } } as any);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSectionById.mockResolvedValue({ id: 4, name: "القسم القديم", nameEn: "Old section", nameUr: "پرانا" });
  mocks.createSection.mockResolvedValue(8);
  mocks.queueTranslation.mockResolvedValue([1, 2]);
  mocks.localizeNamedRecords.mockImplementation((_entity, rows) => rows);
});

describe("section save and read translation boundaries", () => {
  it("saves a description/status edit without translating the unchanged name", async () => {
    await caller().update({ id: 4, name: "القسم القديم", description: "وصف جديد", isActive: false });
    expect(mocks.updateSection).toHaveBeenCalledWith(4, { description: "وصف جديد", isActive: false });
    expect(mocks.queueTranslation).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
  });

  it("queues a changed name after saving and clears stale direct translations", async () => {
    await caller().update({ id: 4, name: "القسم الجديد" });
    expect(mocks.updateSection).toHaveBeenCalledWith(4, { name: "القسم الجديد", nameEn: null, nameUr: null });
    expect(mocks.queueTranslation).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "SECTION", entityId: 4, fields: [{ fieldName: "name", text: "القسم الجديد" }],
    }));
  });

  it("persists a new section and queues translation without waiting for DeepSeek", async () => {
    await caller().create({ name: "قسم تجريبي", siteId: 3 });
    expect(mocks.createSection).toHaveBeenCalledWith({ name: "قسم تجريبي", siteId: 3, isActive: true });
    expect(mocks.queueTranslation).toHaveBeenCalledOnce();
  });

  it("reads sections without invoking external translation for missing names", async () => {
    mocks.getSections.mockResolvedValue([{ id: 4, name: "القسم القديم" }]);
    await caller().list();
    expect(mocks.localizeNamedRecords).toHaveBeenCalledWith(
      "SECTION", [{ id: 4, name: "القسم القديم" }], "ar", { translateMissing: false },
    );
  });
});
