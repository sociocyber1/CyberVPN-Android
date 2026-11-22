import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { HapticTab } from "@/components/haptic-tab";

const COLORS = { bg: "#FFFFFF", edge: "#E3EAF2", muted: "#708095", neon: "#2386F4" };
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 8);
  return (
    <Tabs screenOptions={{
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
  );
}
