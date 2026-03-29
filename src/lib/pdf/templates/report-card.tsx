import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface SubjectRow {
  name: string;
  classScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  interpretation: string;
  position: string | number;
  remarks: string;
}

export interface Attendance {
  present: number;
  absent: number;
  total: number;
}

export interface ReportCardProps {
  schoolName: string;
  schoolMotto: string;
  studentName: string;
  studentId: string;
  className: string;
  termName: string;
  academicYear: string;
  subjects: SubjectRow[];
  totalScore: number;
  averageScore: number;
  classPosition: string | number;
  totalStudents: number;
  classTeacherComment: string;
  headmasterComment: string;
  promotionStatus: string;
  attendance: Attendance;
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  page: {
    padding: 30,
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

  /* Student info grid */
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 0,
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

  /* Table */
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
  colSubject: { width: '22%', paddingLeft: 6 },
  colClass: { width: '10%', textAlign: 'center' },
  colExam: { width: '10%', textAlign: 'center' },
  colTotal: { width: '10%', textAlign: 'center' },
  colGrade: { width: '8%', textAlign: 'center' },
  colInterpretation: { width: '14%', textAlign: 'center' },
  colPosition: { width: '10%', textAlign: 'center' },
  colRemarks: { width: '16%', paddingRight: 6, textAlign: 'center' },
  cellText: {
    fontSize: 9,
  },
  altRow: {
    backgroundColor: '#f5f5f5',
  },

  /* Summary */
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
  summaryValue: {
    fontSize: 9,
  },

  /* Comments */
  commentSection: {
    marginBottom: 10,
  },
  commentLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 3,
  },
  commentBox: {
    border: '1px solid #ccc',
    padding: 8,
    borderRadius: 3,
    minHeight: 36,
    fontSize: 9,
    lineHeight: 1.4,
  },

  /* Promotion */
  promotionBox: {
    border: '1.5px solid #1a1a1a',
    padding: 8,
    borderRadius: 3,
    marginBottom: 14,
    alignItems: 'center',
  },
  promotionText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },

  /* Signatures */
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

  /* Grading key */
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

/* ---------- Ghana SHS Grading Key ---------- */

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

export const ReportCard: React.FC<ReportCardProps> = (props) => {
  const {
    schoolName,
    schoolMotto,
    studentName,
    studentId,
    className,
    termName,
    academicYear,
    subjects,
    totalScore,
    averageScore,
    classPosition,
    totalStudents,
    classTeacherComment,
    headmasterComment,
    promotionStatus,
    attendance,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* School Header */}
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.schoolMotto}>{schoolMotto}</Text>
          <Text style={styles.reportTitle}>Terminal Report Card</Text>
        </View>

        {/* Student Information */}
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
            <Text style={styles.infoLabel}>Term:</Text>
            <Text style={styles.infoValue}>{termName}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Academic Year:</Text>
            <Text style={styles.infoValue}>{academicYear}</Text>
          </View>
        </View>

        {/* Subjects Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colSubject}>
              <Text style={styles.tableHeaderText}>Subject</Text>
            </View>
            <View style={styles.colClass}>
              <Text style={styles.tableHeaderText}>Class (30%)</Text>
            </View>
            <View style={styles.colExam}>
              <Text style={styles.tableHeaderText}>Exam (70%)</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.tableHeaderText}>Total (100%)</Text>
            </View>
            <View style={styles.colGrade}>
              <Text style={styles.tableHeaderText}>Grade</Text>
            </View>
            <View style={styles.colInterpretation}>
              <Text style={styles.tableHeaderText}>Interpretation</Text>
            </View>
            <View style={styles.colPosition}>
              <Text style={styles.tableHeaderText}>Position</Text>
            </View>
            <View style={styles.colRemarks}>
              <Text style={styles.tableHeaderText}>Remarks</Text>
            </View>
          </View>

          {/* Rows */}
          {subjects.map((subj, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.altRow : {}]}
            >
              <View style={styles.colSubject}>
                <Text style={styles.cellText}>{subj.name}</Text>
              </View>
              <View style={styles.colClass}>
                <Text style={styles.cellText}>{subj.classScore}</Text>
              </View>
              <View style={styles.colExam}>
                <Text style={styles.cellText}>{subj.examScore}</Text>
              </View>
              <View style={styles.colTotal}>
                <Text style={styles.cellText}>{subj.totalScore}</Text>
              </View>
              <View style={styles.colGrade}>
                <Text style={styles.cellText}>{subj.grade}</Text>
              </View>
              <View style={styles.colInterpretation}>
                <Text style={styles.cellText}>{subj.interpretation}</Text>
              </View>
              <View style={styles.colPosition}>
                <Text style={styles.cellText}>{String(subj.position)}</Text>
              </View>
              <View style={styles.colRemarks}>
                <Text style={styles.cellText}>{subj.remarks}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary + Attendance */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Academic Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Score:</Text>
              <Text style={styles.summaryValue}>{totalScore}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Average Score:</Text>
              <Text style={styles.summaryValue}>
                {averageScore.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Class Position:</Text>
              <Text style={styles.summaryValue}>
                {String(classPosition)} out of {totalStudents}
              </Text>
            </View>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Attendance</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Days Present:</Text>
              <Text style={styles.summaryValue}>{attendance.present}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Days Absent:</Text>
              <Text style={styles.summaryValue}>{attendance.absent}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total School Days:</Text>
              <Text style={styles.summaryValue}>{attendance.total}</Text>
            </View>
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>Class Teacher&apos;s Comment:</Text>
          <View style={styles.commentBox}>
            <Text>{classTeacherComment}</Text>
          </View>
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>Headmaster&apos;s Comment:</Text>
          <View style={styles.commentBox}>
            <Text>{headmasterComment}</Text>
          </View>
        </View>

        {/* Promotion Status */}
        <View style={styles.promotionBox}>
          <Text style={styles.promotionText}>
            Promotion Status: {promotionStatus}
          </Text>
        </View>

        {/* Signatures */}
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

        {/* Grading Key */}
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

export default ReportCard;
