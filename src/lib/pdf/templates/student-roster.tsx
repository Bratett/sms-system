import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

export interface RosterPdfStudent {
  studentId: string;
  name: string;
  className: string;
  gender: string;
  boardingStatus: string;
  status: string;
}

export interface RosterPdfProps {
  schoolName: string;
  schoolMotto?: string | null;
  schoolLogoUrl?: string | null;
  title: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  students: RosterPdfStudent[];
  totals: { total: number; male: number; female: number; day: number; boarding: number };
}

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  header: {
    alignItems: "center",
    borderBottom: "2px solid #1a1a1a",
    paddingBottom: 8,
    marginBottom: 12,
  },
  schoolName: { fontSize: 16, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  motto: { fontSize: 9, fontStyle: "italic", color: "#555" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, fontSize: 8, color: "#444" },
  table: { borderTop: "1px solid #888" },
  row: { flexDirection: "row", borderBottom: "1px solid #ccc", paddingVertical: 3 },
  rowHead: { flexDirection: "row", borderBottom: "1px solid #888", paddingVertical: 4, backgroundColor: "#f3f3f3" },
  cellNum: { width: 24, textAlign: "right", paddingRight: 4 },
  cellId: { width: 80 },
  cellName: { flex: 2 },
  cellClass: { flex: 1 },
  cellShort: { width: 50 },
  totals: { marginTop: 12, fontSize: 9 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  sig: { width: "40%", borderTop: "1px solid #1a1a1a", paddingTop: 4, fontSize: 9 },
});

export function StudentRosterPdf(props: RosterPdfProps) {
  const { schoolName, schoolMotto, title, filterSummary, generatedAt, generatedBy, students, totals } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          {schoolMotto ? <Text style={styles.motto}>{schoolMotto}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>{filterSummary}</Text>
          <Text>Generated {generatedAt.toISOString().slice(0, 10)} by {generatedBy}</Text>
        </View>
        <View style={styles.rowHead}>
          <Text style={styles.cellNum}>#</Text>
          <Text style={styles.cellId}>Student ID</Text>
          <Text style={styles.cellName}>Name</Text>
          <Text style={styles.cellClass}>Class</Text>
          <Text style={styles.cellShort}>Sex</Text>
          <Text style={styles.cellShort}>Boarding</Text>
        </View>
        {students.map((s, i) => (
          <View key={s.studentId} style={styles.row}>
            <Text style={styles.cellNum}>{i + 1}</Text>
            <Text style={styles.cellId}>{s.studentId}</Text>
            <Text style={styles.cellName}>{s.name}</Text>
            <Text style={styles.cellClass}>{s.className}</Text>
            <Text style={styles.cellShort}>{s.gender}</Text>
            <Text style={styles.cellShort}>{s.boardingStatus}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text>Total: {totals.total}  ·  Male: {totals.male}  ·  Female: {totals.female}  ·  Day: {totals.day}  ·  Boarding: {totals.boarding}</Text>
        </View>
        <View style={styles.signatureRow}>
          <Text style={styles.sig}>Form Master / Mistress</Text>
          <Text style={styles.sig}>Headmaster / Headmistress</Text>
        </View>
      </Page>
    </Document>
  );
}
