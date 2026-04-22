import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1e40af",
    paddingBottom: 8,
    marginBottom: 12,
  },
  logo: { width: 60, height: 60, marginRight: 12 },
  textBlock: { flex: 1 },
  name: { fontSize: 18, fontWeight: "bold", color: "#1e40af" },
  motto: { fontSize: 10, fontStyle: "italic", color: "#64748b" },
  address: { fontSize: 9, color: "#475569", marginTop: 2 },
});

export type LetterheadProps = {
  name: string;
  motto?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function Letterhead({ name, motto, logoUrl, address, phone, email }: LetterheadProps) {
  return (
    <View style={styles.container}>
      {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
      <View style={styles.textBlock}>
        <Text style={styles.name}>{name}</Text>
        {motto ? <Text style={styles.motto}>{motto}</Text> : null}
        <Text style={styles.address}>
          {[address, phone, email].filter(Boolean).join(" . ")}
        </Text>
      </View>
    </View>
  );
}
