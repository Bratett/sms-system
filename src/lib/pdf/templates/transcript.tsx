import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { Letterhead, type LetterheadProps } from "../components/letterhead";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, backgroundColor: "#ffffff" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", marginVertical: 10 },
  metaGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  metaBlock: { flexDirection: "column" },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: "bold" },
  yearHeading: { fontSize: 12, fontWeight: "bold", marginTop: 14, marginBottom: 6, color: "#1e40af" },
  table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerRow: { backgroundColor: "#f1f5f9" },
  cell: { padding: 5, fontSize: 9 },
  cellSubject: { width: "40%" },
  cellScore: { width: "15%", textAlign: "right" },
  cellGrade: { width: "15%", textAlign: "center" },
  cellRemark: { width: "30%" },
  gpaBox: {
    marginTop: 12, padding: 10, borderWidth: 1, borderColor: "#1e40af",
    borderRadius: 4, backgroundColor: "#eff6ff",
  },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#64748b", width: 180, paddingTop: 4, textAlign: "center" },
  footerNote: { marginTop: 24, fontSize: 8, color: "#64748b", textAlign: "center" },
});

export type TranscriptData = {
  school: LetterheadProps;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: string;
    programmeName: string;
  };
  transcriptNumber: string;
  coveringFrom: string | null;
  coveringTo: string | null;
  cumulativeGPA: number | null;
  status: string;
  issuedAt?: Date | null;
  years: Array<{
    academicYearName: string;
    terms: Array<{
      termName: string;
      averageScore: number | null;
      overallGrade: string | null;
      classPosition: number | null;
      subjects: Array<{
        subjectName: string;
        totalScore: number | null;
        grade: string | null;
        interpretation: string | null;
      }>;
    }>;
  }>;
};

export function TranscriptTemplate({ data }: { data: TranscriptData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead {...data.school} />
        <Text style={styles.title}>ACADEMIC TRANSCRIPT</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Transcript number</Text>
            <Text style={styles.value}>{data.transcriptNumber}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Student</Text>
            <Text style={styles.value}>
              {data.student.firstName} {data.student.lastName}
            </Text>
            <Text style={{ fontSize: 9 }}>{data.student.studentId}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Programme</Text>
            <Text style={styles.value}>{data.student.programmeName}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {data.coveringFrom ?? "-"} to {data.coveringTo ?? "-"}
            </Text>
          </View>
        </View>

        {data.years.map((year, yi) => (
          // Allow a year's terms to break across pages. A multi-year transcript
          // with 3 terms per year per subject would otherwise force the whole
          // year onto one page and truncate for students with many subjects.
          <View key={yi}>
            <Text style={styles.yearHeading}>{year.academicYearName}</Text>
            {year.terms.map((term, ti) => (
              // Keep each individual term's table together on one page where
              // possible; if a term doesn't fit, react-pdf will still break.
              <View key={ti} wrap={false} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 3 }}>
                  {term.termName} . Avg {term.averageScore?.toFixed(1) ?? "-"} .{" "}
                  Grade {term.overallGrade ?? "-"} . Position {term.classPosition ?? "-"}
                </Text>
                <View style={styles.table}>
                  <View style={[styles.row, styles.headerRow]}>
                    <Text style={[styles.cell, styles.cellSubject]}>Subject</Text>
                    <Text style={[styles.cell, styles.cellScore]}>Score</Text>
                    <Text style={[styles.cell, styles.cellGrade]}>Grade</Text>
                    <Text style={[styles.cell, styles.cellRemark]}>Remark</Text>
                  </View>
                  {term.subjects.map((s, si) => (
                    <View key={si} style={styles.row}>
                      <Text style={[styles.cell, styles.cellSubject]}>{s.subjectName}</Text>
                      <Text style={[styles.cell, styles.cellScore]}>
                        {s.totalScore?.toFixed(1) ?? "-"}
                      </Text>
                      <Text style={[styles.cell, styles.cellGrade]}>{s.grade ?? "-"}</Text>
                      <Text style={[styles.cell, styles.cellRemark]}>
                        {s.interpretation ?? "-"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.gpaBox}>
          <Text style={{ fontSize: 11, fontWeight: "bold" }}>
            Cumulative GPA: {data.cumulativeGPA?.toFixed(2) ?? "-"}
          </Text>
        </View>

        <View style={styles.signatures}>
          <View style={styles.sigLine}>
            <Text>Registrar</Text>
          </View>
          <View style={styles.sigLine}>
            <Text>Headmaster</Text>
          </View>
        </View>
        <Text style={styles.footerNote}>
          Status: {data.status}
          {data.issuedAt ? " . Issued: " + data.issuedAt.toISOString().slice(0, 10) : ""}
        </Text>
      </Page>
    </Document>
  );
}
