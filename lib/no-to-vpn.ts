import AsyncStorage from "@react-native-async-storage/async-storage";

export type NoToVpnSettings = { enabled: boolean; suffixes: string[]; sites: string[] };
export type DomainParseResult = { ok: true; domains: string[] } | { ok: false; error: string };
export type SuffixParseResult = { ok: true; suffixes: string[] } | { ok: false; error: string };

export const NO_TO_VPN_STORAGE_KEY = "cybervpn.noToVpn.v1";
export const DEFAULT_NO_TO_VPN_SETTINGS: NoToVpnSettings = {
  enabled: false,
  suffixes: [".ru", ".kz", ".eu"],
  sites: ["gosuslugi.ru", "government.ru", "nalog.gov.ru", "kremlin.ru"],
};
export const MAX_NO_TO_VPN_RULES = 400;

function normalizeDomain(entry: string): string | null {
  if (!entry || /[\s/:?#@\\]/u.test(entry)) return null;
  try {
    const ascii = new URL(`https://${entry}/`).hostname.toLowerCase().replace(/\.$/u, "");
    const labels = ascii.split(".");
    return ascii.length <= 253 && labels.every((label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label)) && !labels.every((label) => /^\d+$/u.test(label)) ? ascii : null;
  } catch { return null; }
}

export function parseDomainSuffixes(input: string): SuffixParseResult {
  const entries = input.split(/[\s,;]+/u).map((x) => x.trim()).filter(Boolean);
  if (entries.length > MAX_NO_TO_VPN_RULES) return { ok: false, error: `Можно указать не более ${MAX_NO_TO_VPN_RULES} доменных зон.` };
  const suffixes: string[] = [];
  for (const entry of entries) {
    const raw = entry.startsWith("*.") ? entry.slice(2) : entry.startsWith(".") ? entry.slice(1) : entry;
    const domain = normalizeDomain(raw);
    if (!domain) return { ok: false, error: `Некорректная доменная зона: ${entry}` };
    const suffix = `.${domain}`;
    if (!suffixes.includes(suffix)) suffixes.push(suffix);
  }
  return { ok: true, suffixes };
}

export function parseNoToVpnSites(input: string): DomainParseResult {
  const entries = input.split(/[\s,;]+/u).map((x) => x.trim()).filter(Boolean);
  if (entries.length > MAX_NO_TO_VPN_RULES) return { ok: false, error: `Можно указать не более ${MAX_NO_TO_VPN_RULES} сайтов.` };
  const domains: string[] = [];
  for (const entry of entries) {
    if (entry.startsWith("https://") || entry.startsWith("http://")) {
      return { ok: false, error: `Укажите сайт без протокола и пути: ${entry}` };
    }
    const suffix = entry.startsWith(".") || entry.startsWith("*.");
    const raw = entry.startsWith("*.") ? entry.slice(2) : entry.startsWith(".") ? entry.slice(1) : entry;
    const domain = normalizeDomain(raw);
    if (!domain) return { ok: false, error: `Некорректный сайт: ${entry}` };
    const normalized = suffix ? `.${domain}` : domain;
    if (!domains.includes(normalized)) domains.push(normalized);
  }
  return { ok: true, domains };
}

export async function loadNoToVpnSettings(): Promise<NoToVpnSettings> {
  try {
    const saved = await AsyncStorage.getItem(NO_TO_VPN_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_NO_TO_VPN_SETTINGS, suffixes: [...DEFAULT_NO_TO_VPN_SETTINGS.suffixes], sites: [...DEFAULT_NO_TO_VPN_SETTINGS.sites] };
    const value: unknown = JSON.parse(saved);
    if (!value || typeof value !== "object") throw new Error("Invalid settings");
    const record = value as { enabled?: unknown; suffixes?: unknown; sites?: unknown };
    if (typeof record.enabled !== "boolean" || !Array.isArray(record.suffixes) || !record.suffixes.every((x) => typeof x === "string") || (record.sites !== undefined && (!Array.isArray(record.sites) || !record.sites.every((x) => typeof x === "string")))) throw new Error("Invalid settings");
    const suffixes = parseDomainSuffixes(record.suffixes.join(" "));
    const sites = parseNoToVpnSites((record.sites ?? []).join(" "));
    if (!suffixes.ok || !sites.ok) throw new Error("Invalid settings");
    return { enabled: record.enabled, suffixes: suffixes.suffixes, sites: sites.domains };
  } catch {
    return { ...DEFAULT_NO_TO_VPN_SETTINGS, suffixes: [...DEFAULT_NO_TO_VPN_SETTINGS.suffixes], sites: [...DEFAULT_NO_TO_VPN_SETTINGS.sites] };
  }
}

export async function saveNoToVpnSettings(settings: NoToVpnSettings): Promise<void> {
  const suffixes = parseDomainSuffixes(settings.suffixes.join(" "));
  const sites = parseNoToVpnSites(settings.sites.join(" "));
  if (!suffixes.ok) throw new Error(suffixes.error);
  if (!sites.ok) throw new Error(sites.error);
  if (new Set([...suffixes.suffixes, ...sites.domains]).size > MAX_NO_TO_VPN_RULES) {
    throw new Error(`Можно сохранить не более ${MAX_NO_TO_VPN_RULES} правил NoToVPN суммарно.`);
  }
  if (settings.enabled && suffixes.suffixes.length + sites.domains.length === 0) throw new Error("Для включения NoToVPN добавьте хотя бы одну зону или сайт.");
  await AsyncStorage.setItem(NO_TO_VPN_STORAGE_KEY, JSON.stringify({ enabled: settings.enabled, suffixes: suffixes.suffixes, sites: sites.domains }));
}
