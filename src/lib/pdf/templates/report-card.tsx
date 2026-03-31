import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface CABreakdownItem {
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
}

export interface SubjectRow {
  name: string;
  classScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  interpretation: string;
  position: string | number;
  remarks: string;
  caBreakdown?: CABreakdownItem[] | null;
}

export interface Attendance {
  totalSchoolDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  sick: number;
}

export interface ConductEntry {
  trait: string;
  rating: string;
}

export interface ActivityEntry {
  name: string;
  type: string;
  role: string;
}

export interface AwardEntry {
  title: string;
  type: string;
}

export interface ReportCardProps {
  schoolName: string;
  schoolMotto: string;
  studentName: string;
  studentId: string;
  className: string;
  programme: string;
  house: string;
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
  conduct?: ConductEntry[];
  activities?: ActivityEntry[];
  awards?: AwardEntry[];
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
    fontSize: 7,
  },
  colSubject: { width: '18%', paddingLeft: 6 },
  colCA: { width: '8%', textAlign: 'center' },
  colExam: { width: '9%', textAlign: 'center' },
  colTotal: { width: '9%', textAlign: 'center' },
  colGrade: { width: '7%', textAlign: 'center' },
  colInterpretation: { width: '13%', textAlign: 'center' },
  colPosition: { width: '8%', textAlign: 'center' },
  colRemarks: { width: '12%', paddingRight: 4, textAlign: 'center' },
  cellText: {
    fontSize: 8,
  },
  altRow: {
    backgroundColor: '#f5f5f5',
  },
  summarySection: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
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
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 4,
    marginTop: 8,
  },
  commentSection: {
    marginBottom: 8,
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
    minHeight: 30,
    fontSize: 9,
    lineHeight: 1.4,
  },
  promotionBox: {
    border: '1.5px solid #1a1a1a',
    padding: 8,
    borderRadius: 3,
    marginBottom: 12,
    alignItems: 'center',
  },
  promotionText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
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
    marginTop: 12,
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
  conductGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    border: '1px solid #ccc',
    borderRadius: 3,
    marginBottom: 10,
  },
  conductCell: {
    width: '33.33%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottom: '0.5px solid #eee',
  },
  conductTrait: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  conductRating: {
    fontSize: 8,
  },
  activitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  activityTag: {
    fontSize: 7,
    backgroundColor: '#f0f0f0',
    padding: '2 6',
    borderRadius: 2,
  },
  awardTag: {
    fontSize: 7,
    backgroundColor: '#fef3c7',
    padding: '2 6',
    borderRadius: 2,
    color: '#92400e',
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

/* ---------- Helpers ---------- */

function formatRating(rating: string): string {
  return rating.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/* ---------- Component ---------- */

export const ReportCard: React.FC<ReportCardProps> = (props) => {
  const {
    schoolName,
    schoolMotto,
    studentName,
    studentId,
    className,
    programme,
    house,
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
    conduct,
    activities,
    awards,
  } = props;

  // Derive CA column headers from the first subject's breakdown
  const caColumns: string[] = [];
  if (subjects.length > 0 && subjects[0].caBreakdown) {
    for (const ca of subjects[0].caBreakdown) {
      caColumns.push(ca.name);
    }
  }

  // Dynamic column widths
  const hasCA = caColumns.length > 0;
  const caColWidth = hasCA ? `${Math.floor(16 / caColumns.length)}%` : '0%';

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
            <Text style={styles.infoLabel}>Programme:</Text>
            <Text style={styles.infoValue}>{programme || '---'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Term:</Text>
            <Text style={styles.infoValue}>{termName}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Academic Year:</Text>
            <Text style={styles.infoValue}>{academicYear}</Text>
          </View>
          {house && (
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>House:</Text>
              <Text style={styles.infoValue}>{house}</Text>
            </View>
          )}
        </View>

        {/* Subjects Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colSubject}>
              <Text style={styles.tableHeaderText}>Subject</Text>
            </View>
            {hasCA ? (
              <>
                {caColumns.map((col, i) => (
                  <View key={i} style={{ width: caColWidth, textAlign: 'center' as const }}>
                    <Text style={styles.tableHeaderText}>{col}</Text>
                  </View>
                ))}
                <View style={styles.colCA}>
                  <Text style={styles.tableHeaderText}>CA Total</Text>
                </View>
              </>
            ) : (
              <View style={styles.colCA}>
                <Text style={styles.tableHeaderText}>Class</Text>
              </View>
            )}
            <View style={styles.colExam}>
              <Text style={styles.tableHeaderText}>Exam</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.tableHeaderText}>Total</Text>
            </View>
            <View style={styles.colGrade}>
              <Text style={styles.tableHeaderText}>Grade</Text>
            </View>
            <View style={styles.colInterpretation}>
              <Text style={styles.tableHeaderText}>Interp.</Text>
            </View>
            <View style={styles.colPosition}>
              <Text style={styles.tableHeaderText}>Pos.</Text>
            </View>
            <View style={styles.colRemarks}>
              <Text style={styles.tableHeaderText}>Remarks</Text>
            </View>
          </View>

          {subjects.map((subj, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.altRow : {}]}
            >
              <View style={styles.colSubject}>
                <Text style={styles.cellText}>{subj.name}</Text>
              </View>
              {hasCA && subj.caBreakdown ? (
                <>
                  {subj.caBreakdown.map((ca, i) => (
                    <View key={i} style={{ width: caColWidth, textAlign: 'center' as const }}>
                      <Text style={styles.cellText}>{ca.score}/{ca.maxScore}</Text>
                    </View>
                  ))}
                  <View style={styles.colCA}>
                    <Text style={styles.cellText}>{subj.classScore}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.colCA}>
                  <Text style={styles.cellText}>{subj.classScore}</Text>
                </View>
              )}
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
              <Text style={styles.summaryValue}>{averageScore.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Class Position:</Text>
              <Text style={styles.summaryValue}>{String(classPosition)} out of {totalStudents}</Text>
            </View>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Attendance</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>School Days:</Text>
              <Text style={styles.summaryValue}>{attendance.totalSchoolDays}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Days Present:</Text>
              <Text style={styles.summaryValue}>{attendance.present}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Days Absent:</Text>
              <Text style={styles.summaryValue}>{attendance.absent}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Late:</Text>
              <Text style={styles.summaryValue}>{attendance.late}</Text>
            </View>
            {(attendance.excused > 0 || attendance.sick > 0) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Excused/Sick:</Text>
                <Text style={styles.summaryValue}>{attendance.excused + attendance.sick}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Conduct & Behaviour */}
        {conduct && conduct.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Conduct & Behaviour</Text>
            <View style={styles.conductGrid}>
              {conduct.map((c, i) => (
                <View key={i} style={styles.conductCell}>
                  <Text style={styles.conductTrait}>{c.trait}:</Text>
                  <Text style={styles.conductRating}>{formatRating(c.rating)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Co-Curricular Activities */}
        {activities && activities.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Co-Curricular Activities</Text>
            <View style={styles.activitiesRow}>
              {activities.map((a, i) => (
                <Text key={i} style={styles.activityTag}>
                  {a.name} ({a.type}){a.role ? ` - ${a.role}` : ''}
                </Text>
              ))}
            </View>
          </>
        )}

        {/* Awards */}
        {awards && awards.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Awards & Recognition</Text>
            <View style={styles.activitiesRow}>
              {awards.map((a, i) => (
                <Text key={i} style={styles.awardTag}>
                  {a.title}
                </Text>
              ))}
            </View>
          </>
        )}

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
          <Text style={styles.promotionText}>Promotion Status: {promotionStatus}</Text>
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
