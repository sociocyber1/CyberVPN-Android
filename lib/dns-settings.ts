import AsyncStorage from "@react-native-async-storage/async-storage";

export type VpnDnsTransport = "udp" | "tcp" | "tls" | "https";
export type VpnDnsSettings = { transport: VpnDnsTransport; servers: string[] };
export type DnsParseResult =
  | { ok: true; servers: string[] }
  | { ok: false; error: string };

export const VPN_DNS_STORAGE_KEY = "cybervpn.vpnDns.v1";
export const DEFAULT_VPN_DNS_SETTINGS: VpnDnsSettings = {
  transport: "udp",
  servers: ["8.8.8.8", "8.8.4.4"],
};

const transports: VpnDnsTransport[] = ["udp", "tcp", "tls", "https"];

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) =>
    /^\d{1,3}$/u.test(part) && Number(part) >= 0 && Number(part) <= 255,
  );
}

function isIpv6(value: string): boolean {
  const unwrapped = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  if (!unwrapped.includes(":")) return false;
  try {
    const hostname = new URL(`https://[${unwrapped}]/`).hostname;
    return hostname.includes(":");
  } catch {
    return false;
  }
}

function normalizeHost(value: string): string | null {
  if (!value || /[\s/@?#\\]/u.test(value)) return null;
  if (isIpv4(value) || isIpv6(value)) return value;
  try {
    const hostname = new URL(`https://${value}/`).hostname.toLowerCase().replace(/\.$/u, "");
    if (!hostname || hostname.includes(":") || hostname.length > 253) return null;
    const labels = hostname.split(".");
    if (!labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label) && label.length <= 63)) return null;
    return hostname;
  } catch {
    return null;
  }
}

export function parseVpnDnsServers(input: string, transport: VpnDnsTransport): DnsParseResult {
  const entries = input.split(/[\s,;]+/u).map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) return { ok: false, error: "Укажите хотя бы один DNS-сервер." };
  if (entries.length > 8) return { ok: false, error: "Можно указать не более 8 DNS-серверов." };

  const normalized: string[] = [];
  for (const entry of entries) {
    if (transport === "https") {
      let url: URL;
      try {
        const value = entry.includes("://") ? entry : `https://${entry}`;
        url = new URL(value);
      } catch {
        return { ok: false, error: `Некорректный DoH-адрес: ${entry}` };
      }
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
        return { ok: false, error: `DoH должен быть HTTPS-адресом без логина и пароля: ${entry}` };
      }
      if (url.pathname === "/") url.pathname = "/dns-query";
      url.hash = "";
      normalized.push(url.toString());
      continue;
    }

    if (transport === "udp" || transport === "tcp") {
      if (!isIpv4(entry) && !isIpv6(entry)) {
        return { ok: false, error: `${transport.toUpperCase()} DNS требует IP-адрес без имени хоста: ${entry}` };
      }
      normalized.push(entry);
      continue;
    }

    const host = normalizeHost(entry);
    if (!host) return { ok: false, error: `Некорректный DoT-сервер: ${entry}` };
    normalized.push(host);
  }
  return { ok: true, servers: [...new Set(normalized)] };
}

export async function loadVpnDnsSettings(): Promise<VpnDnsSettings> {
  try {
    const saved = await AsyncStorage.getItem(VPN_DNS_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_VPN_DNS_SETTINGS, servers: [...DEFAULT_VPN_DNS_SETTINGS.servers] };
    const value: unknown = JSON.parse(saved);
    if (!value || typeof value !== "object") throw new Error("Invalid DNS settings");
    const record = value as { transport?: unknown; servers?: unknown };
    if (!transports.includes(record.transport as VpnDnsTransport) || !Array.isArray(record.servers) || !record.servers.every((item) => typeof item === "string")) {
      throw new Error("Invalid DNS settings");
    }
    const result = parseVpnDnsServers(record.servers.join(" "), record.transport as VpnDnsTransport);
    if (!result.ok) throw new Error(result.error);
    return { transport: record.transport as VpnDnsTransport, servers: result.servers };
  } catch {
    return { ...DEFAULT_VPN_DNS_SETTINGS, servers: [...DEFAULT_VPN_DNS_SETTINGS.servers] };
  }
}

export async function saveVpnDnsSettings(settings: VpnDnsSettings): Promise<void> {
  if (!transports.includes(settings.transport)) throw new Error("Неподдерживаемый DNS-транспорт.");
  const result = parseVpnDnsServers(settings.servers.join(" "), settings.transport);
  if (!result.ok) throw new Error(result.error);
  await AsyncStorage.setItem(VPN_DNS_STORAGE_KEY, JSON.stringify({ transport: settings.transport, servers: result.servers }));
}
