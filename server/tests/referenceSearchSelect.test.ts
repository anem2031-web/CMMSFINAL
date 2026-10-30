import { describe, expect, it } from "vitest";
import { normalizeReferenceSearch } from "../../client/src/components/tickets/ReferenceSearchSelect";

describe("reference picker search", () => {
  it("matches Arabic letter variants from the first typed character", () => {
    const name = normalizeReferenceSearch("إضاءة الشاليهات");
    expect(name.includes(normalizeReferenceSearch("ا"))).toBe(true);
    expect(name.includes(normalizeReferenceSearch("اضاءه"))).toBe(true);
  });

  it("matches English names without case sensitivity", () => {
    expect(normalizeReferenceSearch("Main Games Area").includes(normalizeReferenceSearch("games"))).toBe(true);
  });
});
