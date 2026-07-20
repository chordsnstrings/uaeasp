/**
 * PINT AE (UAE Peppol billing specialisation) reference data.
 *
 * Source: Peppol International (PINT) model for Billing, UAE specialisation
 * (PINT AE) v1.0.2, urn:peppol:pint:billing-1@ae-1, published 2025-07-30.
 * International terms use EN 16931 / PINT identifiers (IBT-xxx); UAE-specific
 * terms use BTAE-xx. Always validate against the current official MoF /
 * Peppol specification before relying on any field.
 */

export interface DocTypeCode {
  code: string;
  name: string;
  description: string;
}

export const DOC_TYPE_CODES: DocTypeCode[] = [
  {
    code: "380",
    name: "Tax Invoice",
    description: "A UAE tax invoice. Carried in InvoiceTypeCode 380 ('Commercial invoice').",
  },
  {
    code: "381",
    name: "Tax Credit Note",
    description: "A UAE tax credit note. Carried in the credit note's type code 381.",
  },
  {
    code: "480",
    name: "Invoice — out of scope for tax",
    description:
      "A UAE commercial invoice for transactions outside the scope of VAT (code 480, 'Invoice out of scope of tax').",
  },
  {
    code: "81",
    name: "Credit note — out of scope for tax",
    description:
      "A UAE commercial credit note for out-of-scope transactions (code 81, 'Credit note related to goods or services').",
  },
];

export interface TransactionFlag {
  name: string;
  flags: string;
  description: string;
}

/** BTAE-02: 8-digit flag string in ProfileExecutionID. Position = 1 if the
 * special transaction type applies, else 0 (e.g. 00000000 for none). */
export const TRANSACTION_FLAGS: TransactionFlag[] = [
  { name: "Free Trade Zone", flags: "10000000", description: "Supplies involving a UAE Free Trade Zone." },
  { name: "Deemed Supply", flags: "01000000", description: "A deemed supply under the UAE VAT regime. Uses the predefined endpoint." },
  { name: "Profit Margin Scheme", flags: "00100000", description: "Supply taxed under the profit margin scheme." },
  { name: "Summary Invoice", flags: "00010000", description: "A summary invoice covering multiple supplies." },
  { name: "Continuous Supply", flags: "00001000", description: "A continuous supply spanning a period." },
  { name: "Disclosed Agent Billing", flags: "00000100", description: "Billing through a disclosed agent." },
  { name: "Supply through e-commerce", flags: "00000010", description: "Supply made through an e-commerce channel." },
  { name: "Exports", flags: "00000001", description: "Export transaction. When the receiver is not registered on Peppol, uses the predefined endpoint." },
];

export type Obligation = "Mandatory" | "Conditional" | "Optional";

export interface PintField {
  id: string;
  name: string;
  uae: boolean;
  obligation: Obligation;
  group: string;
  path: string;
  description: string;
}

export const PINT_FIELD_GROUPS = [
  "Document",
  "References",
  "Seller",
  "Buyer",
  "Payee / Tax rep",
  "Delivery",
  "Payment",
  "Allowance / charge",
  "Document totals",
  "VAT breakdown",
  "Invoice line",
] as const;

export const PINT_FIELDS: PintField[] = [
  { id: "BTAE-01", name: "Seller tax representative TRN", uae: true, obligation: "Conditional", group: "Payee / Tax rep", path: "cac:TaxRepresentativeParty/.../cbc:CompanyID", description: "VAT registration of the seller's tax representative." },
  { id: "BTAE-02", name: "Invoice transaction type code", uae: true, obligation: "Mandatory", group: "Document", path: "cbc:ProfileExecutionID", description: "8-digit binary flag string denoting UAE special transaction types (Free Trade Zone, Deemed Supply, Exports, etc.)." },
  { id: "BTAE-03", name: "Credit note reason code", uae: true, obligation: "Conditional", group: "Document", path: "cbc:DescriptionCode", description: "The reason a credit note was issued." },
  { id: "BTAE-05", name: "Customs duty amount", uae: true, obligation: "Conditional", group: "References", path: "cac:AdditionalDocumentReference/.../cbc:DocumentDescription", description: "Customs duty amount carried as a document description for export/import contexts." },
  { id: "BTAE-07", name: "Document UUID", uae: true, obligation: "Mandatory", group: "Document", path: "cbc:UUID", description: "A universally unique identifier for the document." },
  { id: "BTAE-08", name: "VAT amount in AED (tax accounting currency)", uae: true, obligation: "Mandatory", group: "VAT breakdown", path: "cac:TaxTotal/cbc:TaxAmount (AED)", description: "The VAT amount expressed in AED." },
  { id: "BTAE-10", name: "Line amount payable in AED", uae: true, obligation: "Mandatory", group: "Document totals", path: "cac:InvoiceLine (AED)", description: "The amount payable in AED per good/service supplied." },
  { id: "BTAE-11", name: "Buyer authority name", uae: true, obligation: "Conditional", group: "Buyer", path: "cac:PartyLegalEntity/cbc:CompanyID/@schemeAgencyName", description: "The authority that issued the buyer's registration." },
  { id: "BTAE-12", name: "Seller authority name", uae: true, obligation: "Conditional", group: "Seller", path: "cac:PartyLegalEntity/cbc:CompanyID/@schemeAgencyName", description: "The authority that issued the seller's registration." },
  { id: "BTAE-15", name: "Seller legal registration identifier type", uae: true, obligation: "Mandatory", group: "Seller", path: "cac:PartyLegalEntity/cbc:CompanyID/@schemeAgencyID", description: "The nature of the seller's registration number." },
  { id: "BTAE-16", name: "Buyer legal registration identifier type", uae: true, obligation: "Conditional", group: "Buyer", path: "cac:PartyLegalEntity/cbc:CompanyID/@schemeAgencyID", description: "The nature of the buyer's registration number." },
  { id: "BTAE-18", name: "Seller passport issuing country", uae: true, obligation: "Conditional", group: "Seller", path: "cac:PartyLegalEntity", description: "Issuing country of the seller's passport." },
  { id: "BTAE-19", name: "Buyer passport issuing country", uae: true, obligation: "Conditional", group: "Buyer", path: "cac:PartyLegalEntity", description: "Issuing country of the buyer's passport." },
  { id: "BTAE-20", name: "Invoice total with VAT in AED", uae: true, obligation: "Mandatory", group: "Document totals", path: "cac:LegalMonetaryTotal (AED)", description: "The gross amount payable expressed in AED." },
  { id: "BTAE-21", name: "Customs reference number", uae: true, obligation: "Conditional", group: "References", path: "cac:AdditionalDocumentReference", description: "Customs declaration reference for export transactions." },
  { id: "BTAE-22", name: "Incoterms", uae: true, obligation: "Conditional", group: "References", path: "cac:AdditionalDocumentReference", description: "The applicable Incoterms for an export transaction." },
  { id: "BTAE-23", name: "Deliver-to party identifier", uae: true, obligation: "Conditional", group: "Delivery", path: "cac:Delivery/cac:DeliveryParty", description: "Identifier of the party goods are delivered to (triangular sales)." },
  { id: "BTAE-24", name: "Batch number", uae: true, obligation: "Optional", group: "Invoice line", path: "cac:InvoiceLine/cac:Item", description: "Goods batch number for traceability." },
  { id: "IBT-001", name: "Invoice number", uae: false, obligation: "Mandatory", group: "Document", path: "cbc:ID", description: "A unique identifier for the invoice assigned by the seller." },
  { id: "IBT-002", name: "Invoice issue date", uae: false, obligation: "Mandatory", group: "Document", path: "cbc:IssueDate", description: "The date the invoice was issued." },
  { id: "IBT-003", name: "Invoice type code", uae: false, obligation: "Mandatory", group: "Document", path: "cbc:InvoiceTypeCode", description: "The functional type of the document." },
  { id: "IBT-005", name: "Invoice currency code", uae: false, obligation: "Mandatory", group: "Document", path: "cbc:DocumentCurrencyCode", description: "The currency of all invoice amounts." },
  { id: "IBT-006", name: "VAT accounting currency code", uae: false, obligation: "Conditional", group: "Document", path: "cbc:TaxCurrencyCode", description: "The currency used for VAT reporting where it differs from the invoice currency." },
  { id: "IBT-007", name: "Value added tax point date", uae: false, obligation: "Conditional", group: "Document", path: "cbc:TaxPointDate", description: "The date when VAT becomes accountable." },
  { id: "IBT-009", name: "Payment due date", uae: false, obligation: "Conditional", group: "Document", path: "cbc:DueDate", description: "The date by which payment is due." },
  { id: "IBT-010", name: "Buyer reference", uae: false, obligation: "Conditional", group: "Document", path: "cbc:BuyerReference", description: "An identifier provided by the buyer (e.g. cost centre)." },
  { id: "IBT-012", name: "Contract reference", uae: false, obligation: "Optional", group: "References", path: "cac:ContractDocumentReference/cbc:ID", description: "A reference to the underlying contract." },
  { id: "IBT-013", name: "Purchase order reference", uae: false, obligation: "Optional", group: "References", path: "cac:OrderReference/cbc:ID", description: "The buyer's purchase order identifier." },
  { id: "IBT-014", name: "Sales order reference", uae: false, obligation: "Optional", group: "References", path: "cac:OrderReference/cbc:SalesOrderID", description: "The seller's sales order identifier." },
  { id: "IBT-015", name: "Receiving advice reference", uae: false, obligation: "Optional", group: "References", path: "cac:ReceiptDocumentReference/cbc:ID", description: "Reference to a receiving advice." },
  { id: "IBT-016", name: "Despatch advice reference", uae: false, obligation: "Optional", group: "References", path: "cac:DespatchDocumentReference/cbc:ID", description: "Reference to a despatch advice." },
  { id: "IBT-017", name: "Tender or lot reference", uae: false, obligation: "Optional", group: "References", path: "cac:OriginatorDocumentReference/cbc:ID", description: "Reference to a tender or lot." },
  { id: "IBT-019", name: "Buyer accounting reference", uae: false, obligation: "Optional", group: "Document", path: "cbc:AccountingCost", description: "A textual reference to the buyer's accounting." },
  { id: "IBT-020", name: "Payment terms", uae: false, obligation: "Optional", group: "Payment", path: "cac:PaymentTerms/cbc:Note", description: "Textual description of the payment terms." },
  { id: "IBT-022", name: "Invoice note", uae: false, obligation: "Optional", group: "Document", path: "cbc:Note", description: "Free-text note relevant to the invoice." },
  { id: "IBT-023", name: "Business process type", uae: false, obligation: "Mandatory", group: "Document", path: "cbc:ProfileID", description: "Identifies the business process context (Peppol billing profile)." },
  { id: "IBT-024", name: "Specification identifier", uae: false, obligation: "Mandatory", group: "Document", path: "cbc:CustomizationID", description: "Identifies the specification the invoice complies with." },
  { id: "IBT-025", name: "Preceding invoice reference", uae: false, obligation: "Conditional", group: "References", path: "cac:BillingReference/.../cbc:ID", description: "Reference to a preceding invoice (e.g. for a credit note)." },
  { id: "IBT-027", name: "Seller name (legal)", uae: false, obligation: "Mandatory", group: "Seller", path: "cac:PartyLegalEntity/cbc:RegistrationName", description: "The full registered legal name of the seller." },
  { id: "IBT-028", name: "Seller trading name", uae: false, obligation: "Optional", group: "Seller", path: "cac:PartyName/cbc:Name", description: "The seller's trading/business name where different from the legal name." },
  { id: "IBT-030", name: "Seller legal registration identifier", uae: false, obligation: "Mandatory", group: "Seller", path: "cac:PartyLegalEntity/cbc:CompanyID", description: "The seller's commercial registration number issued in the UAE." },
  { id: "IBT-031", name: "Seller VAT identifier", uae: false, obligation: "Conditional", group: "Seller", path: "cac:PartyTaxScheme/cbc:CompanyID", description: "The seller's VAT (TRN) registration number." },
  { id: "IBT-033", name: "Seller additional legal information", uae: false, obligation: "Optional", group: "Seller", path: "cac:PartyLegalEntity/cbc:CompanyLegalForm", description: "Additional legal information about the seller (e.g. legal form)." },
  { id: "IBT-034", name: "Seller electronic address (endpoint)", uae: false, obligation: "Mandatory", group: "Seller", path: "cac:AccountingSupplierParty/.../cbc:EndpointID", description: "The seller's Peppol participant identifier used for routing." },
  { id: "IBT-035", name: "Seller address line 1", uae: false, obligation: "Conditional", group: "Seller", path: "cac:PostalAddress/cbc:StreetName", description: "Main address line of the seller." },
  { id: "IBT-037", name: "Seller city", uae: false, obligation: "Conditional", group: "Seller", path: "cac:PostalAddress/cbc:CityName", description: "City of the seller's address." },
  { id: "IBT-039", name: "Seller country subdivision", uae: false, obligation: "Optional", group: "Seller", path: "cac:PostalAddress/cbc:CountrySubentity", description: "Emirate / subdivision of the seller (e.g. DXB, AUH)." },
  { id: "IBT-040", name: "Seller country code", uae: false, obligation: "Mandatory", group: "Seller", path: "cac:PostalAddress/cac:Country/cbc:IdentificationCode", description: "Country of the seller." },
  { id: "IBT-044", name: "Buyer name (legal)", uae: false, obligation: "Mandatory", group: "Buyer", path: "cac:PartyLegalEntity/cbc:RegistrationName", description: "The full registered legal name of the buyer." },
  { id: "IBT-045", name: "Buyer trading name", uae: false, obligation: "Optional", group: "Buyer", path: "cac:PartyName/cbc:Name", description: "The buyer's trading/business name." },
  { id: "IBT-047", name: "Buyer legal registration identifier", uae: false, obligation: "Conditional", group: "Buyer", path: "cac:PartyLegalEntity/cbc:CompanyID", description: "The buyer's commercial registration number issued in the UAE." },
  { id: "IBT-048", name: "Buyer VAT identifier", uae: false, obligation: "Conditional", group: "Buyer", path: "cac:PartyTaxScheme/cbc:CompanyID", description: "The buyer's VAT (TRN) registration number." },
  { id: "IBT-049", name: "Buyer electronic address (endpoint)", uae: false, obligation: "Mandatory", group: "Buyer", path: "cac:AccountingCustomerParty/.../cbc:EndpointID", description: "The buyer's Peppol participant identifier used for delivery." },
  { id: "IBT-050", name: "Buyer address line 1", uae: false, obligation: "Conditional", group: "Buyer", path: "cac:PostalAddress/cbc:StreetName", description: "Main address line of the buyer." },
  { id: "IBT-052", name: "Buyer city", uae: false, obligation: "Conditional", group: "Buyer", path: "cac:PostalAddress/cbc:CityName", description: "City of the buyer's address." },
  { id: "IBT-055", name: "Buyer country code", uae: false, obligation: "Mandatory", group: "Buyer", path: "cac:PostalAddress/cac:Country/cbc:IdentificationCode", description: "Country of the buyer." },
  { id: "IBT-059", name: "Payee name", uae: false, obligation: "Conditional", group: "Payee / Tax rep", path: "cac:PayeeParty/.../cbc:Name", description: "The party to whom payment is due where different from the seller." },
  { id: "IBT-070", name: "Deliver-to party name", uae: false, obligation: "Optional", group: "Delivery", path: "cac:Delivery/cac:DeliveryParty/.../cbc:Name", description: "Name of the deliver-to party." },
  { id: "IBT-072", name: "Actual delivery date", uae: false, obligation: "Optional", group: "Delivery", path: "cac:Delivery/cbc:ActualDeliveryDate", description: "The date goods/services were delivered." },
  { id: "IBT-077", name: "Deliver-to city", uae: false, obligation: "Optional", group: "Delivery", path: "cac:Delivery/.../cbc:CityName", description: "City of the delivery address." },
  { id: "IBT-081", name: "Payment means type code", uae: false, obligation: "Optional", group: "Payment", path: "cac:PaymentMeans/cbc:PaymentMeansCode", description: "The means of payment (e.g. credit transfer, card)." },
  { id: "IBT-084", name: "Payment account identifier", uae: false, obligation: "Conditional", group: "Payment", path: "cac:PayeeFinancialAccount/cbc:ID", description: "The account to which payment should be made (e.g. IBAN)." },
  { id: "IBT-092", name: "Document allowance amount", uae: false, obligation: "Conditional", group: "Allowance / charge", path: "cac:AllowanceCharge/cbc:Amount", description: "A discount applied at document level." },
  { id: "IBT-097", name: "Allowance reason", uae: false, obligation: "Optional", group: "Allowance / charge", path: "cac:AllowanceCharge/cbc:AllowanceChargeReason", description: "The reason for an allowance." },
  { id: "IBT-099", name: "Document charge amount", uae: false, obligation: "Conditional", group: "Allowance / charge", path: "cac:AllowanceCharge/cbc:Amount", description: "A charge applied at document level." },
  { id: "IBT-106", name: "Sum of line net amounts", uae: false, obligation: "Mandatory", group: "Document totals", path: "cac:LegalMonetaryTotal/cbc:LineExtensionAmount", description: "Sum of all invoice line net amounts." },
  { id: "IBT-109", name: "Invoice total without VAT", uae: false, obligation: "Mandatory", group: "Document totals", path: "cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount", description: "The total amount of the invoice excluding VAT." },
  { id: "IBT-110", name: "Invoice total VAT amount", uae: false, obligation: "Mandatory", group: "Document totals", path: "cac:TaxTotal/cbc:TaxAmount", description: "The total VAT amount of the invoice." },
  { id: "IBT-112", name: "Invoice total with VAT", uae: false, obligation: "Mandatory", group: "Document totals", path: "cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount", description: "The total amount of the invoice including VAT." },
  { id: "IBT-113", name: "Paid amount", uae: false, obligation: "Optional", group: "Document totals", path: "cac:LegalMonetaryTotal/cbc:PrepaidAmount", description: "Any amount already paid." },
  { id: "IBT-114", name: "Rounding amount", uae: false, obligation: "Optional", group: "Document totals", path: "cac:LegalMonetaryTotal/cbc:PayableRoundingAmount", description: "Amount added to round the payable total." },
  { id: "IBT-115", name: "Amount due for payment", uae: false, obligation: "Mandatory", group: "Document totals", path: "cac:LegalMonetaryTotal/cbc:PayableAmount", description: "The outstanding amount to be paid." },
  { id: "IBT-116", name: "VAT category taxable amount", uae: false, obligation: "Mandatory", group: "VAT breakdown", path: "cac:TaxSubtotal/cbc:TaxableAmount", description: "The taxable base for a VAT category." },
  { id: "IBT-117", name: "VAT category tax amount", uae: false, obligation: "Mandatory", group: "VAT breakdown", path: "cac:TaxSubtotal/cbc:TaxAmount", description: "The VAT amount for a category." },
  { id: "IBT-118", name: "VAT category code", uae: false, obligation: "Mandatory", group: "VAT breakdown", path: "cac:TaxCategory/cbc:ID", description: "The VAT category." },
  { id: "IBT-119", name: "VAT category rate", uae: false, obligation: "Conditional", group: "VAT breakdown", path: "cac:TaxCategory/cbc:Percent", description: "The VAT rate for the category." },
  { id: "IBT-122", name: "Supporting document reference", uae: false, obligation: "Optional", group: "References", path: "cac:AdditionalDocumentReference/cbc:ID", description: "Identifier of a supporting document." },
  { id: "IBT-124", name: "Supporting document URI", uae: false, obligation: "Optional", group: "References", path: "cac:AdditionalDocumentReference/.../cbc:URI", description: "A link to an external supporting document." },
  { id: "IBT-126", name: "Invoice line identifier", uae: false, obligation: "Mandatory", group: "Invoice line", path: "cac:InvoiceLine/cbc:ID", description: "A unique identifier for the invoice line." },
  { id: "IBT-129", name: "Invoiced quantity", uae: false, obligation: "Mandatory", group: "Invoice line", path: "cac:InvoiceLine/cbc:InvoicedQuantity", description: "The quantity of items invoiced on the line." },
  { id: "IBT-130", name: "Invoiced quantity unit of measure", uae: false, obligation: "Mandatory", group: "Invoice line", path: "cac:InvoiceLine/cbc:InvoicedQuantity/@unitCode", description: "The unit of measure for the invoiced quantity." },
  { id: "IBT-131", name: "Invoice line net amount", uae: false, obligation: "Mandatory", group: "Invoice line", path: "cac:InvoiceLine/cbc:LineExtensionAmount", description: "The net amount of the invoice line, after line discounts, before VAT." },
  { id: "IBT-146", name: "Item net price", uae: false, obligation: "Mandatory", group: "Invoice line", path: "cac:Price/cbc:PriceAmount", description: "The net unit price of the item." },
  { id: "IBT-151", name: "Item VAT category code", uae: false, obligation: "Mandatory", group: "Invoice line", path: "cac:Item/cac:ClassifiedTaxCategory/cbc:ID", description: "The VAT category that applies to the line item." },
  { id: "IBT-152", name: "Item VAT rate", uae: false, obligation: "Conditional", group: "Invoice line", path: "cac:Item/cac:ClassifiedTaxCategory/cbc:Percent", description: "The VAT rate that applies to the line item." },
  { id: "IBT-153", name: "Item name", uae: false, obligation: "Mandatory", group: "Invoice line", path: "cac:Item/cbc:Name", description: "The name of the item invoiced on the line." },
  { id: "IBT-154", name: "Item description", uae: false, obligation: "Optional", group: "Invoice line", path: "cac:Item/cbc:Description", description: "A description of the item." },
  { id: "IBT-168", name: "Invoice issue time", uae: false, obligation: "Optional", group: "Document", path: "cbc:IssueTime", description: "The time the invoice was issued." },
];

export const PINT_AE_VERSION = "PINT AE v1.0.2 (urn:peppol:pint:billing-1@ae-1), published 2025-07-30";
