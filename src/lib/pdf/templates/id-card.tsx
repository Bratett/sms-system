import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { Letterhead, type LetterheadProps } from "../components/letterhead";
import { StudentPhoto } from "../components/photo";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, backgroundColor: "#ffffff" },
  cardsRow: { flexDirection: "row", gap: 18 },
  card: {
    width: 240, height: 150, borderWidth: 1, borderColor: "#94a3b8",
    borderRadius: 6, padding: 10, backgroundColor: "#ffffff",
  },
  cardInner: { flexDirection: "row", gap: 10, flex: 1 },
  photoCol: { width: 80 },
  infoCol: { flex: 1, justifyContent: "space-between" },
  schoolName: { fontSize: 11, fontWeight: "bold", color: "#1e40af" },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: "bold" },
  backCard: {
    width: 240, height: 150, borderWidth: 1, borderColor: "#94a3b8",
    borderRadius: 6, padding: 10, backgroundColor: "#ffffff",
  },
  qr: { width: 80, height: 80, alignSelf: "center" },
  footnote: { fontSize: 7, color: "#64748b", textAlign: "center", marginTop: 4 },
  cutGuide: { fontSize: 7, color: "#cbd5e1", textAlign: "center", marginTop: 12 },
});

export type IdCardData = {
  school: LetterheadProps;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    otherNames?: string | null;
    photoUrl: string;
    gender: string;
    bloodGroup?: string | null;
    dateOfBirth: Date;
  };
  enrollment: {
    className: string;
    classArmName: string;
    programmeName: string;
    academicYearName: string;
  };
  boardingStatus: string;
  house?: string | null;
  qrDataUrl: string;
  issuedAt: Date;
};

export function IdCardTemplate({ data }: { data: IdCardData }) {
  const fullName = [data.student.firstName, data.student.otherNames, data.student.lastName]
    .filter(Boolean).join(" ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Letterhead {...data.school} />
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.schoolName}>{data.school.name}</Text>
            <View style={styles.cardInner}>
              <View style={styles.photoCol}>
                <StudentPhoto url={data.student.photoUrl} width={80} height={100} />
              </View>
              <View style={styles.infoCol}>
                <View>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{fullName}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Student ID</Text>
                  <Text style={styles.value}>{data.student.studentId}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Class</Text>
                  <Text style={styles.value}>
                    {data.enrollment.className} - {data.enrollment.classArmName}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.backCard}>
            <Text style={styles.schoolName}>Verification</Text>
            <View style={styles.cardInner}>
              <View style={{ flex: 1, justifyContent: "space-between" }}>
                <View>
                  <Text style={styles.label}>Gender</Text>
                  <Text style={styles.value}>{data.student.gender}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Blood group</Text>
                  <Text style={styles.value}>{data.student.bloodGroup ?? "-"}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Boarding</Text>
                  <Text style={styles.value}>{data.boardingStatus}</Text>
                </View>
                <View>
                  <Text style={styles.label}>House</Text>
                  <Text style={styles.value}>{data.house ?? "-"}</Text>
                </View>
              </View>
              <View style={{ width: 80 }}>
                <Image src={data.qrDataUrl} style={styles.qr} />
                <Text style={styles.footnote}>Scan to verify</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.cutGuide}>
          Cut along the card borders. Laminate at 125 micron. Valid academic year{" "}
          {data.enrollment.academicYearName}
        </Text>
      </Page>
    </Document>
  );
}
