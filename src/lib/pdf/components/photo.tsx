import { Image, View, StyleSheet } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";
import { PLACEHOLDER_PHOTO_SENTINEL } from "@/lib/pdf/constants";

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

// Inline the placeholder as a base64 data URL at module load so PDF rendering
// doesn't depend on the filesystem layout at runtime. Reading from disk breaks
// in Next.js standalone builds (the assets directory isn't copied into the
// server bundle) and in serverless execution environments. If the asset is
// missing at build time, fall back to a 1x1 transparent PNG so renders still
// produce a valid image tag rather than throwing.
const PLACEHOLDER_DATA_URL = (() => {
  try {
    const p = path.resolve(
      process.cwd(),
      "src/lib/pdf/assets/placeholder-photo.png",
    );
    const buf = fs.readFileSync(p);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  }
})();

export function StudentPhoto({ url, width, height }: { url: string; width?: number; height?: number }) {
  const src = url === PLACEHOLDER_PHOTO_SENTINEL ? PLACEHOLDER_DATA_URL : url;
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
