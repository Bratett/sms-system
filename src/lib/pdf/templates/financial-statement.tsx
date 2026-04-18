import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { alignItems: "center", marginBottom: 16, borderBottom: "2px solid #1a1a1a", paddingBottom: 10 },
  schoolName: { fontSize: 18, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5 },
  reportTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 6 },
  periodText: { fontSize: 10, marginTop: 3, color: "#555" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6, textTransform: "uppercase", color: "#333", borderBottom: "0.5px solid #ccc", paddingBottom: 3 },
  row: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 4 },
  altRow: { backgroundColor: "#f5f5f5" },
  rowLabel: { flex: 1, fontSize: 9 },
  rowCode: { width: 50, fontSize: 9, color: "#666" },
  rowAmount: { width: 100, textAlign: "right", fontSize: 9 },
  totalRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderTop: "1.5px solid #1a1a1a", marginTop: 4 },
  totalLabel: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalAmount: { width: 100, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 10 },
  grandTotal: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 4, borderTop: "2px solid #1a1a1a", borderBottom: "2px solid #1a1a1a", marginTop: 8 },
  grandLabel: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 12 },
  grandAmount: { width: 100, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12 },
  footer: { marginTop: 24, borderTop: "0.5px solid #ccc", paddingTop: 8, alignItems: "center" },
  footerText: { fontSize: 7, color: "#888" },
  badge: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, alignSelf: "center", marginTop: 6 },
  balancedBadge: { backgroundColor: "#dcfce7", color: "#166534" },
  unbalancedBadge: { backgroundColor: "#fee2e2", color: "#991b1b" },
});

/* ─── Trial Balance ──────────────────────────────────────────────── */

interface TrialBalanceLine { accountCode: string; accountName: string; categoryName: string; debit: number; credit: number; }
interface TrialBalanceData { asOf: string | Date; lines: TrialBalanceLine[]; totalDebits: number; totalCredits: number; isBalanced: boolean; }

export const TrialBalancePdf: React.FC<{ schoolName: string; data: TrialBalanceData }> = ({ schoolName, data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.schoolName}>{schoolName}</Text>
        <Text style={styles.reportTitle}>Trial Balance</Text>
        <Text style={styles.periodText}>As at {new Date(data.asOf).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}</Text>
      </View>
      <View style={[styles.row, { backgroundColor: "#1a1a1a" }]}>
        <Text style={[styles.rowCode, { color: "#fff", fontFamily: "Helvetica-Bold" }]}>Code</Text>
        <Text style={[styles.rowLabel, { color: "#fff", fontFamily: "Helvetica-Bold" }]}>Account</Text>
        <Text style={[styles.rowAmount, { color: "#fff", fontFamily: "Helvetica-Bold" }]}>Debit</Text>
        <Text style={[styles.rowAmount, { color: "#fff", fontFamily: "Helvetica-Bold" }]}>Credit</Text>
      </View>
      {data.lines.filter((l) => l.debit > 0 || l.credit > 0).map((line, i) => (
        <View key={line.accountCode} style={[styles.row, i % 2 === 1 ? styles.altRow : {}]}>
          <Text style={styles.rowCode}>{line.accountCode}</Text>
          <Text style={styles.rowLabel}>{line.accountName}</Text>
          <Text style={styles.rowAmount}>{line.debit > 0 ? formatCurrency(line.debit) : ""}</Text>
          <Text style={styles.rowAmount}>{line.credit > 0 ? formatCurrency(line.credit) : ""}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Totals</Text>
        <Text style={styles.totalAmount}>{formatCurrency(data.totalDebits)}</Text>
        <Text style={styles.totalAmount}>{formatCurrency(data.totalCredits)}</Text>
      </View>
      <View style={[styles.badge, data.isBalanced ? styles.balancedBadge : styles.unbalancedBadge]}>
        <Text>{data.isBalanced ? "BALANCED" : "NOT BALANCED"}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Computer-generated report. Generated {new Date().toISOString()}</Text>
      </View>
    </Page>
  </Document>
);

/* ─── Balance Sheet ──────────────────────────────────────────────── */

interface BalanceSheetSection { accounts: { code: string; name: string; balance: number }[]; total: number; }
interface NetAssetsSection { accounts: { code: string; name: string; balance: number }[]; postedBalance: number; currentPeriodSurplus: number; total: number; }
interface BalanceSheetData { asOf: string | Date; assets: BalanceSheetSection; liabilities: BalanceSheetSection; netAssets: NetAssetsSection; totalLiabilitiesAndEquity: number; isBalanced: boolean; }

export const BalanceSheetPdf: React.FC<{ schoolName: string; data: BalanceSheetData }> = ({ schoolName, data }) => {
  const renderSection = (title: string, section: BalanceSheetSection) => (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {section.accounts.map((a, i) => (
        <View key={a.code} style={[styles.row, i % 2 === 1 ? styles.altRow : {}]}>
          <Text style={styles.rowCode}>{a.code}</Text>
          <Text style={styles.rowLabel}>{a.name}</Text>
          <Text style={styles.rowAmount}>{formatCurrency(a.balance)}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total {title}</Text>
        <Text style={styles.totalAmount}>{formatCurrency(section.total)}</Text>
      </View>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.reportTitle}>Balance Sheet</Text>
          <Text style={styles.periodText}>As at {new Date(data.asOf).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}</Text>
        </View>
        {renderSection("Assets", data.assets)}
        {renderSection("Liabilities", data.liabilities)}
        {renderSection("Net Assets / Equity", { accounts: data.netAssets.accounts, total: data.netAssets.postedBalance })}
        {data.netAssets.currentPeriodSurplus !== 0 && (
          <View style={[styles.row, { fontStyle: "italic" }]}>
            <Text style={[styles.rowLabel, { fontStyle: "italic" }]}>Current Period Surplus / (Deficit)</Text>
            <Text style={styles.rowAmount}>{formatCurrency(data.netAssets.currentPeriodSurplus)}</Text>
          </View>
        )}
        <View style={styles.grandTotal}>
          <Text style={styles.grandLabel}>Total Liabilities & Net Assets</Text>
          <Text style={styles.grandAmount}>{formatCurrency(data.totalLiabilitiesAndEquity)}</Text>
        </View>
        <View style={[styles.badge, data.isBalanced ? styles.balancedBadge : styles.unbalancedBadge]}>
          <Text>{data.isBalanced ? "A = L + NA  BALANCED" : "NOT BALANCED"}</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Computer-generated report. Generated {new Date().toISOString()}</Text>
        </View>
      </Page>
    </Document>
  );
};

/* ─── Income Statement ───────────────────────────────────────────── */

interface IncomeStatementLine { code: string; name: string; total: number; }
interface IncomeStatementData { periodStart: string | Date; periodEnd: string | Date; revenue: { lines: IncomeStatementLine[]; total: number }; expenses: { lines: IncomeStatementLine[]; total: number }; surplus: number; }

export const IncomeStatementPdf: React.FC<{ schoolName: string; data: IncomeStatementData }> = ({ schoolName, data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.schoolName}>{schoolName}</Text>
        <Text style={styles.reportTitle}>Income Statement</Text>
        <Text style={styles.periodText}>{new Date(data.periodStart).toLocaleDateString("en-GH")} to {new Date(data.periodEnd).toLocaleDateString("en-GH")}</Text>
      </View>
      <Text style={styles.sectionTitle}>Revenue</Text>
      {data.revenue.lines.map((l, i) => (
        <View key={l.code} style={[styles.row, i % 2 === 1 ? styles.altRow : {}]}>
          <Text style={styles.rowCode}>{l.code}</Text>
          <Text style={styles.rowLabel}>{l.name}</Text>
          <Text style={styles.rowAmount}>{formatCurrency(l.total)}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Revenue</Text>
        <Text style={[styles.totalAmount, { color: "#166534" }]}>{formatCurrency(data.revenue.total)}</Text>
      </View>
      <Text style={styles.sectionTitle}>Expenses</Text>
      {data.expenses.lines.map((l, i) => (
        <View key={l.code} style={[styles.row, i % 2 === 1 ? styles.altRow : {}]}>
          <Text style={styles.rowCode}>{l.code}</Text>
          <Text style={styles.rowLabel}>{l.name}</Text>
          <Text style={styles.rowAmount}>{formatCurrency(l.total)}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Expenses</Text>
        <Text style={[styles.totalAmount, { color: "#991b1b" }]}>{formatCurrency(data.expenses.total)}</Text>
      </View>
      <View style={styles.grandTotal}>
        <Text style={styles.grandLabel}>Net {data.surplus >= 0 ? "Surplus" : "Deficit"}</Text>
        <Text style={[styles.grandAmount, { color: data.surplus >= 0 ? "#166534" : "#991b1b" }]}>{formatCurrency(Math.abs(data.surplus))}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Computer-generated report. Generated {new Date().toISOString()}</Text>
      </View>
    </Page>
  </Document>
);
