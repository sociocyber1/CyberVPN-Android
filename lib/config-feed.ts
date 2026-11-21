import AsyncStorage from "@react-native-async-storage/async-storage";

const README_URL = "https://raw.githubusercontent.com/sociocyber1/txt/main/README.md";
const CACHE_KEY = "cybervpn.configs.v1";
const REQUEST_TIMEOUT_MS = 20_000;

export type ServerConfig = { id: string; name: string; uri: string };

function displayName(uri: string, index: number): string {
  const fragment = uri.split("#")[1];
  if (!fragment) return `Сервер ${index + 1}`;
  try {
    const decoded = decodeURIComponent(fragment).trim();
    // Source fragments include a geography and an opaque endpoint suffix.
    return decoded.replace(/-[a-z0-9]{6,}-[^\s]+$/i, "").trim() || `Сервер ${index + 1}`;
  } catch {
    return `Сервер ${index + 1}`;
  }
}

function normalizeMarkdownLink(line: string): string | null {
  // Compatibility with the earlier README rendering where the URI was split
  // into a Markdown label and a mailto link.
  const match = line.match(/hy2:\/\/\s*\[([^\]]+)\]\((mailto:[^)]+)\)\s*:(\d+)(\?[^\s]*)?/i);
  if (!match) return null;
  const [credential, linkedHost] = match[1].split("@");
  const host = linkedHost || match[2].replace(/^mailto:[^@]+@/, "");
  if (!credential || !host) return null;
  return `hy2://${credential}@${host}:${match[3]}${match[4] ?? ""}`;
}

export function parseConfigs(markdown: string): ServerConfig[] {
  const configs: ServerConfig[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    const candidate = line.trim().match(/hy2:\/\/[^\s<>"']+/i)?.[0] ?? normalizeMarkdownLink(line.trim());
    if (!candidate) continue;
    const uri = candidate.replace(/[),.;]+$/, "");
    let parsed: URL;
    try { parsed = new URL(uri); } catch { continue; }
    if (parsed.protocol.toLowerCase() !== "hy2:" || !parsed.hostname || !parsed.username || !parsed.port) continue;
    const canonical = parsed.toString();
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    configs.push({ id: canonical, name: displayName(canonical, configs.length), uri: canonical });
  }
  return configs;
}

function isServerConfig(value: unknown): value is ServerConfig {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ServerConfig>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.uri === "string" && item.uri.startsWith("hy2://");
}

export async function readCachedConfigs(): Promise<ServerConfig[]> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isServerConfig) : [];
  } catch {
    return [];
  }
}

export async function refreshConfigs(): Promise<ServerConfig[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // A Cache-Control request header makes browser fetch issue an OPTIONS preflight.
    // raw.githubusercontent.com rejects that preflight, so keep this a simple GET.
    // The unique query prevents a stale README from an intermediary cache.
    const response = await fetch(`${README_URL}?_=${Date.now()}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Не удалось загрузить README: HTTP ${response.status}`);
    const configs = parseConfigs(await response.text());
    if (!configs.length) throw new Error("В README не найдены допустимые ссылки hy2://");
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(configs));
    return configs;
  } finally {
    clearTimeout(timeout);
  }
}
