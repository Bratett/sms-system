/**
 * IPSAS-required notes to the financial statements.
 *
 * Annual statements must be accompanied by notes that disclose the basis of
 * preparation, the significant accounting policies, and other qualitative
 * information that supplements the numbers. This module ships default
 * templates keyed by section; the finance officer can override any of them
 * before finalizing a report (stored on FinancialReport.data.notes).
 */

export type NoteSection =
  | "basis_of_preparation"
  | "reporting_entity"
  | "authorization"
  | "functional_currency"
  | "significant_policies"
  | "revenue_recognition"
  | "expense_recognition"
  | "receivables_impairment"
  | "fund_accounting"
  | "budget_comparison"
  | "related_parties"
  | "contingencies_commitments"
  | "events_after_reporting";

export interface NoteTemplate {
  section: NoteSection;
  title: string;
  body: string;
  ipsasReference?: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    section: "basis_of_preparation",
    title: "Basis of Preparation",
    body:
      "These financial statements have been prepared in accordance with International Public Sector Accounting Standards (IPSAS) on an accrual basis. The statements are presented in Ghana Cedis (GHS), which is the functional and reporting currency of the School. Amounts are rounded to the nearest pesewa unless otherwise stated.",
    ipsasReference: "IPSAS 1",
  },
  {
    section: "reporting_entity",
    title: "Reporting Entity",
    body:
      "The School is a {{schoolType}} educational institution registered under the Education Act, 2008 (Act 778) and supervised by the Ghana Education Service. These financial statements present the financial position and performance of the School as a single reporting entity.",
  },
  {
    section: "authorization",
    title: "Authorisation for Issue",
    body:
      "These financial statements were authorised for issue by the Board of Governors on {{approvalDate}}. The Board has the power to amend the financial statements after issue.",
  },
  {
    section: "functional_currency",
    title: "Functional and Presentation Currency",
    body:
      "The functional and presentation currency is the Ghana Cedi (GHS). Foreign currency transactions are translated to GHS at the Bank of Ghana reference rate on the transaction date.",
  },
  {
    section: "significant_policies",
    title: "Summary of Significant Accounting Policies",
    body:
      "Property, Plant and Equipment (PPE) is measured at cost less accumulated depreciation and impairment, per IPSAS 17. Inventory is measured at the lower of cost and net realisable value (IPSAS 12). Cash and cash equivalents comprise cash on hand, bank balances, and mobile-money wallets.",
  },
  {
    section: "revenue_recognition",
    title: "Revenue Recognition",
    body:
      "Fee revenue is recognised on the accrual basis when a StudentBill is generated and collectibility is reasonably assured (IPSAS 9). Government grants are recognised as revenue when there is no obligation to repay or return them; conditional grants are initially recognised as a deferred inflow liability and released to revenue when conditions are met (IPSAS 23). Donor contributions designated to a specific purpose are recognised in the applicable restricted fund.",
  },
  {
    section: "expense_recognition",
    title: "Expense Recognition",
    body:
      "Expenses are recognised on the accrual basis when goods are received or services are rendered. Expenses are classified by economic nature (Compensation of Employees, Goods and Services, Subsidies, etc.) following GIFMIS classification.",
  },
  {
    section: "receivables_impairment",
    title: "Receivables and Expected Credit Losses",
    body:
      "Student fees receivable are measured at amortised cost less an allowance for expected credit losses (ECL), in accordance with IPSAS 41. The allowance is estimated by applying aging-based loss rates to the gross receivable balance at each reporting date. Write-offs occur when there is no reasonable expectation of recovery (e.g., student emigration, death, board-approved debt forgiveness).",
  },
  {
    section: "fund_accounting",
    title: "Fund Accounting",
    body:
      "The School maintains separate funds for general operations, capital projects, and donor-restricted activity. Each fund is a self-balancing set of accounts in the general ledger; transfers between funds are posted as inter-fund journal entries. The Fund Statement discloses the opening and closing net assets of each fund.",
  },
  {
    section: "budget_comparison",
    title: "Budget Information",
    body:
      "The approved budget is adopted on a modified accrual basis and is presented in the Statement of Comparison of Budget and Actual Amounts (IPSAS 24). Encumbrances representing board-approved but unfilled commitments are disclosed separately and reduce available budget authority.",
  },
  {
    section: "related_parties",
    title: "Related Party Transactions",
    body:
      "Related parties include the Board of Governors, the Ministry of Education, the Ghana Education Service, and key management personnel. Transactions with related parties are disclosed in accordance with IPSAS 20 where material.",
  },
  {
    section: "contingencies_commitments",
    title: "Contingent Liabilities and Capital Commitments",
    body:
      "Contingent liabilities are disclosed where it is possible — but not probable — that an outflow of resources will be required (IPSAS 19). Capital commitments for board-approved purchase orders not yet delivered at period end are disclosed using the outstanding encumbrance balance.",
  },
  {
    section: "events_after_reporting",
    title: "Events After the Reporting Date",
    body:
      "The School has evaluated events occurring between the reporting date and the authorisation date of these financial statements. Adjusting events have been recognised in the financial statements; non-adjusting events, if material, are disclosed separately.",
  },
];

/** Merge stored overrides (from FinancialReport.data.notes) over the defaults. */
export function mergeNotes(
  overrides?: Partial<Record<NoteSection, string>>,
  variables?: Record<string, string>,
): NoteTemplate[] {
  return NOTE_TEMPLATES.map((tpl) => {
    const overridden = overrides?.[tpl.section];
    let body = overridden ?? tpl.body;
    if (variables) {
      for (const [k, v] of Object.entries(variables)) {
        body = body.replaceAll(`{{${k}}}`, v);
      }
    }
    return { ...tpl, body };
  });
}
