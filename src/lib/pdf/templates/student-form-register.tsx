import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

export interface FormRegisterPdfRow {
  row: number; studentId: string; fullName: string; gender: string;
}

export interface FormRegisterPdfProps {
  schoolName: string;
  schoolMotto?: string | null;
  title: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: FormRegisterPdfRow[];
  weeks: number;
  daysPerWeek: number;
}

const STUDENTS_PER_PAGE = 25;

const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 7, fontFamily: "Helvetica" },
  header: { alignItems: "center", borderBottom: "1px solid #1a1a1a", paddingBottom: 6, marginBottom: 8 },
  schoolName: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 4 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, fontSize: 7, color: "#444" },
  table: {},
  rowHead: { flexDirection: "row", borderBottom: "1px solid #888", backgroundColor: "#f3f3f3" },
  row: { flexDirection: "row", borderBottom: "1px solid #ccc" },
  cellNum: { width: 18, textAlign: "right", paddingRight: 2, paddingVertical: 2 },
  cellId: { width: 60, paddingVertical: 2 },
  cellName: { width: 130, paddingVertical: 2 },
  cellSex: { width: 18, textAlign: "center", paddingVertical: 2 },
  tickCell: { borderLeft: "1px solid #ccc", paddingVertical: 2, textAlign: "center" },
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function StudentFormRegisterPdf(props: FormRegisterPdfProps) {
  const { schoolName, title, filterSummary, generatedAt, generatedBy, rows, weeks, daysPerWeek } = props;
  const totalTickCols = weeks * daysPerWeek;
  const tickWidth = Math.max(14, Math.floor((760 - 240) / totalTickCols)); // landscape ~760pt usable
  const pages = chunk(rows.length ? rows : [{ row: 0, studentId: "", fullName: "(no students)", gender: "" }], STUDENTS_PER_PAGE);

  return (
    <Document>
      {pages.map((pageRows, pIdx) => (
        <Page key={pIdx} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.meta}>
            <Text>{filterSummary}  ·  {weeks} weeks × {daysPerWeek} days</Text>
            <Text>Generated {generatedAt.toISOString().slice(0, 10)} by {generatedBy}  ·  Page {pIdx + 1} / {pages.length}</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.rowHead}>
              <Text style={styles.cellNum}>#</Text>
              <Text style={styles.cellId}>ID</Text>
              <Text style={styles.cellName}>Name</Text>
              <Text style={styles.cellSex}>S</Text>
              {Array.from({ length: weeks }).flatMap((_, w) =>
                Array.from({ length: daysPerWeek }).map((__, d) => (
                  <Text key={`h${w}-${d}`} style={[styles.tickCell, { width: tickWidth }]}>W{w + 1}D{d + 1}</Text>
                )),
              )}
            </View>
            {pageRows.map((r) => (
              <View key={r.studentId || `ph-${r.row}`} style={styles.row}>
                <Text style={styles.cellNum}>{r.row || ""}</Text>
                <Text style={styles.cellId}>{r.studentId}</Text>
                <Text style={styles.cellName}>{r.fullName}</Text>
                <Text style={styles.cellSex}>{r.gender ? r.gender.charAt(0) : ""}</Text>
                {Array.from({ length: totalTickCols }).map((_, i) => (
                  <Text key={`t${i}`} style={[styles.tickCell, { width: tickWidth }]}> </Text>
                ))}
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}
