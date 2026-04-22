import { Image, View, StyleSheet } from "@react-pdf/renderer";
import path from "path";
import { PLACEHOLDER_PHOTO_SENTINEL } from "@/modules/student/actions/photo";

const styles = StyleSheet.create({
  wrapper: {
    width: 100,
    height: 125,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
});

const PLACEHOLDER_PATH = path.resolve(process.cwd(), "src/lib/pdf/assets/placeholder-photo.png");

export function StudentPhoto({ url, width, height }: { url: string; width?: number; height?: number }) {
  const src = url === PLACEHOLDER_PHOTO_SENTINEL ? PLACEHOLDER_PATH : url;
  const wrapperStyle = {
    ...styles.wrapper,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
  return (
    <View style={wrapperStyle}>
      <Image src={src} style={styles.image} />
    </View>
  );
}
