import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { ScreenContainer } from "@/components/screen-container";
import { readCachedConfigs, refreshConfigs, type ServerConfig } from "@/lib/config-feed";
import { connectVpn, disconnectVpn, readVpnStatus, updateNoToVpnDomains, type VpnState } from "@/lib/vpn-native";
import { DEFAULT_NO_TO_VPN_SETTINGS, MAX_NO_TO_VPN_RULES, loadNoToVpnSettings, parseDomainSuffixes, parseNoToVpnSites, saveNoToVpnSettings } from "@/lib/no-to-vpn";
import { DEFAULT_VPN_DNS_SETTINGS, loadVpnDnsSettings, parseVpnDnsServers, saveVpnDnsSettings, type VpnDnsTransport } from "@/lib/dns-settings";
import { noToVpnStyles } from "@/lib/no-to-vpn-styles";
import { COUNTRY_TLD_PRESET } from "@/lib/country-tld-presets";
import { BANK_CARD_NUMBER, ORGANIZATION_NAME, PROJECT_YOUTUBE_URL, SOCIOCYBERNEERING_VIDEO_URL, copyBankCardNumber, openSupportDestination } from "@/lib/support-info";

const COLORS = { bg: "#F4F8FC", ink: "#101D2D", muted: "#708095", blue: "#2386F4", pale: "#E7F2FF", line: "#E3EAF2", white: "#FFFFFF", green: "#198754" };

export default function HomeScreen() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [feedError, setFeedError] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportNotice, setSupportNotice] = useState<string | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [vpnState, setVpnState] = useState<VpnState>("disconnected");
  const [vpnError, setVpnError] = useState<string | null>(null);
  const [noToVpnSettings, setNoToVpnSettings] = useState(DEFAULT_NO_TO_VPN_SETTINGS);
  const [vpnDns, setVpnDns] = useState(DEFAULT_VPN_DNS_SETTINGS);
  const [vpnDnsInput, setVpnDnsInput] = useState(DEFAULT_VPN_DNS_SETTINGS.servers.join(", "));
  const [vpnDnsLoaded, setVpnDnsLoaded] = useState(false);
  const [vpnDnsBusy, setVpnDnsBusy] = useState(false);
  const [vpnDnsError, setVpnDnsError] = useState<string | null>(null);
  const [vpnDnsNotice, setVpnDnsNotice] = useState<string | null>(null);
  const [noToVpnInput, setNoToVpnInput] = useState(DEFAULT_NO_TO_VPN_SETTINGS.suffixes.join(", "));
  const [noToVpnSiteInput, setNoToVpnSiteInput] = useState(DEFAULT_NO_TO_VPN_SETTINGS.sites.join(", "));
  const [noToVpnLoaded, setNoToVpnLoaded] = useState(false);
  const [noToVpnBusy, setNoToVpnBusy] = useState(false);
  const [noToVpnError, setNoToVpnError] = useState<string | null>(null);
  const [noToVpnNotice, setNoToVpnNotice] = useState<string | null>(null);

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

  useEffect(() => {
    const timer = setTimeout(() => { void updateFeed(); }, 0);
    return () => clearTimeout(timer);
  }, [updateFeed]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let active = true;
    const syncStatus = async () => {
      try {
        const status = await readVpnStatus();
        if (active) {
          setVpnState(status.state);
          setVpnError(status.error ?? null);
        }
      } catch { /* Native status is retried on the next poll. */ }
    };
    void syncStatus();
    const timer = setInterval(() => void syncStatus(), 1400);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    let active = true;
    void loadVpnDnsSettings().then((settings) => { if (active) { setVpnDns(settings); setVpnDnsInput(settings.servers.join(", ")); setVpnDnsLoaded(true); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    void loadNoToVpnSettings().then((settings) => {
      if (active) {
        setNoToVpnSettings(settings);
        setNoToVpnInput(settings.suffixes.join(", "));
        setNoToVpnSiteInput(settings.sites.join(", "));
        setNoToVpnLoaded(true);
      }
    });
    return () => { active = false; };
  }, []);
  const currentServer = useMemo(() => servers.find((server) => server.id === selected), [servers, selected]);

  const applyVpnDnsSettings = async () => {
    const parsed = parseVpnDnsServers(vpnDnsInput, vpnDns.transport);
    if (!parsed.ok) { setVpnDnsError(parsed.error); setVpnDnsNotice(null); return; }
    setVpnDnsBusy(true); setVpnDnsError(null); setVpnDnsNotice(null);
    try {
      const next = { transport: vpnDns.transport, servers: parsed.servers };
      await saveVpnDnsSettings(next);
      setVpnDns(next); setVpnDnsInput(next.servers.join(", "));
      setVpnDnsNotice(vpnState === "connected" ? "DNS сохранён; переподключитесь, чтобы применить его к Go-ядру." : "DNS сохранён и будет применён при следующем подключении.");
    } catch (error) { setVpnDnsError(error instanceof Error ? error.message : "Не удалось сохранить DNS."); }
    finally { setVpnDnsBusy(false); }
  };

  const applyNoToVpnSettings = async (enabled: boolean, savedMessage = "Исключения сохранены.") => {
    if (!noToVpnLoaded) {
      setNoToVpnError("Параметры NoToVPN ещё загружаются. Повторите через мгновение.");
      return;
    }
    const parsed = parseDomainSuffixes(noToVpnInput);
    if (!parsed.ok) {
      setNoToVpnError(parsed.error);
      setNoToVpnNotice(null);
      return;
    }
    const parsedSites = parseNoToVpnSites(noToVpnSiteInput);
    if (!parsedSites.ok) { setNoToVpnError(parsedSites.error); setNoToVpnNotice(null); return; }
    if (new Set([...parsed.suffixes, ...parsedSites.domains]).size > MAX_NO_TO_VPN_RULES) {
      setNoToVpnError(`Можно сохранить не более ${MAX_NO_TO_VPN_RULES} правил NoToVPN суммарно.`);
      setNoToVpnNotice(null);
      return;
    }
    if (enabled && parsed.suffixes.length + parsedSites.domains.length === 0) {
      setNoToVpnError("Для включения NoToVPN добавьте хотя бы одну зону или сайт.");
      setNoToVpnNotice(null);
      return;
    }

    const previous = noToVpnSettings;
    const next = { enabled, suffixes: parsed.suffixes, sites: parsedSites.domains };
    const rules = [...parsed.suffixes, ...parsedSites.domains];
    const updateRunningTunnel = Platform.OS === "android" && vpnState === "connected";
    setNoToVpnBusy(true);
    setNoToVpnError(null);
    setNoToVpnNotice(null);
    try {
      if (updateRunningTunnel) {
        await updateNoToVpnDomains(enabled ? rules : []);
      }
      try {
        await saveNoToVpnSettings(next);
      } catch (error) {
        if (updateRunningTunnel) {
          await updateNoToVpnDomains(previous.enabled ? [...previous.suffixes, ...previous.sites] : []).catch(() => undefined);
        }
        throw error;
      }
      setNoToVpnSettings(next);
      setNoToVpnInput(parsed.suffixes.join(", "));
      setNoToVpnSiteInput(parsedSites.domains.join(", "));
      setNoToVpnNotice(enabled && updateRunningTunnel
        ? "NoToVPN включён: активный TUN обновлён."
        : enabled
          ? "NoToVPN включён; правила применятся при подключении VPN."
          : "NoToVPN выключен.");
    } catch (error) {
      setNoToVpnError(error instanceof Error ? error.message : "Не удалось применить настройки NoToVPN.");
    } finally {
      setNoToVpnBusy(false);
    }
  };

  const handleVpnToggle = async () => {
    if (Platform.OS !== "android") {
      setVpnError("VPN работает только в установленной нативной Android-сборке. Web Preview и Expo Go не могут запустить системный VpnService.");
      return;
    }
    if (vpnState === "disconnecting") return;
    if (vpnState === "connected" || vpnState === "connecting" || vpnState === "reconnecting") {
      setVpnState("disconnecting");
      try { await disconnectVpn(); setVpnError(null); }
      catch (error) { Alert.alert("Не удалось отключить VPN", error instanceof Error ? error.message : "Повторите попытку."); }
      return;
    }
    if (!currentServer) {
      Alert.alert("Нет серверов", "Сначала загрузите доступные конфигурации Hysteria2.");
      return;
    }
    if (!noToVpnLoaded) {
      setNoToVpnError("Параметры NoToVPN ещё загружаются. Повторите через мгновение.");
      return;
    }
    const parsedSuffixes = parseDomainSuffixes(noToVpnInput);
    if (!parsedSuffixes.ok) {
      setNoToVpnError(parsedSuffixes.error);
      return;
    }
    const parsedSites = parseNoToVpnSites(noToVpnSiteInput);
    if (!parsedSites.ok) { setNoToVpnError(parsedSites.error); return; }
    if (new Set([...parsedSuffixes.suffixes, ...parsedSites.domains]).size > MAX_NO_TO_VPN_RULES) {
      setNoToVpnError(`Можно сохранить не более ${MAX_NO_TO_VPN_RULES} правил NoToVPN суммарно.`);
      return;
    }
    if (noToVpnSettings.enabled && parsedSuffixes.suffixes.length + parsedSites.domains.length === 0) {
      setNoToVpnError("Для включения NoToVPN добавьте хотя бы одну зону или сайт.");
      return;
    }
    setVpnState("connecting");
    setVpnError(null);
    try {
      const nextSettings = { ...noToVpnSettings, suffixes: parsedSuffixes.suffixes, sites: parsedSites.domains };
      await saveNoToVpnSettings(nextSettings);
      setNoToVpnSettings(nextSettings);
      setNoToVpnInput(parsedSuffixes.suffixes.join(", "));
      setNoToVpnSiteInput(parsedSites.domains.join(", "));
      const dns = await loadVpnDnsSettings();
      await connectVpn(currentServer.uri, noToVpnSettings.enabled ? [...parsedSuffixes.suffixes, ...parsedSites.domains] : [], dns);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "Проверьте конфигурацию и повторите попытку.";
      setVpnState("error");
      setVpnError(message);
      Alert.alert("Не удалось подключиться", message);
    }
  };

  const statusLabels: Record<VpnState, string> = {
    disconnected: "ОТКЛЮЧЕНО",
    connecting: "ПОДКЛЮЧЕНИЕ",
    connected: "ПОДКЛЮЧЕНО",
    reconnecting: "ВОССТАНОВЛЕНИЕ",
    disconnecting: "ОТКЛЮЧЕНИЕ",
    error: "ОШИБКА",
  };
  const active = vpnState === "connected" || vpnState === "connecting" || vpnState === "reconnecting" || vpnState === "disconnecting";
  const statusColor = vpnState === "connected" ? COLORS.green : vpnState === "error" ? "#D9485F" : active ? COLORS.blue : COLORS.muted;

  const copyCard = async () => {
    try {
      await copyBankCardNumber((text) => Clipboard.setStringAsync(text));
      setCopied(true);
      setSupportNotice(null);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setSupportNotice(`Не удалось скопировать. Номер карты: ${BANK_CARD_NUMBER}`);
    }
  };
  const openSupportLink = async (destination: "email" | "telegram" | "bank", failure: string) => {
    setSupportVisible(false);
    setSupportNotice(null);
    try { await openSupportDestination(destination, (url) => Linking.openURL(url)); }
    catch {
      setSupportNotice(failure);
      setSupportVisible(true);
    }
  };
  const openProject = async () => {
    setProjectNotice(null);
    try { await openSupportDestination("project", (url) => Linking.openURL(url)); }
    catch { setProjectNotice(`Не удалось открыть ссылку. Откройте вручную: ${PROJECT_YOUTUBE_URL}`); }
  };
  const openOrganizationVideo = async () => {
    setProjectNotice(null);
    try { await Linking.openURL(SOCIOCYBERNEERING_VIDEO_URL); }
    catch { setProjectNotice(`Не удалось открыть ссылку. Откройте вручную: ${SOCIOCYBERNEERING_VIDEO_URL}`); }
  };
  return (
    <ScreenContainer containerClassName="bg-[#F4F8FC]">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.brand}>CyberVPN</Text><Text style={styles.caption}>ПРОСТО. БЫСТРО. БЕЗ ЛИШНЕГО.</Text></View>
          <Pressable onPress={() => void updateFeed()} style={styles.refreshButton} accessibilityLabel="Обновить серверы"><Text style={styles.refreshGlyph}>{refreshing ? "· · ·" : "↻"}</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: statusColor }]} /><Text style={[styles.statusText, { color: statusColor }]}>{statusLabels[vpnState]}</Text></View>
          <Pressable onPress={() => void handleVpnToggle()} style={({ pressed }) => [styles.powerButton, pressed && { opacity: 0.86 }]} accessibilityRole="button" accessibilityLabel={active ? "Отключить VPN" : "Подключить VPN"}>
            <View style={[styles.powerRing, vpnState === "connected" && { backgroundColor: COLORS.green }]}><View style={styles.powerGlyph}><View style={styles.powerStem} /></View></View>
          </Pressable>
          <Text style={styles.heroTitle}>{vpnState === "connected" ? "Защищённое соединение" : vpnState === "error" ? "Подключение не удалось" : "Подключиться к VPN"}</Text>
          <Text style={styles.heroSub}>{vpnError ?? (vpnState === "connected" ? "Туннель Hysteria2 активен" : vpnState === "disconnecting" ? "Закрываем туннель…" : active ? "Ожидаем ответа сервера…" : "Нажмите, чтобы начать защищённое соединение")}</Text>
        </View>

        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Сервер</Text><Pressable onPress={() => void updateFeed()}><Text style={styles.blueText}>{refreshing ? "Проверяем…" : "Обновить"}</Text></Pressable></View>
        <Pressable style={styles.serverCard} onPress={() => {
          if (active) { Alert.alert("Сначала отключите VPN", "Чтобы сменить сервер, сначала остановите текущее соединение."); return; }
          if (servers.length > 1) Alert.alert("Выбор сервера", undefined, [...servers.map((s) => ({ text: s.name, onPress: () => setSelected(s.id) })), { text: "Отмена", style: "cancel" }]);
        }}>
          <View style={styles.flag}><Text style={{ fontSize: 18 }}>◉</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.serverName}>{currentServer?.name ?? (refreshing ? "Загружаем список…" : "Нет доступных серверов")}</Text><Text style={styles.serverDetail}>{servers.length} {servers.length === 1 ? "сервер" : "серверов"} · Hysteria2</Text></View>
          {refreshing ? <ActivityIndicator color={COLORS.blue} /> : <Text style={styles.chevron}>›</Text>}
        </Pressable>
        <Text style={styles.feedNote}>{feedError ? "Не удалось проверить README. Показан сохранённый список, если он есть." : updatedAt ? `Список проверен ${updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Источник: sociocyber1/txt · README.md"}</Text>

        <Pressable onPress={() => { setSupportNotice(null); setSupportVisible(true); }} style={styles.supportCard} accessibilityRole="button">
          <View style={styles.supportIntro}><Text style={styles.heart}>♡</Text><View style={{ flex: 1 }}><Text style={styles.supportTitle}>Поддержать автора</Text><Text style={styles.supportSub}>Показать реквизиты</Text></View><Text style={styles.chevron}>›</Text></View>
        </Pressable>
        <View style={[styles.supportCard, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>О проекте</Text>
          <Text style={[styles.supportTitle, { marginTop: 8 }]}>{ORGANIZATION_NAME}</Text>
          <Pressable onPress={() => void openProject()} style={[styles.actionSecondary, { marginTop: 12, marginBottom: 0 }]} accessibilityRole="link">
            <Text style={styles.actionSecondaryText}>Материалы о проекте на YouTube</Text>
          </Pressable>
          <Pressable onPress={() => void openOrganizationVideo()} style={styles.actionSecondary} accessibilityRole="link">
            <Text style={styles.actionSecondaryText}>SocioCyberneering Inc. · видео с 22:42</Text>
          </Pressable>
          {projectNotice ? <Text style={[styles.footnote, { color: "#D9485F" }]}>{projectNotice}</Text> : null}
        </View>
        <View style={[styles.supportCard, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>DNS через VPN</Text>
          <Text style={[noToVpnStyles.description, { marginTop: 5 }]}>Обычные DNS-запросы идут через Hysteria-туннель к Go-ядру; прямого DNS fallback здесь нет.</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
            {(["udp", "tcp", "tls", "https"] as VpnDnsTransport[]).map((transport) => (
              <Pressable key={transport} onPress={() => { setVpnDns((current) => ({ ...current, transport })); setVpnDnsError(null); }} disabled={!vpnDnsLoaded || vpnDnsBusy || active} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: vpnDns.transport === transport ? COLORS.pale : "#F4F8FC", borderWidth: 1, borderColor: vpnDns.transport === transport ? COLORS.blue : COLORS.line }}>
                <Text style={{ color: vpnDns.transport === transport ? COLORS.blue : COLORS.muted, fontSize: 11, fontWeight: "700" }}>{transport === "tls" ? "DoT" : transport === "https" ? "DoH" : transport.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={vpnDnsInput} onChangeText={(value) => { setVpnDnsInput(value); setVpnDnsError(null); setVpnDnsNotice(null); }} editable={vpnDnsLoaded && !vpnDnsBusy && !active} placeholder={vpnDns.transport === "https" ? "https://dns.google/dns-query" : vpnDns.transport === "tls" ? "dns.google, one.one.one.one" : "8.8.8.8, 8.8.4.4"} placeholderTextColor="#9AA7B7" multiline autoCapitalize="none" autoCorrect={false} style={noToVpnStyles.input} accessibilityLabel="Серверы DNS, используемые в VPN-туннеле" />
          <Pressable onPress={() => void applyVpnDnsSettings()} disabled={!vpnDnsLoaded || vpnDnsBusy || active} style={({ pressed }) => [noToVpnStyles.saveButton, pressed && { opacity: 0.8 }, (!vpnDnsLoaded || vpnDnsBusy || active) && { opacity: 0.5 }]} accessibilityRole="button">
            {vpnDnsBusy ? <ActivityIndicator color={COLORS.blue} /> : <Text style={noToVpnStyles.saveText}>Сохранить DNS</Text>}
          </Pressable>
          {vpnDnsError ? <Text style={noToVpnStyles.error}>{vpnDnsError}</Text> : null}
          {vpnDnsNotice ? <Text style={noToVpnStyles.notice}>{vpnDnsNotice}</Text> : null}
        </View>
        <View style={[styles.supportCard, { marginTop: 12 }]}>
          <View style={noToVpnStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>NoToVPN</Text>
              <Text style={noToVpnStyles.description}>Не отправлять выбранные доменные зоны через Hysteria2.</Text>
            </View>
            <Switch
              value={noToVpnSettings.enabled}
              onValueChange={(enabled) => void applyNoToVpnSettings(enabled)}
              disabled={!noToVpnLoaded || noToVpnBusy || !["disconnected", "connected", "error"].includes(vpnState)}
              trackColor={{ false: "#D4DDE8", true: "#91C6FF" }}
              thumbColor={noToVpnSettings.enabled ? COLORS.blue : "#FFFFFF"}
              accessibilityLabel="Включить или выключить NoToVPN"
            />
          </View>
          <Pressable onPress={() => { setNoToVpnInput([...new Set([...noToVpnInput.split(/[\s,;]+/u).filter(Boolean), ...COUNTRY_TLD_PRESET])].join(", ")); setNoToVpnError(null); }} style={[noToVpnStyles.saveButton, { marginTop: 8 }]} accessibilityRole="button">
            <Text style={noToVpnStyles.saveText}>Добавить все зоны стран и территорий ({COUNTRY_TLD_PRESET.length})</Text>
          </Pressable>
          <TextInput
            value={noToVpnInput}
            onChangeText={(value) => { setNoToVpnInput(value); setNoToVpnError(null); setNoToVpnNotice(null); }}
            editable={noToVpnLoaded && !noToVpnBusy && ["disconnected", "connected", "error"].includes(vpnState)}
            placeholder="Например: .ru, .kz, .eu"
            placeholderTextColor="#9AA7B7"
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={noToVpnStyles.input}
            accessibilityLabel="Доменные суффиксы для обхода VPN"
          />
          <Text style={[noToVpnStyles.description, { marginTop: 12 }]}>NoToVPN List · отдельные сайты (без https:// и пути; *.site.ru включает поддомены)</Text>
          <TextInput
            value={noToVpnSiteInput}
            onChangeText={(value) => { setNoToVpnSiteInput(value); setNoToVpnError(null); setNoToVpnNotice(null); }}
            editable={noToVpnLoaded && !noToVpnBusy && ["disconnected", "connected", "error"].includes(vpnState)}
            placeholder="gosuslugi.ru, nalog.gov.ru"
            placeholderTextColor="#9AA7B7"
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={noToVpnStyles.input}
            accessibilityLabel="Точные сайты для обхода VPN"
          />
          <Pressable
            onPress={() => void applyNoToVpnSettings(noToVpnSettings.enabled)}
            disabled={!noToVpnLoaded || noToVpnBusy || !["disconnected", "connected", "error"].includes(vpnState)}
            style={({ pressed }) => [noToVpnStyles.saveButton, pressed && { opacity: 0.8 }, (!noToVpnLoaded || noToVpnBusy) && { opacity: 0.5 }]}
            accessibilityRole="button"
          >
            {noToVpnBusy ? <ActivityIndicator color={COLORS.blue} /> : <Text style={noToVpnStyles.saveText}>Сохранить исключения</Text>}
          </Pressable>
          <Text style={noToVpnStyles.helper}>
            Для выбранных доменов DNS-запросы идут напрямую через DNS физической сети; при активном Android Private DNS используется DoT, если имя сервера доступно, иначе — зашифрованный DoH. Ответы A/AAAA дают IP для прямой TCP/UDP-маршрутизации. DNS-провайдер видит эти запросы.
          </Text>
          <Text style={noToVpnStyles.warning}>
            Маршрут выбирается по IP из DNS-ответа: общий CDN-IP может временно обходить VPN и для других доменов до истечения TTL. Приложения с собственным DoH могут не раскрыть домен. Это не строгий доменный firewall.
          </Text>
          {noToVpnError ? <Text style={noToVpnStyles.error}>{noToVpnError}</Text> : null}
          {noToVpnNotice ? <Text style={noToVpnStyles.notice}>{noToVpnNotice}</Text> : null}
        </View>
        <Text style={styles.footnote}>Конфигурации обновляются из открытого репозитория. Для создания VPN Android запросит системное разрешение.</Text>
      </ScrollView>

      <Modal visible={supportVisible} transparent animationType="fade" onRequestClose={() => setSupportVisible(false)}>
        <Pressable style={styles.scrim} onPress={() => setSupportVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} /><Text style={styles.sheetTitle}>Поддержать автора</Text>
            <Text style={styles.supportCopy}>Если вы считаете эту работу полезной — можно помочь деньгами. Коротко, без драматургии: автор делает всё сам, из своего кармана и бесплатно, а подписки, инструменты, сервера и время на них расходуются вполне материально.</Text>
            <Text style={[styles.bankName, { marginTop: 14 }]}>Сбер</Text><Text style={styles.sheetCard}>{BANK_CARD_NUMBER}</Text>
            <Pressable style={styles.actionPrimary} onPress={() => void copyCard()}><Text style={styles.actionPrimaryText}>{copied ? "Номер скопирован" : "Скопировать номер карты"}</Text></Pressable>
            {supportNotice ? <Text style={[styles.footnote, { color: "#D9485F", marginBottom: 8 }]}>{supportNotice}</Text> : null}
            <Pressable style={styles.actionSecondary} onPress={() => void openSupportLink("bank", "Не удалось открыть Сбер. Скопируйте номер карты и откройте приложение банка вручную.")}><Text style={styles.actionSecondaryText}>Открыть приложение Сбер</Text></Pressable>
            <Text style={styles.sbpHint}>Ссылка открывает Сбербанк Онлайн, но не конкретный экран СБП. Для перевода выберите СБП вручную; автоматический перевод не выполняется.</Text>
            <Text style={[styles.bankName, { marginTop: 14, marginBottom: 7 }]}>Связаться с автором</Text>
            <Pressable style={styles.actionSecondary} onPress={() => void openSupportLink("email", "Не удалось открыть почту. Напишите автору: sociocyber1@gmail.com")} accessibilityRole="link"><Text style={styles.actionSecondaryText}>sociocyber1@gmail.com</Text></Pressable>
            <Pressable style={styles.actionSecondary} onPress={() => void openSupportLink("telegram", "Не удалось открыть Telegram. Найдите автора: @sc_sinus (https://t.me/sc_sinus)")} accessibilityRole="link"><Text style={styles.actionSecondaryText}>Telegram · @sc_sinus</Text></Pressable>
            <Pressable onPress={() => setSupportVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>Закрыть</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg }, content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 36 }, topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }, brandMark: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.blue }, brandMarkText: { color: COLORS.white, fontSize: 23, fontWeight: "800" }, brand: { color: COLORS.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.5 }, caption: { color: COLORS.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.05, marginTop: 2 }, refreshButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, refreshGlyph: { color: COLORS.blue, fontSize: 24, fontWeight: "600" }, hero: { backgroundColor: COLORS.white, borderRadius: 26, paddingVertical: 25, alignItems: "center", borderWidth: 1, borderColor: COLORS.line, marginBottom: 23 }, statusRow: { flexDirection: "row", alignItems: "center", gap: 7 }, statusDot: { width: 7, height: 7, borderRadius: 5 }, statusText: { color: COLORS.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, powerButton: { width: 128, height: 128, borderRadius: 64, marginTop: 20, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.pale }, powerRing: { width: 94, height: 94, borderRadius: 47, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.blue, elevation: 8, shadowColor: COLORS.blue, shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, powerGlyph: { width: 44, height: 44, borderRadius: 22, borderWidth: 5, borderColor: COLORS.white, borderTopColor: "transparent", alignItems: "center", justifyContent: "center" }, powerStem: { position: "absolute", top: -5, width: 5, height: 24, borderRadius: 3, backgroundColor: COLORS.white }, heroTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "700", marginTop: 17 }, heroSub: { color: COLORS.muted, fontSize: 12, marginTop: 5 }, sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, sectionTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "700" }, blueText: { color: COLORS.blue, fontSize: 13, fontWeight: "700" }, serverCard: { minHeight: 72, backgroundColor: COLORS.white, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, flag: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.pale, justifyContent: "center", alignItems: "center" }, serverName: { color: COLORS.ink, fontSize: 14, fontWeight: "700" }, serverDetail: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, chevron: { color: COLORS.muted, fontSize: 26, marginLeft: 8 }, feedNote: { color: COLORS.muted, fontSize: 11, marginTop: 8, marginBottom: 19 }, supportCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, padding: 17 }, supportIntro: { flexDirection: "row", alignItems: "center", gap: 11 }, heart: { color: COLORS.blue, fontSize: 28, lineHeight: 34 }, supportTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "700" }, supportSub: { color: COLORS.muted, fontSize: 11, marginTop: 2 }, supportCopy: { color: "#596A7E", fontSize: 12, lineHeight: 18, marginTop: 12 }, requisites: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: "#F9FBFD", minHeight: 62, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, bankName: { color: COLORS.muted, fontSize: 10, fontWeight: "700" }, cardNumber: { color: COLORS.ink, fontSize: 17, letterSpacing: 0.7, fontWeight: "800", marginTop: 3 }, copied: { color: COLORS.green, fontSize: 12, fontWeight: "700", marginTop: 10 }, footnote: { textAlign: "center", color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 17, paddingHorizontal: 7 }, scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,22,39,0.42)" }, sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 23, paddingTop: 11, paddingBottom: Platform.OS === "web" ? 25 : 36 }, handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D4DDE8", alignSelf: "center", marginBottom: 18 }, sheetTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "800" }, sheetCard: { color: COLORS.muted, fontSize: 15, fontWeight: "700", marginTop: 6, marginBottom: 17 }, actionPrimary: { height: 50, borderRadius: 14, backgroundColor: COLORS.blue, alignItems: "center", justifyContent: "center", marginBottom: 9 }, actionPrimaryText: { color: COLORS.white, fontSize: 14, fontWeight: "700" }, actionSecondary: { height: 49, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", marginBottom: 9, backgroundColor: COLORS.white }, actionSecondaryText: { color: COLORS.ink, fontSize: 14, fontWeight: "700" }, sbpHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }, cancel: { alignItems: "center", paddingTop: 15, paddingBottom: 4 }, cancelText: { color: COLORS.blue, fontSize: 14, fontWeight: "700" },
});
