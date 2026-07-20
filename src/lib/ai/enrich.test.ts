import { describe, expect, it } from "vitest";
import { parseEnrichment } from "./enrich";

const VALID = {
  category: "tax-tech",
  description_en:
    "Example Co is a pre-approved e-invoicing service provider under the UAE Ministry of Finance accreditation framework, offering invoice exchange over the Peppol network.",
  description_ar:
    "شركة مثال هي مزود خدمات فوترة إلكترونية معتمد مبدئياً ضمن إطار اعتماد وزارة المالية الإماراتية، وتقدم تبادل الفواتير عبر شبكة Peppol.",
};

describe("parseEnrichment", () => {
  it("parses a plain JSON response", () => {
    const result = parseEnrichment(JSON.stringify(VALID));
    expect(result?.category).toBe("tax-tech");
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    const result = parseEnrichment("```json\n" + JSON.stringify(VALID) + "\n```");
    expect(result?.description_en).toContain("Example Co");
  });

  it("rejects invalid categories", () => {
    expect(
      parseEnrichment(JSON.stringify({ ...VALID, category: "blockchain" })),
    ).toBeNull();
  });

  it("rejects too-short descriptions and non-JSON responses", () => {
    expect(parseEnrichment(JSON.stringify({ ...VALID, description_en: "Short." }))).toBeNull();
    expect(parseEnrichment("I cannot help with that.")).toBeNull();
  });
});
