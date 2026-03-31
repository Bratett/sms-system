import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface StandardEntry {
  standardCode: string;
  strand: string;
  subStrand: string;
  description: string;
  proficiency: string;
}

export interface SubjectCompetency {
  subject: string;
  totalStandards: number;
  meetingOrAbove: number;
  masteryPercentage: number;
  standards: StandardEntry[];
}

export interface CompetencyReportProps {
  schoolName: string;
  schoolMotto: string;
  studentName: string;
  studentId: string;
  className: string;
  academicYear: string;
  subjects: SubjectCompetency[];
}

/* ---------- Styles ---------- */

const proficiencyColors: Record<string, string> = {
  NOT_YET: '#dc2626',
  DEVELOPING: '#d97706',
  APPROACHING: '#2563eb',
  MEETING: '#059669',
  EXCEEDING: '#7c3aed',
};

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
  schoolMotto: {
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 2,
    color: '#444',
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
    marginBottom: 14,
  },
  infoCell: {
    width: '50%',
    flexDirection: 'row',
    paddingVertical: 3,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 100,
  },
  infoValue: { flex: 1 },
  subjectSection: {
    marginBottom: 14,
    border: '1px solid #ddd',
    borderRadius: 3,
    overflow: 'hidden',
  },
  subjectHeader: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #ddd',
  },
  subjectName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  masteryBadge: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    padding: '2 8',
    borderRadius: 10,
    color: '#fff',
  },
  progressBarOuter: {
    height: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    margin: '4 8',
    overflow: 'hidden',
  },
  progressBarInner: {
    height: 8,
    borderRadius: 4,
  },
  standardRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #eee',
    minHeight: 20,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  colCode: { width: '12%' },
  colStrand: { width: '18%' },
  colDesc: { width: '46%' },
  colProf: { width: '24%', textAlign: 'right' },
  cellText: { fontSize: 8 },
  profLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: '1 4',
    borderRadius: 2,
  },
  legendSection: {
    marginTop: 14,
    borderTop: '0.5px solid #ccc',
    paddingTop: 8,
  },
  legendTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 7,
    color: '#555',
  },
});

/* ---------- Helpers ---------- */

function formatProficiency(p: string): string {
  return p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getMasteryColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#2563eb';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

/* ---------- Component ---------- */

export const CompetencyReport: React.FC<CompetencyReportProps> = (props) => {
  const { schoolName, schoolMotto, studentName, studentId, className, academicYear, subjects } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.schoolMotto}>{schoolMotto}</Text>
          <Text style={styles.title}>Standards-Based Competency Report</Text>
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
            <Text style={styles.infoLabel}>Academic Year:</Text>
            <Text style={styles.infoValue}>{academicYear}</Text>
          </View>
        </View>

        {subjects.map((subj, sIdx) => (
          <View key={sIdx} style={styles.subjectSection}>
            <View style={styles.subjectHeader}>
              <Text style={styles.subjectName}>{subj.subject}</Text>
              <Text style={[
                styles.masteryBadge,
                { backgroundColor: getMasteryColor(subj.masteryPercentage) },
              ]}>
                {subj.masteryPercentage}% Mastery
              </Text>
            </View>

            <View style={styles.progressBarOuter}>
              <View style={[
                styles.progressBarInner,
                {
                  width: `${Math.min(subj.masteryPercentage, 100)}%`,
                  backgroundColor: getMasteryColor(subj.masteryPercentage),
                },
              ]} />
            </View>

            <View style={[styles.standardRow, { backgroundColor: '#f9f9f9' }]}>
              <View style={styles.colCode}><Text style={[styles.cellText, { fontFamily: 'Helvetica-Bold' }]}>Code</Text></View>
              <View style={styles.colStrand}><Text style={[styles.cellText, { fontFamily: 'Helvetica-Bold' }]}>Strand</Text></View>
              <View style={styles.colDesc}><Text style={[styles.cellText, { fontFamily: 'Helvetica-Bold' }]}>Description</Text></View>
              <View style={styles.colProf}><Text style={[styles.cellText, { fontFamily: 'Helvetica-Bold' }]}>Proficiency</Text></View>
            </View>

            {subj.standards.map((std, stIdx) => (
              <View key={stIdx} style={styles.standardRow}>
                <View style={styles.colCode}><Text style={styles.cellText}>{std.standardCode}</Text></View>
                <View style={styles.colStrand}><Text style={styles.cellText}>{std.strand}</Text></View>
                <View style={styles.colDesc}><Text style={styles.cellText}>{std.description}</Text></View>
                <View style={styles.colProf}>
                  <Text style={[styles.profLabel, { color: proficiencyColors[std.proficiency] || '#555' }]}>
                    {formatProficiency(std.proficiency)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.legendSection}>
          <Text style={styles.legendTitle}>Proficiency Levels</Text>
          <View style={styles.legendRow}>
            {Object.entries(proficiencyColors).map(([key, color]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{formatProficiency(key)}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default CompetencyReport;
