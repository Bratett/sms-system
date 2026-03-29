import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface BroadsheetStudent {
  name: string;
  id: string;
  scores: Record<string, number>;
  total: number;
  average: number;
  position: string | number;
}

export interface BroadsheetProps {
  schoolName: string;
  className: string;
  termName: string;
  academicYear: string;
  subjects: string[];
  students: BroadsheetStudent[];
}

/* ---------- Styles ---------- */

const BASE_FONT_SIZE = 7;

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: BASE_FONT_SIZE,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },

  /* Header */
  headerSection: {
    alignItems: 'center',
    marginBottom: 10,
    borderBottom: '1.5px solid #1a1a1a',
    paddingBottom: 6,
  },
  schoolName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reportTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
    textTransform: 'uppercase',
  },

  /* Meta info row */
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  metaItem: {
    flexDirection: 'row',
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  metaValue: {
    fontSize: 8,
    marginLeft: 4,
  },

  /* Table */
  table: {
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #ccc',
    minHeight: 16,
    alignItems: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    minHeight: 20,
    alignItems: 'center',
  },
  headerText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
    textAlign: 'center',
  },
  cellText: {
    fontSize: 6,
    textAlign: 'center',
  },
  cellTextLeft: {
    fontSize: 6,
    textAlign: 'left',
    paddingLeft: 3,
  },
  altRow: {
    backgroundColor: '#f7f7f7',
  },

  /* Fixed columns */
  colRank: { width: '4%' },
  colName: { width: '14%' },
  colId: { width: '8%' },

  /* Summary columns */
  colTotal: { width: '6%' },
  colAverage: { width: '6%' },
  colPosition: { width: '6%' },

  /* Footer */
  footer: {
    marginTop: 12,
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
    marginBottom: 3,
  },
  signatureLabel: {
    fontSize: 7,
    color: '#444',
  },
});

/* ---------- Component ---------- */

export const Broadsheet: React.FC<BroadsheetProps> = (props) => {
  const { schoolName, className, termName, academicYear, subjects, students } =
    props;

  // Calculate dynamic subject column width from remaining space
  // Fixed columns: rank(4%) + name(14%) + id(8%) + total(6%) + avg(6%) + pos(6%) = 44%
  const remainingWidth = 56; // percent
  const subjectColWidth =
    subjects.length > 0
      ? `${(remainingWidth / subjects.length).toFixed(2)}%`
      : '0%';

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.reportTitle}>
            Academic Broadsheet
          </Text>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Class:</Text>
            <Text style={styles.metaValue}>{className}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Term:</Text>
            <Text style={styles.metaValue}>{termName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Academic Year:</Text>
            <Text style={styles.metaValue}>{academicYear}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>No. of Students:</Text>
            <Text style={styles.metaValue}>{students.length}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeader}>
            <View style={styles.colRank}>
              <Text style={styles.headerText}>#</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.headerText}>Student Name</Text>
            </View>
            <View style={styles.colId}>
              <Text style={styles.headerText}>ID</Text>
            </View>
            {subjects.map((subj) => (
              <View key={subj} style={{ width: subjectColWidth }}>
                <Text style={styles.headerText}>{subj}</Text>
              </View>
            ))}
            <View style={styles.colTotal}>
              <Text style={styles.headerText}>Total</Text>
            </View>
            <View style={styles.colAverage}>
              <Text style={styles.headerText}>Avg</Text>
            </View>
            <View style={styles.colPosition}>
              <Text style={styles.headerText}>Pos</Text>
            </View>
          </View>

          {/* Student Rows */}
          {students.map((student, idx) => (
            <View
              key={student.id}
              style={[styles.tableRow, idx % 2 === 1 ? styles.altRow : {}]}
            >
              <View style={styles.colRank}>
                <Text style={styles.cellText}>{idx + 1}</Text>
              </View>
              <View style={styles.colName}>
                <Text style={styles.cellTextLeft}>{student.name}</Text>
              </View>
              <View style={styles.colId}>
                <Text style={styles.cellText}>{student.id}</Text>
              </View>
              {subjects.map((subj) => (
                <View key={subj} style={{ width: subjectColWidth }}>
                  <Text style={styles.cellText}>
                    {student.scores[subj] !== undefined
                      ? student.scores[subj]
                      : '-'}
                  </Text>
                </View>
              ))}
              <View style={styles.colTotal}>
                <Text style={styles.cellText}>{student.total}</Text>
              </View>
              <View style={styles.colAverage}>
                <Text style={styles.cellText}>
                  {student.average.toFixed(1)}
                </Text>
              </View>
              <View style={styles.colPosition}>
                <Text style={styles.cellText}>
                  {String(student.position)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Signatures */}
        <View style={styles.footer}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Class Teacher</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Head of Department
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Headmaster / Headmistress
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default Broadsheet;
