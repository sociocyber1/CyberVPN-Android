import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { HapticTab } from "@/components/haptic-tab";

const COLORS = { bg: "#FFFFFF", edge: "#E3EAF2", muted: "#708095", neon: "#2386F4" };
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 8);
  const [glitch, setGlitch] = useState(false);
  const [glitchFlip, setGlitchFlip] = useState(false);
  const fade = useMemo(() => new Animated.Value(0), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerGlitch = () => {
    setGlitchFlip((value) => !value);
    setGlitch(true);
    if (timer.current) clearTimeout(timer.current);
    fade.setValue(0.8);
    Animated.sequence([
      Animated.timing(fade, { toValue: 0.55, duration: 45, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0.18, duration: 55, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0.35, duration: 40, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setGlitch(false); });
    timer.current = setTimeout(() => setGlitch(false), 300);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); fade.stopAnimation(); }, [fade]);
  return (
    <View style={styles.root}>
    <Tabs screenListeners={{ state: () => triggerGlitch() }} screenOptions={{
      headerShown: false,
      tabBarButton: HapticTab,
      tabBarActiveTintColor: COLORS.neon,
      tabBarInactiveTintColor: COLORS.muted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      tabBarStyle: { paddingTop: 7, paddingBottom: bottomPadding, height: 57 + bottomPadding, backgroundColor: COLORS.bg, borderTopColor: COLORS.edge, borderTopWidth: 1 },
    }}>
      <Tabs.Screen name="index" options={{ title: "VPN", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-lock-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="firewall" options={{ title: "Firewall", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-off-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="connections" options={{ title: "Соединения", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="radar" color={color} size={size} /> }} />
    </Tabs>
    {glitch ? <Animated.View pointerEvents="none" style={[styles.glitchOverlay, { opacity: fade }]}>
      <View style={[styles.glitchBand, glitchFlip ? styles.bandTop : styles.bandLower]} />
      <View style={[styles.glitchBand, glitchFlip ? styles.bandLower : styles.bandTop]} />
      <View style={styles.scanLine} />
    </Animated.View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glitchOverlay: { ...StyleSheet.absoluteFill, zIndex: 10, overflow: "hidden" },
  glitchBand: { position: "absolute", left: 0, right: 0, height: 13, backgroundColor: "#0A0D12", borderTopWidth: 3, borderBottomWidth: 2, borderColor: "#F4F6F8" },
  bandTop: { top: "31%", transform: [{ translateX: 11 }] },
  bandLower: { top: "62%", transform: [{ translateX: -9 }] },
  scanLine: { position: "absolute", left: 0, right: 0, top: "50%", height: 2, backgroundColor: "#FFFFFF", opacity: 0.7 },
});
