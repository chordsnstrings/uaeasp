import { describe, expect, it } from "vitest";
import { buildContacts, extractFromRows, extractFromTextLines } from "./extract.js";

/** Rows shaped exactly like the live MOF table (innerText per cell). */
const MOF_ROWS = [
  {
    cells: ["#", "Company Name", "Company Website", "Contact Person", "Email", "Phone Number"],
    links: [],
  },
  {
    // Two persons, two emails, two phones → paired by position
    cells: [
      "1",
      "Advintek Consulting Services LLC",
      "www.einvoice.advintek.ae",
      "Sajid Hameed\nSanam Wadhwa",
      "sajid@advintek.ae\nsanam@advintek.ae",
      "+971557469502\n+971502160782",
    ],
    links: ["https://www.einvoice.advintek.ae"],
  },
  {
    // One person, two emails, one phone → everything pooled on the person
    cells: [
      "4",
      "Casim L.L.C-FZ",
      "www.casim.ae",
      "Stuart McKechnie",
      "hello@casim.ae\nstuart.mckechnie@casim.ae",
      "+971551051174",
    ],
    links: ["https://www.casim.ae"],
  },
  {
    // Two persons, ONE shared email, two phones
    cells: [
      "7",
      "Covoro AI – FZCO",
      "www.covoro.ai/uae",
      "Paresh Bafna\nDipayan Das",
      "uae@covoro.ai",
      "+971 589767230\n+971 55 881 7248",
    ],
    links: ["https://www.covoro.ai/uae"],
  },
  {
    // Local-format toll-free phone number
    cells: [
      "13",
      "EDICOM Middle East Services",
      "www.edicomgroup.com",
      "Andre Menezes",
      "amenezes@edicomgroup.com",
      "8000320420",
    ],
    links: ["https://www.edicomgroup.com"],
  },
  {
    // Website only as text token, no link element
    cells: [
      "22",
      "KGRN Chartered Accountants",
      "www.kgrnaudit.com",
      "Gopu Rama Naidu",
      "gopu@kgrnaudit.com",
      "+971504520648",
    ],
    links: [],
  },
];

describe("extractFromRows (MOF 6-column table)", () => {
  const result = extractFromRows(MOF_ROWS);

  it("extracts every provider row and skips the header", () => {
    expect(result.map((r) => r.name)).toEqual([
      "Advintek Consulting Services LLC",
      "Casim L.L.C-FZ",
      "Covoro AI – FZCO",
      "EDICOM Middle East Services",
      "KGRN Chartered Accountants",
    ]);
  });

  it("pairs persons with emails/phones by position when counts match", () => {
    const advintek = result[0];
    expect(advintek.contacts).toEqual([
      { name: "Sajid Hameed", emails: ["sajid@advintek.ae"], phones: ["+971557469502"] },
      { name: "Sanam Wadhwa", emails: ["sanam@advintek.ae"], phones: ["+971502160782"] },
    ]);
  });

  it("pools emails/phones on the first contact when counts differ", () => {
    const casim = result[1];
    expect(casim.contacts).toEqual([
      {
        name: "Stuart McKechnie",
        emails: ["hello@casim.ae", "stuart.mckechnie@casim.ae"],
        phones: ["+971551051174"],
      },
    ]);
    // Covoro: shared email pooled on first contact, phones paired per person
    const covoro = result[2];
    expect(covoro.contacts![0]).toEqual({
      name: "Paresh Bafna",
      emails: ["uae@covoro.ai"],
      phones: ["+971589767230"],
    });
    expect(covoro.contacts![1]).toEqual({
      name: "Dipayan Das",
      emails: [],
      phones: ["+971558817248"],
    });
  });

  it("keeps local-format phone numbers and falls back to www tokens for the website", () => {
    const edicom = result[3];
    expect(edicom.contacts![0].phones).toEqual(["8000320420"]);
    const kgrn = result[4];
    expect(kgrn.website).toBe("https://www.kgrnaudit.com");
  });

  it("uses the row's external link as the website when present", () => {
    expect(result[0].website).toBe("https://www.einvoice.advintek.ae");
  });
});

describe("buildContacts", () => {
  it("returns a nameless contact when only emails/phones exist", () => {
    expect(buildContacts(["sales@x.ae", "+971501234567"])).toEqual([
      { emails: ["sales@x.ae"], phones: ["+971501234567"] },
    ]);
  });

  it("returns empty when there is nothing contact-like", () => {
    expect(buildContacts(["www.example.ae"])).toEqual([]);
  });
});

describe("extractFromTextLines (PDF fallback)", () => {
  it("extracts numbered company lines and ignores furniture and emails", () => {
    const lines = [
      "Ministry of Finance",
      "Pre-Approved eInvoicing Service Providers",
      "1. Comarch Middle East FZ LLC",
      "2. Pagero Gulf FZ-LLC",
      "3. SAP Middle East & North Africa LLC",
      "4. Tally Software Solutions FZCO",
      "5. Defmacro Software DMCC (ClearTax)",
      "sales@flick.network",
      "Privacy Policy",
      "© 2026 Ministry of Finance",
    ];
    const result = extractFromTextLines(lines);
    expect(result.map((r) => r.name)).toEqual([
      "Comarch Middle East FZ LLC",
      "Pagero Gulf FZ-LLC",
      "SAP Middle East & North Africa LLC",
      "Tally Software Solutions FZCO",
      "Defmacro Software DMCC (ClearTax)",
    ]);
  });

  it("deduplicates repeated names with different suffix formatting", () => {
    const result = extractFromTextLines([
      "Comarch Middle East FZ LLC",
      "Comarch Middle East L.L.C",
    ]);
    expect(result).toHaveLength(1);
  });
});
