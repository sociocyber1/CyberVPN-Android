import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { FirewallSettings, InstalledVpnApp, listInstalledApps, openAndroidVpnSettings, readFirewallSettings, readVpnStatus, saveFirewallSettings } from "@/lib/vpn-native";

const C = { bg: "#F4F8FC", panel: "#FFFFFF", edge: "#E3EAF2", text: "#101D2D", muted: "#708095", neon: "#2386F4", lime: "#198754", warn: "#916A25", red: "#D9485F" };
const empty: FirewallSettings = { enabled: false, blockAll: false, blockedPackages: [], lockdownEnabled: false, alwaysOn: false, hasSavedConfig: false };

export default function FirewallScreen() {
  const [apps, setApps] = useState<InstalledVpnApp[]>([]);
  const [settings, setSettings] = useState<FirewallSettings>(empty);
  const [vpnState, setVpnState] = useState("disconnected");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (Platform.OS !== "android") { setError("Firewall доступен только в установленном Android-приложении."); setLoading(false); return; }
    try {
      const [appList, policy, status] = await Promise.all([listInstalledApps(), readFirewallSettings(), readVpnStatus()]);
      setApps(appList); setSettings(policy); setVpnState(status.state); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось получить настройки Firewall."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), 4000); return () => { clearTimeout(initial); clearInterval(timer); }; }, [refresh]);

  const blocked = useMemo(() => new Set(settings.blockedPackages), [settings.blockedPackages]);
  const apply = async (next: Pick<FirewallSettings, "enabled" | "blockAll" | "blockedPackages">) => {
    setBusy(true); setError(null);
    try { setSettings(await saveFirewallSettings(next)); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось применить правило."); }
    finally { setBusy(false); }
  };
  const toggleApp = (pkg: string) => {
    const next = new Set(blocked);
    if (next.has(pkg)) next.delete(pkg); else next.add(pkg);
    void apply({ enabled: next.size > 0, blockAll: false, blockedPackages: [...next] });
  };
  const lockdownReady = settings.lockdownEnabled && settings.alwaysOn;
  const firewallActive = settings.enabled && lockdownReady && vpnState === "connected";

  return (
    <ScreenContainer containerClassName="bg-[#F4F8FC]">
      <View style={{ flex:  1, backgroundColor: C.bg, paddingHorizontal: 18, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 14 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F2FF", borderColor: C.neon, borderWidth: 1 }}><MaterialCommunityIcons name="shield-lock-outline" size={23} color={C.neon} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>VPN Firewall</Text><Text style={{ color: C.muted, fontSize: 10, letterSpacing: 0.5 }}>ПРАВИЛА ДОСТУПА ПРИ АКТИВНОМ VPN</Text></View>
        </View>
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: firewallActive ? "#198754" : "#E3EAF2", backgroundColor: C.panel, padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><MaterialCommunityIcons name={firewallActive ? "shield-check" : "shield-alert-outline"} size={19} color={firewallActive ? C.lime : C.warn} /><Text style={{ color: firewallActive ? C.lime : C.warn, fontWeight: "800", flex: 1 }}>{firewallActive ? "Firewall активен" : lockdownReady ? "Lockdown готов · VPN отключён" : "Нужен системный Lockdown Android"}</Text></View>
          <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{firewallActive ? "Android блокирует приложения, исключённые из VPN. Правила применены к активному туннелю." : lockdownReady ? "Системный Lockdown готов, но выбранные правила не активируются и не считаются применёнными, пока CyberVPN не подключён." : "Без системного Always-on VPN + «Block connections without VPN» исключённые приложения обходят VPN. Включите оба параметра в системных настройках Android."}</Text>
          {!settings.hasSavedConfig ? <Text style={{ color: C.warn, fontSize: 11, lineHeight: 16, marginTop: 7 }}>Сначала подключитесь на вкладке VPN один раз: это сохранит сервер, который Android сможет восстановить при Always-on запуске.</Text> : null}
          <Pressable onPress={() => void openAndroidVpnSettings().catch((e) => setError(e instanceof Error ? e.message : "Не удалось открыть настройки VPN."))} style={{ marginTop: 11, alignSelf: "flex-start", borderWidth: 1, borderColor: C.neon, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 }}><MaterialCommunityIcons name="cog-outline" size={17} color={C.neon} /><Text style={{ color: C.neon, fontSize: 12, fontWeight: "700" }}>Открыть настройки Android VPN</Text></Pressable>
        </View>
        {settings.enabled && !firewallActive ? <Pressable onPress={() => void apply({ enabled: false, blockAll: false, blockedPackages: [] })} disabled={busy} style={{ borderWidth: 1, borderColor: C.warn, borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 7 }}><MaterialCommunityIcons name="shield-off-outline" size={17} color={C.warn} /><Text style={{ color: C.warn, fontSize: 11, fontWeight: "700" }}>Отключить правила Firewall (Lockdown сейчас не активен)</Text></Pressable> : null}
        <View style={{ backgroundColor: C.panel, borderColor: C.edge, borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 11 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><MaterialCommunityIcons name="cancel" size={22} color={C.red} /><View style={{ flex: 1 }}><Text style={{ color: C.text, fontSize: 14, fontWeight: "800" }}>Заблокировать все приложения</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>CyberVPN остаётся служебным исключением.</Text></View><Switch value={settings.blockAll} onValueChange={(value) => void apply({ enabled: value || settings.blockedPackages.length > 0, blockAll: value, blockedPackages: value ? [] : settings.blockedPackages })} disabled={busy || (!firewallActive && !settings.blockAll)} trackColor={{ false: C.edge, true: "#A8CEF9" }} thumbColor={settings.blockAll ? C.lime : C.muted} accessibilityLabel="Заблокировать сеть всем приложениям" /></View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}><Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>Выбранные приложения</Text><Text style={{ color: C.muted, fontSize: 11 }}>{settings.blockedPackages.length} в блок-листе</Text></View>
        {error ? <Text style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={C.neon} style={{ marginTop: 24 }} /> : (
          <FlatList data={apps} keyExtractor={(item) => item.packageName} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} tintColor={C.neon} />} contentContainerStyle={{ paddingBottom: 18 }} ListEmptyComponent={<Text style={{ color: C.muted, marginTop: 20 }}>Не найдено приложений с иконкой запуска.</Text>} renderItem={({ item }) => {
            const isBlocked = blocked.has(item.packageName);
            return <View style={{ minHeight: 62, borderBottomWidth: 1, borderBottomColor: C.edge, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 7 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: isBlocked ? "#FDECEE" : "#E7F2FF", borderWidth: 1, borderColor: isBlocked ? C.red : C.edge }}><Text style={{ color: isBlocked ? C.red : C.neon, fontSize: 15, fontFamily: "monospace", fontWeight: "800" }}>{item.label.trim().slice(0, 1).toUpperCase() || "?"}</Text></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{item.label}</Text><Text numberOfLines={1} style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{item.packageName}</Text></View>
              <Pressable onPress={() => toggleApp(item.packageName)} disabled={busy || settings.blockAll || !firewallActive} accessibilityRole="button" accessibilityLabel={`${isBlocked ? "Разблокировать" : "Заблокировать"} ${item.label}`} style={{ borderWidth: 1, borderColor: isBlocked ? C.red : C.edge, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9, opacity: busy || settings.blockAll || !firewallActive ? 0.45 : 1 }}><Text style={{ color: isBlocked ? C.red : C.muted, fontSize: 10, fontWeight: "800" }}>{isBlocked ? "БЛОК" : "РАЗРЕШИТЬ"}</Text></Pressable>
            </View>;
          }} />
        )}
        {vpnState !== "connected" ? <Text style={{ color: C.warn, fontSize: 10, marginBottom: 6 }}>Сейчас VPN не подключён. Firewall начнёт блокировать только при активном защищённом туннеле.</Text> : null}
      </View>
    </ScreenContainer>
  );
}
