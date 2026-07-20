import { describe, expect, it } from "vitest";
import { extractFromRows, extractFromTextLines } from "./extract.js";

describe("extractFromTextLines (PDF / raw text)", () => {
  it("extracts numbered company lines and ignores page furniture", () => {
    const lines = [
      "Ministry of Finance",
      "Pre-Approved eInvoicing Service Providers",
      "Last updated: June 2026",
      "1. Comarch Middle East FZ LLC",
      "2. Cygnet Digital IT Solutions L.L.C",
      "3. Defmacro Software DMCC",
      "4. Pagero Gulf FZ-LLC",
      "5. SAP Middle East & North Africa LLC",
      "6. Tally Software Solutions FZCO",
      "7. Zoho Corporation FZ LLC",
      "8. Flick Network L.L.C",
      "9. EDICOM Middle East Services",
      "10. Marmin AI Software Design LLC",
      "11. Sovos Compliance FZCO",
      "12. Avalara Middle East Limited",
      "13. BDO Digital Solutions FZ-LLC",
      "14. Covoro AI FZCO",
      "15. Deloitte & Touche (M.E.)  Company",
      "16. Oxinus Holding Limited",
      "17. Skill Quotient Technologies",
      "18. SunTec Business Solutions DMCC",
      "19. Taxilla Finops 360 FZCO",
      "20. TronStride FZC",
      "21. Complyance Electronics L.L.C",
      "22. Microvista Technologies LLC",
      "Home | About | Contact",
      "Privacy Policy",
      "© 2026 Ministry of Finance",
    ];
    const result = extractFromTextLines(lines);
    expect(result.length).toBe(22);
    expect(result[0].name).toBe("Comarch Middle East FZ LLC");
    expect(result.map((r) => r.name)).not.toContain("Privacy Policy");
    expect(result.map((r) => r.name)).not.toContain("Ministry of Finance");
  });

  it("deduplicates repeated names with different suffix formatting", () => {
    const result = extractFromTextLines([
      "Comarch Middle East FZ LLC",
      "Comarch Middle East L.L.C",
    ]);
    expect(result).toHaveLength(1);
  });
});

describe("extractFromRows (HTML tables/cards)", () => {
  it("extracts name + external website from table rows, skipping headers", () => {
    const rows = [
      { cells: ["#", "Provider name", "Website"], links: [] },
      {
        cells: ["1", "Comarch Middle East FZ LLC", "comarch.ae"],
        links: ["https://www.comarch.ae/"],
      },
      {
        cells: ["2", "Pagero Gulf FZ-LLC", "pagero.com"],
        links: ["https://www.pagero.com/"],
      },
      {
        cells: ["3", "Skill Quotient Technologies", ""],
        links: ["https://mof.gov.ae/some-internal-link/"],
      },
    ];
    const result = extractFromRows(rows);
    expect(result.map((r) => r.name)).toEqual([
      "Comarch Middle East FZ LLC",
      "Pagero Gulf FZ-LLC",
      "Skill Quotient Technologies",
    ]);
    expect(result[0].website).toBe("https://www.comarch.ae/");
    // Internal MOF links are never treated as provider websites
    expect(result[2].website).toBeNull();
  });

  it("handles card/list layouts where each item is a single cell", () => {
    const rows = [
      { cells: ["Tally Software Solutions FZCO"], links: [] },
      { cells: ["Read more"], links: [] },
      { cells: ["Zoho Corporation FZ LLC"], links: ["https://www.zoho.com/ae/"] },
    ];
    const result = extractFromRows(rows);
    expect(result.map((r) => r.name)).toEqual([
      "Tally Software Solutions FZCO",
      "Zoho Corporation FZ LLC",
    ]);
  });
});
