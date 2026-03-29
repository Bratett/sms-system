import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface ReceiptLineItem {
  description: string;
  amount: number;
}

export interface ReceiptProps {
  schoolName: string;
  receiptNumber: string;
  studentName: string;
  studentId: string;
  className: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  items: ReceiptLineItem[];
  totalAmount: number;
  paidBy: string;
  receivedBy: string;
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
    marginBottom: 16,
    borderBottom: '2px solid #1a1a1a',
    paddingBottom: 10,
  },
  schoolName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  receiptTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  receiptNumber: {
    fontSize: 10,
    marginTop: 3,
    color: '#555',
  },

  /* Info grid */
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
    width: 110,
  },
  infoValue: {
    flex: 1,
  },

  /* Items table */
  table: {
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    minHeight: 26,
    alignItems: 'center',
  },
  tableHeaderText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #ccc',
    minHeight: 22,
    alignItems: 'center',
  },
  altRow: {
    backgroundColor: '#f5f5f5',
  },
  colIndex: { width: '8%', textAlign: 'center' },
  colDescription: { width: '62%', paddingLeft: 8 },
  colAmount: { width: '30%', textAlign: 'right', paddingRight: 8 },
  cellText: {
    fontSize: 9,
  },

  /* Total */
  totalRow: {
    flexDirection: 'row',
    borderTop: '1.5px solid #1a1a1a',
    minHeight: 28,
    alignItems: 'center',
    marginTop: 2,
  },
  totalLabel: {
    width: '70%',
    textAlign: 'right',
    paddingRight: 10,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  totalValue: {
    width: '30%',
    textAlign: 'right',
    paddingRight: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },

  /* Payment details */
  paymentSection: {
    marginTop: 10,
    marginBottom: 16,
    border: '1px solid #ccc',
    borderRadius: 3,
    padding: 10,
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
    marginTop: 30,
  },
  signatureBlock: {
    width: '40%',
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
    marginTop: 24,
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

export const Receipt: React.FC<ReceiptProps> = (props) => {
  const {
    schoolName,
    receiptNumber,
    studentName,
    studentId,
    className,
    paymentDate,
    paymentMethod,
    referenceNumber,
    items,
    totalAmount,
    paidBy,
    receivedBy,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* School Header */}
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.receiptTitle}>Payment Receipt</Text>
          <Text style={styles.receiptNumber}>
            Receipt No: {receiptNumber}
          </Text>
        </View>

        {/* Student / Payment Info */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Student Name:</Text>
            <Text style={styles.infoValue}>{studentName}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Student ID:</Text>
            <Text style={styles.infoValue}>{studentId}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Class:</Text>
            <Text style={styles.infoValue}>{className}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Payment Date:</Text>
            <Text style={styles.infoValue}>{paymentDate}</Text>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colIndex}>
              <Text style={styles.tableHeaderText}>#</Text>
            </View>
            <View style={styles.colDescription}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
            <View style={styles.colAmount}>
              <Text style={styles.tableHeaderText}>Amount</Text>
            </View>
          </View>

          {items.map((item, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.altRow : {}]}
            >
              <View style={styles.colIndex}>
                <Text style={styles.cellText}>{idx + 1}</Text>
              </View>
              <View style={styles.colDescription}>
                <Text style={styles.cellText}>{item.description}</Text>
              </View>
              <View style={styles.colAmount}>
                <Text style={styles.cellText}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </View>
          ))}

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(totalAmount)}
            </Text>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Details</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Method:</Text>
            <Text style={styles.paymentValue}>{paymentMethod}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Reference Number:</Text>
            <Text style={styles.paymentValue}>{referenceNumber}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Paid By:</Text>
            <Text style={styles.paymentValue}>{paidBy}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Received By:</Text>
            <Text style={styles.paymentValue}>{receivedBy}</Text>
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
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a computer-generated receipt. Please retain for your
            records.
          </Text>
          <Text style={styles.footerText}>
            For enquiries, contact the school&apos;s accounts department.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default Receipt;
