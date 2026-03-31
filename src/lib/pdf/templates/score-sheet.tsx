import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface ScoreSheetStudent {
  seatNumber: string;
  room: string;
  studentId: string;
  studentName: string;
}

export interface ScoreSheetProps {
  schoolName: string;
  subject: string;
  subjectCode: string | null;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  students: ScoreSheetStudent[];
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 14,
    borderBottom: '2px solid #1a1a1a',
    paddingBottom: 10,
  },
  schoolName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  infoCell: {
    width: '50%',
    flexDirection: 'row',
    paddingVertical: 3,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 90,
  },
  infoValue: {
    flex: 1,
  },
  table: {
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #ccc',
    minHeight: 24,
    alignItems: 'center',
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
  colNo: { width: '6%', textAlign: 'center' },
  colSeat: { width: '10%', textAlign: 'center' },
  colRoom: { width: '14%', textAlign: 'center' },
  colStudentId: { width: '14%', textAlign: 'center' },
  colName: { width: '30%', paddingLeft: 6 },
  colScore: { width: '13%', textAlign: 'center' },
  colSign: { width: '13%', textAlign: 'center' },
  cellText: { fontSize: 9 },
  altRow: { backgroundColor: '#f8f8f8' },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  totalRow: {
    flexDirection: 'row',
    borderTop: '1.5px solid #1a1a1a',
    minHeight: 24,
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
  },
});

/* ---------- Component ---------- */

export const ScoreSheet: React.FC<ScoreSheetProps> = (props) => {
  const { schoolName, subject, subjectCode, className, date, startTime, endTime, students } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.title}>Examination Score Sheet</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Subject:</Text>
            <Text style={styles.infoValue}>{subject}{subjectCode ? ` (${subjectCode})` : ''}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Class:</Text>
            <Text style={styles.infoValue}>{className}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>{date}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Time:</Text>
            <Text style={styles.infoValue}>{startTime} - {endTime}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colNo}><Text style={styles.tableHeaderText}>#</Text></View>
            <View style={styles.colSeat}><Text style={styles.tableHeaderText}>Seat</Text></View>
            <View style={styles.colRoom}><Text style={styles.tableHeaderText}>Room</Text></View>
            <View style={styles.colStudentId}><Text style={styles.tableHeaderText}>Student ID</Text></View>
            <View style={styles.colName}><Text style={styles.tableHeaderText}>Student Name</Text></View>
            <View style={styles.colScore}><Text style={styles.tableHeaderText}>Score</Text></View>
            <View style={styles.colSign}><Text style={styles.tableHeaderText}>Signature</Text></View>
          </View>

          {students.map((s, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.altRow : {}]}>
              <View style={styles.colNo}><Text style={styles.cellText}>{idx + 1}</Text></View>
              <View style={styles.colSeat}><Text style={styles.cellText}>{s.seatNumber}</Text></View>
              <View style={styles.colRoom}><Text style={styles.cellText}>{s.room}</Text></View>
              <View style={styles.colStudentId}><Text style={styles.cellText}>{s.studentId}</Text></View>
              <View style={styles.colName}><Text style={styles.cellText}>{s.studentName}</Text></View>
              <View style={styles.colScore}><Text style={styles.cellText}></Text></View>
              <View style={styles.colSign}><Text style={styles.cellText}></Text></View>
            </View>
          ))}

          <View style={styles.totalRow}>
            <View style={styles.colNo}><Text style={styles.cellText}></Text></View>
            <View style={styles.colSeat}><Text style={styles.cellText}></Text></View>
            <View style={styles.colRoom}><Text style={styles.cellText}></Text></View>
            <View style={styles.colStudentId}><Text style={styles.cellText}></Text></View>
            <View style={styles.colName}><Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>Total Students: {students.length}</Text></View>
            <View style={styles.colScore}><Text style={styles.cellText}></Text></View>
            <View style={styles.colSign}><Text style={styles.cellText}></Text></View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Invigilator</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Examinations Officer</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ScoreSheet;
