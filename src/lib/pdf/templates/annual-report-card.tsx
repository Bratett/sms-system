import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface AnnualSubjectRow {
  name: string;
  term1Score: number | null;
  term2Score: number | null;
  term3Score: number | null;
  averageScore: number | null;
  grade: string;
  interpretation: string;
  position: string | number;
}

export interface AnnualReportCardProps {
  schoolName: string;
  schoolMotto: string;
  studentName: string;
  studentId: string;
  className: string;
  programme: string;
  academicYear: string;
  subjects: AnnualSubjectRow[];
  totalScore: number;
  averageScore: number;
  classPosition: string | number;
  totalStudents: number;
  overallGrade: string;
  promotionStatus: string;
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
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  schoolMotto: {
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 2,
    color: '#444',
  },
  reportTitle: {
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
    width: 110,
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
    minHeight: 20,
    alignItems: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    minHeight: 24,
    alignItems: 'center',
  },
  tableHeaderText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  colSubject: { width: '20%', paddingLeft: 6 },
  colTerm: { width: '12%', textAlign: 'center' },
  colAvg: { width: '12%', textAlign: 'center' },
  colGrade: { width: '8%', textAlign: 'center' },
  colInterpretation: { width: '16%', textAlign: 'center' },
  colPosition: { width: '8%', textAlign: 'center' },
  cellText: { fontSize: 9 },
  altRow: { backgroundColor: '#f5f5f5' },
  summarySection: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    border: '1px solid #ccc',
    padding: 8,
    borderRadius: 3,
  },
  summaryTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 6,
    borderBottom: '0.5px solid #ccc',
    paddingBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  summaryValue: { fontSize: 9 },
  promotionBox: {
    border: '1.5px solid #1a1a1a',
    padding: 10,
    borderRadius: 3,
    marginBottom: 14,
    alignItems: 'center',
  },
  promotionText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  gradingSection: {
    marginTop: 14,
    borderTop: '0.5px solid #ccc',
    paddingTop: 8,
  },
  gradingTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginBottom: 4,
  },
  gradingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gradingItem: {
    fontSize: 7,
    color: '#555',
  },
});

const GRADING_KEY = [
  { grade: 'A1', range: '80-100', meaning: 'Excellent' },
  { grade: 'B2', range: '75-79', meaning: 'Very Good' },
  { grade: 'B3', range: '70-74', meaning: 'Good' },
  { grade: 'C4', range: '65-69', meaning: 'Credit' },
  { grade: 'C5', range: '60-64', meaning: 'Credit' },
  { grade: 'C6', range: '55-59', meaning: 'Credit' },
  { grade: 'D7', range: '50-54', meaning: 'Pass' },
  { grade: 'E8', range: '45-49', meaning: 'Pass' },
  { grade: 'F9', range: '0-44', meaning: 'Fail' },
];

/* ---------- Component ---------- */

export const AnnualReportCard: React.FC<AnnualReportCardProps> = (props) => {
  const {
    schoolName, schoolMotto, studentName, studentId, className, programme,
    academicYear, subjects, totalScore, averageScore, classPosition,
    totalStudents, overallGrade, promotionStatus,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.schoolMotto}>{schoolMotto}</Text>
          <Text style={styles.reportTitle}>Annual Report Card</Text>
        </View>

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
            <Text style={styles.infoLabel}>Programme:</Text>
            <Text style={styles.infoValue}>{programme || '---'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Academic Year:</Text>
            <Text style={styles.infoValue}>{academicYear}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colSubject}><Text style={styles.tableHeaderText}>Subject</Text></View>
            <View style={styles.colTerm}><Text style={styles.tableHeaderText}>Term 1</Text></View>
            <View style={styles.colTerm}><Text style={styles.tableHeaderText}>Term 2</Text></View>
            <View style={styles.colTerm}><Text style={styles.tableHeaderText}>Term 3</Text></View>
            <View style={styles.colAvg}><Text style={styles.tableHeaderText}>Average</Text></View>
            <View style={styles.colGrade}><Text style={styles.tableHeaderText}>Grade</Text></View>
            <View style={styles.colInterpretation}><Text style={styles.tableHeaderText}>Interpretation</Text></View>
            <View style={styles.colPosition}><Text style={styles.tableHeaderText}>Pos.</Text></View>
          </View>

          {subjects.map((subj, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.altRow : {}]}>
              <View style={styles.colSubject}><Text style={styles.cellText}>{subj.name}</Text></View>
              <View style={styles.colTerm}><Text style={styles.cellText}>{subj.term1Score?.toFixed(1) ?? '-'}</Text></View>
              <View style={styles.colTerm}><Text style={styles.cellText}>{subj.term2Score?.toFixed(1) ?? '-'}</Text></View>
              <View style={styles.colTerm}><Text style={styles.cellText}>{subj.term3Score?.toFixed(1) ?? '-'}</Text></View>
              <View style={styles.colAvg}><Text style={styles.cellText}>{subj.averageScore?.toFixed(1) ?? '-'}</Text></View>
              <View style={styles.colGrade}><Text style={styles.cellText}>{subj.grade}</Text></View>
              <View style={styles.colInterpretation}><Text style={styles.cellText}>{subj.interpretation}</Text></View>
              <View style={styles.colPosition}><Text style={styles.cellText}>{String(subj.position)}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Annual Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Score:</Text>
              <Text style={styles.summaryValue}>{totalScore.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Annual Average:</Text>
              <Text style={styles.summaryValue}>{averageScore.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Overall Grade:</Text>
              <Text style={styles.summaryValue}>{overallGrade}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Class Position:</Text>
              <Text style={styles.summaryValue}>{String(classPosition)} out of {totalStudents}</Text>
            </View>
          </View>
        </View>

        <View style={styles.promotionBox}>
          <Text style={styles.promotionText}>Promotion Status: {promotionStatus || 'PENDING'}</Text>
        </View>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Class Teacher</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Headmaster / Headmistress</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>

        <View style={styles.gradingSection}>
          <Text style={styles.gradingTitle}>Ghana SHS Grading Key</Text>
          <View style={styles.gradingRow}>
            {GRADING_KEY.map((g) => (
              <Text key={g.grade} style={styles.gradingItem}>
                {g.grade} ({g.range}) - {g.meaning}
              </Text>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default AnnualReportCard;
