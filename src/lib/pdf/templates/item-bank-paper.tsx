import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

export interface ItemBankPaperPdfProps {
  schoolName: string;
  schoolMotto?: string | null;
  paperTitle: string;
  subjectName: string;
  yearGroup?: number | null;
  termName?: string | null;
  academicYearName?: string | null;
  durationMins?: number | null;
  instructions?: string | null;
  totalScore: number;
  questions: Array<{
    order: number;
    type: string;
    stem: string;
    maxScore: number;
    choices: Array<{ text: string; order: number }>;
  }>;
  /** When true, renders an answer key (correct answers shown) on the last page. */
  includeAnswerKey?: boolean;
  correctAnswers?: Array<{ order: number; answer: string }>;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, lineHeight: 1.4, fontFamily: "Helvetica" },
  header: { borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 8, marginBottom: 14 },
  school: { fontSize: 16, fontWeight: "bold" },
  motto: { fontStyle: "italic", fontSize: 9, color: "#666" },
  title: { fontSize: 14, fontWeight: "bold", marginTop: 6 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, fontSize: 10 },
  instructions: {
    marginTop: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#888",
    fontSize: 10,
  },
  questionBlock: { marginBottom: 14 },
  questionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  questionNo: { fontWeight: "bold" },
  stem: { marginBottom: 4 },
  choice: { marginLeft: 18, marginBottom: 2 },
  answerKey: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 8 },
  answerRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 10 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
  },
});

function letterFor(index: number): string {
  return String.fromCharCode(65 + index); // A,B,C…
}

export function ItemBankPaperPdf(props: ItemBankPaperPdfProps): React.ReactElement {
  const {
    schoolName,
    schoolMotto,
    paperTitle,
    subjectName,
    yearGroup,
    termName,
    academicYearName,
    durationMins,
    instructions,
    totalScore,
    questions,
    includeAnswerKey,
    correctAnswers,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.school}>{schoolName}</Text>
          {schoolMotto ? <Text style={styles.motto}>{schoolMotto}</Text> : null}
          <Text style={styles.title}>{paperTitle}</Text>
          <View style={styles.meta}>
            <Text>
              {subjectName}
              {yearGroup ? ` · Year ${yearGroup}` : ""}
            </Text>
            <Text>
              {termName ? `${termName} · ` : ""}
              {academicYearName ?? ""}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text>
              Total score: <Text style={{ fontWeight: "bold" }}>{totalScore}</Text>
            </Text>
            <Text>
              Duration: {durationMins ? `${durationMins} minutes` : "n/a"}
            </Text>
          </View>
        </View>

        {instructions ? (
          <View style={styles.instructions}>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Instructions</Text>
            <Text>{instructions}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 10 }}>
          {questions.map((q) => (
            <View key={q.order} style={styles.questionBlock} wrap={false}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionNo}>
                  Q{q.order}.{" "}
                  <Text style={{ fontWeight: "normal", color: "#666" }}>[{q.type}]</Text>
                </Text>
                <Text>[{q.maxScore} {q.maxScore === 1 ? "mark" : "marks"}]</Text>
              </View>
              <Text style={styles.stem}>{q.stem}</Text>
              {q.choices.map((c, idx) => (
                <Text key={idx} style={styles.choice}>
                  {letterFor(idx)}. {c.text}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {includeAnswerKey && correctAnswers && correctAnswers.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.answerKey}>
            <Text style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>Answer key</Text>
            {correctAnswers.map((a) => (
              <View key={a.order} style={styles.answerRow}>
                <Text>Q{a.order}</Text>
                <Text>{a.answer || "—"}</Text>
              </View>
            ))}
          </View>
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      )}
    </Document>
  );
}
