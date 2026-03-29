import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface PayslipAllowance {
  name: string;
  amount: number;
}

export interface PayslipDeduction {
  name: string;
  amount: number;
}

export interface PayslipProps {
  schoolName: string;
  staffName: string;
  staffId: string;
  department: string;
  month: string;
  year: string | number;
  basicSalary: number;
  allowances: PayslipAllowance[];
  deductions: PayslipDeduction[];
  totalAllowances: number;
  totalDeductions: number;
  netPay: number;
  paymentMethod: string;
  bankDetails: string;
}

/* ---------- Helpers ---------- */

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },

  /* Header */
  headerSection: {
    alignItems: 'center',
    marginBottom: 14,
    borderBottom: '2px solid #1a1a1a',
    paddingBottom: 10,
  },
  schoolName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  payslipTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  periodText: {
    fontSize: 10,
    marginTop: 3,
    color: '#555',
  },

  /* Staff info grid */
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  infoCell: {
    width: '50%',
    flexDirection: 'row',
    paddingVertical: 3,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 120,
  },
  infoValue: {
    flex: 1,
  },

  /* Earnings / Deductions side-by-side */
  columnsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    padding: 6,
    textAlign: 'center',
  },

  /* Items */
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottom: '0.5px solid #e0e0e0',
  },
  altItemRow: {
    backgroundColor: '#f5f5f5',
  },
  itemName: {
    fontSize: 9,
    flex: 1,
  },
  itemAmount: {
    fontSize: 9,
    textAlign: 'right',
    width: 90,
  },

  /* Sub-total rows */
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTop: '1px solid #1a1a1a',
    marginTop: 2,
  },
  subtotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  subtotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textAlign: 'right',
    width: 90,
  },

  /* Net pay box */
  netPaySection: {
    border: '2px solid #1a1a1a',
    borderRadius: 3,
    padding: 10,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netPayLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
  },
  netPayValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
  },

  /* Payment info */
  paymentSection: {
    border: '1px solid #ccc',
    borderRadius: 3,
    padding: 10,
    marginBottom: 16,
  },
  paymentTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 6,
    borderBottom: '0.5px solid #ccc',
    paddingBottom: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  paymentLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 130,
    fontSize: 9,
  },
  paymentValue: {
    flex: 1,
    fontSize: 9,
  },

  /* Signatures */
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  signatureBlock: {
    width: '30%',
    alignItems: 'center',
  },
  signatureLine: {
    borderBottom: '1px solid #1a1a1a',
    width: '100%',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#444',
  },

  /* Footer */
  footer: {
    marginTop: 20,
    borderTop: '0.5px solid #ccc',
    paddingTop: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    color: '#888',
  },
});

/* ---------- Component ---------- */

export const Payslip: React.FC<PayslipProps> = (props) => {
  const {
    schoolName,
    staffName,
    staffId,
    department,
    month,
    year,
    basicSalary,
    allowances,
    deductions,
    totalAllowances,
    totalDeductions,
    netPay,
    paymentMethod,
    bankDetails,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.payslipTitle}>Staff Payslip</Text>
          <Text style={styles.periodText}>
            Pay Period: {month} {year}
          </Text>
        </View>

        {/* Staff Info */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Staff Name:</Text>
            <Text style={styles.infoValue}>{staffName}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Staff ID:</Text>
            <Text style={styles.infoValue}>{staffId}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Department:</Text>
            <Text style={styles.infoValue}>{department}</Text>
          </View>
        </View>

        {/* Earnings and Deductions */}
        <View style={styles.columnsContainer}>
          {/* Earnings */}
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Earnings</Text>

            <View style={styles.itemRow}>
              <Text style={styles.itemName}>Basic Salary</Text>
              <Text style={styles.itemAmount}>
                {formatCurrency(basicSalary)}
              </Text>
            </View>

            {allowances.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.itemRow,
                  (idx + 1) % 2 === 1 ? styles.altItemRow : {},
                ]}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemAmount}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}

            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Total Earnings:</Text>
              <Text style={styles.subtotalValue}>
                {formatCurrency(basicSalary + totalAllowances)}
              </Text>
            </View>
          </View>

          {/* Deductions */}
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Deductions</Text>

            {deductions.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.itemRow,
                  idx % 2 === 1 ? styles.altItemRow : {},
                ]}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemAmount}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}

            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Total Deductions:</Text>
              <Text style={styles.subtotalValue}>
                {formatCurrency(totalDeductions)}
              </Text>
            </View>
          </View>
        </View>

        {/* Net Pay */}
        <View style={styles.netPaySection}>
          <Text style={styles.netPayLabel}>Net Pay:</Text>
          <Text style={styles.netPayValue}>{formatCurrency(netPay)}</Text>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Information</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Method:</Text>
            <Text style={styles.paymentValue}>{paymentMethod}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Bank Details:</Text>
            <Text style={styles.paymentValue}>{bankDetails}</Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Bursar / Accountant</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Headmaster / Headmistress
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Employee Signature</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a computer-generated payslip. Please retain for your
            records.
          </Text>
          <Text style={styles.footerText}>
            If you have any queries, please contact the accounts department.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default Payslip;
