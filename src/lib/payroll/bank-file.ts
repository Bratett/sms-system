/**
 * Bank payment file generation for payroll disbursement.
 */

export interface PayrollEntry {
  staffId: string;
  staffName: string;
  bankName: string;
  bankBranch?: string;
  accountNumber: string;
  sortCode?: string;
  netPay: number;
  reference: string;
}

export interface BankFileResult {
  content: string;
  filename: string;
  format: string;
  totalAmount: number;
  recordCount: number;
}

export function generateCSVBankFile(
  entries: PayrollEntry[],
  metadata: { schoolName: string; payrollPeriod: string; date: string },
): BankFileResult {
  const headers = "Staff ID,Staff Name,Bank Name,Branch,Account Number,Sort Code,Amount,Reference";
  const rows = entries.map((e) =>
    [e.staffId, `"${e.staffName}"`, `"${e.bankName}"`, `"${e.bankBranch || ""}"`, e.accountNumber, e.sortCode || "", e.netPay.toFixed(2), e.reference].join(","),
  );

  const totalAmount = entries.reduce((s, e) => s + e.netPay, 0);
  const content = [
    `# Bank Payment File - ${metadata.schoolName}`,
    `# Period: ${metadata.payrollPeriod}`,
    `# Date: ${metadata.date}`,
    `# Total: ${totalAmount.toFixed(2)}`,
    `# Records: ${entries.length}`,
    "",
    headers,
    ...rows,
  ].join("\n");

  return {
    content,
    filename: `payroll-${metadata.payrollPeriod}-${metadata.date}.csv`,
    format: "csv",
    totalAmount,
    recordCount: entries.length,
  };
}
