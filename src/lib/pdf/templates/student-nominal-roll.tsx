import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

export interface NominalRollPdfRow {
  row: number;
  studentId: string;
  surname: string;
  otherNames: string;
  gender: string;
  dateOfBirth: Date;
  primaryGuardianPhone: string | null;
}

export interface NominalRollPdfProps {
  schoolName: string;
  schoolMotto?: string | null;
  title: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: NominalRollPdfRow[];
}

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  header: { alignItems: "center", borderBottom: "2px solid #1a1a1a", paddingBottom: 8, marginBottom: 12 },
  schoolName: { fontSize: 16, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  motto: { fontSize: 9, fontStyle: "italic", color: "#555" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 6 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, fontSize: 8, color: "#444" },
  rowHead: { flexDirection: "row", borderBottom: "1px solid #888", paddingVertical: 4, backgroundColor: "#f3f3f3" },
  row: { flexDirection: "row", borderBottom: "1px solid #ccc", paddingVertical: 3 },
  cellNum: { width: 24, textAlign: "right", paddingRight: 4 },
  cellId: { width: 80 },
  cellSurname: { flex: 1, fontFamily: "Helvetica-Bold" },
  cellOther: { flex: 1.5 },
  cellShort: { width: 40 },
  cellDob: { width: 70 },
  cellPhone: { width: 80 },
});

export function StudentNominalRollPdf(props: NominalRollPdfProps) {
  const { schoolName, schoolMotto, title, filterSummary, generatedAt, generatedBy, rows } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          {schoolMotto ? <Text style={styles.motto}>{schoolMotto}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.meta}>
          <Text>{filterSummary}</Text>
          <Text>Generated {generatedAt.toISOString().slice(0, 10)} by {generatedBy}</Text>
        </View>
        <View style={styles.rowHead}>
          <Text style={styles.cellNum}>#</Text>
          <Text style={styles.cellId}>Student ID</Text>
          <Text style={styles.cellSurname}>SURNAME</Text>
          <Text style={styles.cellOther}>Other Names</Text>
          <Text style={styles.cellShort}>Sex</Text>
          <Text style={styles.cellDob}>DOB</Text>
          <Text style={styles.cellPhone}>Phone</Text>
        </View>
        {rows.map((r) => (
          <View key={r.studentId} style={styles.row}>
            <Text style={styles.cellNum}>{r.row}</Text>
            <Text style={styles.cellId}>{r.studentId}</Text>
            <Text style={styles.cellSurname}>{r.surname.toUpperCase()}</Text>
            <Text style={styles.cellOther}>{r.otherNames}</Text>
            <Text style={styles.cellShort}>{r.gender}</Text>
            <Text style={styles.cellDob}>{r.dateOfBirth.toISOString().slice(0, 10)}</Text>
            <Text style={styles.cellPhone}>{r.primaryGuardianPhone ?? "—"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
