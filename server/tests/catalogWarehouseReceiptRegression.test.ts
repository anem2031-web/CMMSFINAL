import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("../_core/ai-response-cache", () => ({
  withAiResponseCache: async ({ producer }: { producer: () => Promise<unknown> }) => ({
    value: await producer(), source: "producer", cacheKey: "test",
  }),
}));
import { invokeLLM } from "../_core/llm";
import { applyAiSemanticDiscovery, compareMeasurements, normalizeCatalogItemText, rankCatalogItemMatches } from "../_core/catalog-item-matching";

const nameAr = "خشب ماهوجني سمك 5 سم عرض 30 سم طول 2.5 متر";
const nameEn = "Mahogany Wood 5cm x 30cm x 2.5m";
// Reproduction fixture from the report bundled with 545.zip, not a live DB read.
const mahogany = { id: 180265, code: "21-0030", nameAr, nameEn };

afterEach(() => vi.resetAllMocks());

describe("warehouse receipt catalog regression", () => {
  it.each([
    { itemName: nameAr },
    { itemName: nameEn },
    { itemName: nameAr, itemNameEn: nameEn },
  ])("keeps bilingual dimensions separate and bypasses AI: %j", async query => {
    const matches = rankCatalogItemMatches({ query, catalogItems: [mahogany] });
    expect(matches[0]).toMatchObject({ catalogItemId: 180265, score: 96, measurementStatus: "compatible", autoSelect: false });
    expect(await applyAiSemanticDiscovery({ query, catalogItems: [mahogany], deterministicCandidates: matches })).toEqual(matches);
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("does not double the same-language supplier alias and catalog dimensions", () => {
    const matches = rankCatalogItemMatches({
      query: { itemName: nameAr, supplierItemCode: "WOOD-5" }, catalogItems: [mahogany],
      supplierAliases: [{ id: 1, supplierId: 7, catalogItemId: mahogany.id, supplierItemName: nameAr,
        normalizedName: normalizeCatalogItemText(nameAr), supplierItemCode: "WOOD-5" }],
    });
    expect(matches[0]).toMatchObject({ score: 100, measurementStatus: "compatible", autoSelect: true });
  });

  it("preserves real repeated dimensions and detects a wrong translation", () => {
    expect(compareMeasurements("5cm x 5cm", "5cm").status).toBe("conflict");
    const query = { itemName: "لوح 5 سم × 5 سم" };
    expect(rankCatalogItemMatches({ query, catalogItems: [{ id: 1, nameAr: query.itemName, nameEn: "Board 5cm x 5cm" }] })[0]?.measurementStatus).toBe("compatible");
    expect(rankCatalogItemMatches({ query, catalogItems: [{ id: 1, nameAr: query.itemName, nameEn: "Board 5cm" }] })[0]?.measurementStatus).toBe("conflict");
    expect(rankCatalogItemMatches({ query: { itemName: nameAr }, catalogItems: [{ ...mahogany, nameEn: "Mahogany Wood 6cm x 30cm x 2.5m" }] })[0]?.measurementStatus).toBe("conflict");
  });

  it("keeps deterministic results when the bounded AI fallback fails", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM request timed out after 15000ms"));
    const query = { itemName: "خشب ماهوجني خام" };
    const matches = rankCatalogItemMatches({ query, catalogItems: [mahogany] });
    expect(await applyAiSemanticDiscovery({ query, catalogItems: [mahogany], deterministicCandidates: matches })).toEqual(matches);
    expect(invokeLLM).toHaveBeenCalled();
    for (const [params] of vi.mocked(invokeLLM).mock.calls) expect(params.timeoutMs).toBe(15_000);
  });
});
