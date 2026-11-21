import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { ScreenContainer } from "@/components/screen-container";
import { readCachedConfigs, refreshConfigs, type ServerConfig } from "@/lib/config-feed";

const CARD_NUMBER = "2202 2050 2451 1591";
const COLORS = { bg: "#F4F8FC", ink: "#101D2D", muted: "#708095", blue: "#2386F4", pale: "#E7F2FF", line: "#E3EAF2", white: "#FFFFFF", green: "#198754" };

export default function HomeScreen() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [feedError, setFeedError] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateFeed = useCallback(async () => {
    setRefreshing(true);
    setFeedError(false);
    try {
      const next = await refreshConfigs();
      setServers(next);
      setSelected((current) => next.some((server) => server.id === current) ? current : next[0]?.id ?? null);
      setUpdatedAt(new Date());
    } catch {
      const cached = await readCachedConfigs();
      setServers(cached);
      setSelected((current) => current ?? cached[0]?.id ?? null);
      setFeedError(true);
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { void updateFeed(); }, [updateFeed]);
  const currentServer = useMemo(() => servers.find((server) => server.id === selected), [servers, selected]);

  const copyCard = async () => {
    await Clipboard.setStringAsync(CARD_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const openSber = async (forSbp = false) => {
    setSupportVisible(false);
    try { await Linking.openURL("sberbankonline://"); }
    catch { Alert.alert("Сбер не найден", forSbp ? "Скопируйте номер карты и откройте СБП в приложении банка." : "Установите приложение Сбер или скопируйте номер карты."); }
  };
  const showConnectionInfo = () => Alert.alert("VPN пока недоступен", "Для настоящего VPN-подключения требуется нативный Android VPN-модуль и Hysteria2-core. Сейчас приложение обновляет и показывает конфигурации, но не создаёт VPN-туннель.");

  return (
    <ScreenContainer containerClassName="bg-[#F4F8FC]">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.brand}>CyberVPN</Text><Text style={styles.caption}>ПРОСТО. БЫСТРО. БЕЗ ЛИШНЕГО.</Text></View>
          <Pressable onPress={() => void updateFeed()} style={styles.refreshButton} accessibilityLabel="Обновить серверы"><Text style={styles.refreshGlyph}>{refreshing ? "· · ·" : "↻"}</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: COLORS.muted }]} /><Text style={styles.statusText}>ОТКЛЮЧЕНО</Text></View>
          <Pressable onPress={showConnectionInfo} style={({ pressed }) => [styles.powerButton, pressed && { opacity: 0.86 }]} accessibilityRole="button" accessibilityLabel="Подключить VPN">
            <View style={styles.powerRing}><Text style={styles.powerGlyph}>⏻</Text></View>
          </Pressable>
          <Text style={styles.heroTitle}>Защищённое соединение</Text>
          <Text style={styles.heroSub}>VPN-модуль Android пока не подключён</Text>
        </View>

        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Сервер</Text><Pressable onPress={() => void updateFeed()}><Text style={styles.blueText}>{refreshing ? "Проверяем…" : "Обновить"}</Text></Pressable></View>
        <Pressable style={styles.serverCard} onPress={() => servers.length > 1 && Alert.alert("Выбор сервера", undefined, [...servers.map((s) => ({ text: s.name, onPress: () => setSelected(s.id) })), { text: "Отмена", style: "cancel" }])}>
          <View style={styles.flag}><Text style={{ fontSize: 18 }}>◉</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.serverName}>{currentServer?.name ?? (refreshing ? "Загружаем список…" : "Нет доступных серверов")}</Text><Text style={styles.serverDetail}>{servers.length} {servers.length === 1 ? "сервер" : "серверов"} · Hysteria2</Text></View>
          {refreshing ? <ActivityIndicator color={COLORS.blue} /> : <Text style={styles.chevron}>›</Text>}
        </Pressable>
        <Text style={styles.feedNote}>{feedError ? "Не удалось проверить README. Показан сохранённый список, если он есть." : updatedAt ? `Список проверен ${updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Источник: sociocyber1/txt · README.md"}</Text>

        <View style={styles.supportCard}>
          <View style={styles.supportIntro}><Text style={styles.heart}>♡</Text><View style={{ flex: 1 }}><Text style={styles.supportTitle}>Поддержать автора</Text><Text style={styles.supportSub}>Добровольно и без подписок</Text></View></View>
          <Text style={styles.supportCopy}>Если вы считаете эту работу полезной — можно помочь деньгами. Коротко, без драматургии: автор делает всё сам, из своего кармана и бесплатно, а подписки, инструменты, сервера и время на них расходуются вполне материально.</Text>
          <Pressable onPress={() => setSupportVisible(true)} style={styles.requisites} accessibilityRole="button"><View><Text style={styles.bankName}>Сбер · нажмите для действий</Text><Text style={styles.cardNumber}>{CARD_NUMBER}</Text></View><Text style={styles.chevron}>›</Text></Pressable>
          {copied && <Text style={styles.copied}>Номер карты скопирован</Text>}
        </View>
        <Text style={styles.footnote}>Конфигурации загружаются из открытого репозитория. Подключение VPN станет доступно после добавления нативного Android-модуля.</Text>
      </ScrollView>

      <Modal visible={supportVisible} transparent animationType="fade" onRequestClose={() => setSupportVisible(false)}>
        <Pressable style={styles.scrim} onPress={() => setSupportVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} /><Text style={styles.sheetTitle}>Реквизиты Сбера</Text><Text style={styles.sheetCard}>{CARD_NUMBER}</Text>
            <Pressable style={styles.actionPrimary} onPress={() => void copyCard()}><Text style={styles.actionPrimaryText}>{copied ? "Номер скопирован" : "Скопировать номер карты"}</Text></Pressable>
            <Pressable style={styles.actionSecondary} onPress={() => void openSber()}><Text style={styles.actionSecondaryText}>Открыть приложение Сбер</Text></Pressable>
            <Pressable style={styles.actionSecondary} onPress={() => void openSber(true)}><Text style={styles.actionSecondaryText}>Открыть Сбер для СБП</Text></Pressable>
            <Text style={styles.sbpHint}>Откроется приложение Сбера. Перевод не выполняется автоматически — выберите СБП в приложении банка.</Text>
            <Pressable onPress={() => setSupportVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>Закрыть</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg }, content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 36 }, topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }, brandMark: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.blue }, brandMarkText: { color: COLORS.white, fontSize: 23, fontWeight: "800" }, brand: { color: COLORS.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.5 }, caption: { color: COLORS.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.05, marginTop: 2 }, refreshButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, refreshGlyph: { color: COLORS.blue, fontSize: 24, fontWeight: "600" }, hero: { backgroundColor: COLORS.white, borderRadius: 26, paddingVertical: 25, alignItems: "center", borderWidth: 1, borderColor: COLORS.line, marginBottom: 23 }, statusRow: { flexDirection: "row", alignItems: "center", gap: 7 }, statusDot: { width: 7, height: 7, borderRadius: 5 }, statusText: { color: COLORS.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, powerButton: { width: 128, height: 128, borderRadius: 64, marginTop: 20, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.pale }, powerRing: { width: 94, height: 94, borderRadius: 47, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.blue, elevation: 8, shadowColor: COLORS.blue, shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, powerGlyph: { color: COLORS.white, fontSize: 48, lineHeight: 54, fontWeight: "400" }, heroTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "700", marginTop: 17 }, heroSub: { color: COLORS.muted, fontSize: 12, marginTop: 5 }, sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, sectionTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "700" }, blueText: { color: COLORS.blue, fontSize: 13, fontWeight: "700" }, serverCard: { minHeight: 72, backgroundColor: COLORS.white, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, flag: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.pale, justifyContent: "center", alignItems: "center" }, serverName: { color: COLORS.ink, fontSize: 14, fontWeight: "700" }, serverDetail: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, chevron: { color: COLORS.muted, fontSize: 26, marginLeft: 8 }, feedNote: { color: COLORS.muted, fontSize: 11, marginTop: 8, marginBottom: 19 }, supportCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, padding: 17 }, supportIntro: { flexDirection: "row", alignItems: "center", gap: 11 }, heart: { color: COLORS.blue, fontSize: 28, lineHeight: 34 }, supportTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "700" }, supportSub: { color: COLORS.muted, fontSize: 11, marginTop: 2 }, supportCopy: { color: "#596A7E", fontSize: 12, lineHeight: 18, marginTop: 12 }, requisites: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: "#F9FBFD", minHeight: 62, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, bankName: { color: COLORS.muted, fontSize: 10, fontWeight: "700" }, cardNumber: { color: COLORS.ink, fontSize: 17, letterSpacing: 0.7, fontWeight: "800", marginTop: 3 }, copied: { color: COLORS.green, fontSize: 12, fontWeight: "700", marginTop: 10 }, footnote: { textAlign: "center", color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 17, paddingHorizontal: 7 }, scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,22,39,0.42)" }, sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 23, paddingTop: 11, paddingBottom: Platform.OS === "web" ? 25 : 36 }, handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D4DDE8", alignSelf: "center", marginBottom: 18 }, sheetTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "800" }, sheetCard: { color: COLORS.muted, fontSize: 15, fontWeight: "700", marginTop: 6, marginBottom: 17 }, actionPrimary: { height: 50, borderRadius: 14, backgroundColor: COLORS.blue, alignItems: "center", justifyContent: "center", marginBottom: 9 }, actionPrimaryText: { color: COLORS.white, fontSize: 14, fontWeight: "700" }, actionSecondary: { height: 49, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", marginBottom: 9, backgroundColor: COLORS.white }, actionSecondaryText: { color: COLORS.ink, fontSize: 14, fontWeight: "700" }, sbpHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }, cancel: { alignItems: "center", paddingTop: 15, paddingBottom: 4 }, cancelText: { color: COLORS.blue, fontSize: 14, fontWeight: "700" },
});
