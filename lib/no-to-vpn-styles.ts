import { StyleSheet } from "react-native";

export const noToVpnStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  description: { color: "#708095", fontSize: 12, lineHeight: 17, marginTop: 6 },
  input: {
    minHeight: 74,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E3EAF2",
    backgroundColor: "#F9FBFD",
    color: "#101D2D",
    fontSize: 14,
    textAlignVertical: "top",
  },
  saveButton: {
    minHeight: 46,
    marginTop: 10,
    borderRadius: 13,
    backgroundColor: "#E7F2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#2386F4", fontSize: 13, fontWeight: "700" },
  helper: { color: "#708095", fontSize: 11, lineHeight: 16, marginTop: 11 },
  warning: { color: "#916A25", fontSize: 11, lineHeight: 16, marginTop: 7 },
  notice: { color: "#198754", fontSize: 11, lineHeight: 16, marginTop: 7 },
  error: { color: "#D9485F", fontSize: 11, lineHeight: 16, marginTop: 7 },
});
