import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { LiveVpnFlow, readLiveConnections, readVpnStatus, readFirewallSettings, saveFirewallSettings, openAndroidVpnSettings } from "@/lib/vpn-native";

const C = { bg: "#F4F8FC", panel: "#FFFFFF", edge: "#E3EAF2", text: "#101D2D", muted: "#708095", neon: "#2386F4", warn: "#916A25", red: "#D9485F" };
export default function ConnectionsScreen() {
  const [flows, setFlows] = useState<LiveVpnFlow[]>([]);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (Platform.OS !== "android") { setError("Монитор подключений работает только в установленной Android-сборке."); setLoading(false); return; }
    try {
      const [items, status] = await Promise.all([readLiveConnections(), readVpnStatus()]);
      setFlows(items); setConnected(status.state === "connected"); setNow(Date.now()); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось прочитать потоки VPN."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), 1200); return () => { clearTimeout(initial); clearInterval(timer); }; }, [refresh]);
  const block = async (flow: LiveVpnFlow) => {
    if (!flow.packageName) { setError("Android не смог достоверно определить владельца этого соединения."); return; }
    try {
      const status = await readVpnStatus();
      if (status.state !== "connected") { setError("Сначала подключите CyberVPN; блокировка действует только при активном туннеле."); return; }
      const settings = await readFirewallSettings();
      if (!settings.lockdownEnabled || !settings.alwaysOn) { setError("Сначала включите Always-on VPN и Block connections without VPN в настройках Android."); await openAndroidVpnSettings(); return; }
      await saveFirewallSettings({ enabled: true, blockAll: false, blockedPackages: [...new Set([...settings.blockedPackages, flow.packageName])] });
      setError(`${flow.appLabel} добавлено в блок-лист.`);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось добавить приложение в блок-лист."); }
  };
  return (
    <ScreenContainer containerClassName="bg-[#F4F8FC]">
      <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 18, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 13 }}><View style={{ width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F2FF", borderWidth: 1, borderColor: C.neon }}><MaterialCommunityIcons name="radar" size={22} color={C.neon} /></View><View style={{ flex: 1 }}><Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>Соединения</Text><Text style={{ color: C.muted, fontSize: 10, letterSpacing: 0.5 }}>НАБЛЮДАЕМЫЕ ПОТОКИ VPN</Text></View><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? C.neon : C.muted }} /></View>
        <View style={{ backgroundColor: C.panel, borderWidth: 1, borderColor: C.edge, borderRadius: 14, padding: 12, marginBottom: 10 }}><Text style={{ color: connected ? C.neon : C.warn, fontSize: 11, fontWeight: "800" }}>{connected ? "Туннель подключён · обновление 1,2 с" : "Туннель отключён"}</Text><Text style={{ color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 6 }}>Это лента новых TCP/UDP потоков через TUN за последние 60 секунд, а не весь системный трафик. Пока отображается IP:порт без угадывания hostname. Android может не определить владельца — тогда UID помечен неизвестным. DoH/DoQ, CDN и трафик вне TUN ограничивают атрибуцию.</Text></View>
        {error ? <Text style={{ color: C.warn, fontSize: 11, marginBottom: 7 }}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={C.neon} style={{ marginTop: 24 }} /> : <FlatList data={flows} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={C.neon} />} contentContainerStyle={{ paddingBottom: 16 }} ListEmptyComponent={<View style={{ alignItems: "center", padding: 28 }}><MaterialCommunityIcons name={connected ? "radar" : "lan-disconnect"} size={34} color={C.muted} /><Text style={{ color: C.text, fontWeight: "700", marginTop: 9 }}>{connected ? "Пока нет наблюдаемых потоков" : "Подключите VPN, чтобы видеть трафик"}</Text><Text style={{ color: C.muted, textAlign: "center", fontSize: 11, marginTop: 5 }}>Список очищается после остановки туннеля.</Text></View>} renderItem={({ item }) => {
          const age = Math.max(0, Math.floor((now - item.lastSeenMillis) / 1000));
          return <View style={{ backgroundColor: C.panel, borderWidth: 1, borderColor: C.edge, borderRadius: 13, padding: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><MaterialCommunityIcons name={item.protocol === "TCP" ? "lan-connect" : "access-point-network"} size={18} color={C.neon} /><Text style={{ color: C.text, fontWeight: "800", flex: 1 }} numberOfLines={1}>{item.appLabel || "Неизвестное приложение"}</Text><Text style={{ color: C.muted, fontFamily: "monospace", fontSize: 9 }}>{item.protocol} · {age}с</Text></View>
            {item.packageName ? <Text style={{ color: C.muted, fontSize: 9, marginTop: 5 }}>{item.packageName}</Text> : null}
            <Text selectable style={{ color: C.neon, fontFamily: "monospace", fontSize: 12, marginTop: 7 }}>{item.remoteAddress}:{item.remotePort}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}><Text style={{ color: item.appUid >= 0 ? C.muted : C.warn, fontSize: 9 }}>{item.appUid >= 0 ? `UID ${item.appUid}` : "UID не определён"}</Text><Pressable onPress={() => void block(item)} disabled={!item.packageName} style={{ opacity: item.packageName ? 1 : 0.4, borderWidth: 1, borderColor: C.red, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 4 }}><MaterialCommunityIcons name="block-helper" size={13} color={C.red} /><Text style={{ color: C.red, fontSize: 9, fontWeight: "800" }}>БЛОКИРОВАТЬ</Text></Pressable></View>
          </View>;
        }} />}
      </View>
    </ScreenContainer>
  );
}
