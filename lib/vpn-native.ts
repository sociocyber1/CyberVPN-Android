import { Platform } from "react-native";
import { DEFAULT_VPN_DNS_SETTINGS, type VpnDnsSettings } from "./dns-settings";

export type VpnState = "disconnected" | "connecting" | "connected" | "reconnecting" | "disconnecting" | "error";
export type VpnStatus = { state: VpnState; error?: string };
export type InstalledVpnApp = { packageName: string; label: string };
export type FirewallSettings = {
  enabled: boolean;
  blockAll: boolean;
  blockedPackages: string[];
  excludedPackages: string[];
  lockdownEnabled: boolean;
  alwaysOn: boolean;
  hasSavedConfig: boolean;
};
export type LiveVpnFlow = {
  id: string;
  protocol: "TCP" | "UDP" | "OTHER";
  appUid: number;
  packageName?: string;
  appLabel: string;
  remoteAddress: string;
  remotePort: number;
  lastSeenMillis: number;
};

type NativeVpnModule = {
  connect(configUri: string, bypassDomains: string[], dnsTransport: string, dnsServers: string[]): Promise<VpnStatus>;
  setBypassDomains(domains: string[]): Promise<VpnStatus>;
  disconnect(): Promise<VpnStatus>;
  getStatus(): VpnStatus;
  getInstalledApps(): Promise<InstalledVpnApp[]>;
  getFirewallSettings(): Promise<FirewallSettings>;
  setFirewallSettings(enabled: boolean, blockAll: boolean, blockedPackages: string[]): Promise<FirewallSettings>;
  setExcludedApplications(packages: string[]): Promise<FirewallSettings>;
  openVpnSettings(): Promise<void>;
  getLiveConnections(): Promise<LiveVpnFlow[]>;
};

let nativeModule: Promise<NativeVpnModule> | undefined;

async function getNativeModule(): Promise<NativeVpnModule> {
  if (Platform.OS !== "android") throw new Error("Эта функция доступна только в Android-приложении.");
  nativeModule ??= import("@cybervpn/vpn-native").then((module) => module.default as unknown as NativeVpnModule);
  return nativeModule;
}

export async function connectVpn(configUri: string, bypassDomains: string[] = [], dns: VpnDnsSettings = DEFAULT_VPN_DNS_SETTINGS): Promise<void> {
  const module = await getNativeModule();
  await module.connect(configUri, bypassDomains, dns.transport, dns.servers);
}

export async function updateNoToVpnDomains(domains: string[]): Promise<void> {
  const module = await getNativeModule();
  await module.setBypassDomains(domains);
}

export async function disconnectVpn(): Promise<void> {
  const module = await getNativeModule();
  await module.disconnect();
}

export async function readVpnStatus(): Promise<VpnStatus> {
  if (Platform.OS !== "android") return { state: "disconnected" };
  const module = await getNativeModule();
  return module.getStatus();
}

export async function listInstalledApps(): Promise<InstalledVpnApp[]> {
  const module = await getNativeModule();
  return module.getInstalledApps();
}

export async function readFirewallSettings(): Promise<FirewallSettings> {
  const module = await getNativeModule();
  return module.getFirewallSettings();
}

export async function saveFirewallSettings(settings: Pick<FirewallSettings, "enabled" | "blockAll" | "blockedPackages">): Promise<FirewallSettings> {
  const module = await getNativeModule();
  return module.setFirewallSettings(settings.enabled, settings.blockAll, settings.blockedPackages);
}

export async function saveExcludedApplications(packages: string[]): Promise<FirewallSettings> {
  const module = await getNativeModule();
  return module.setExcludedApplications(packages);
}

export async function openAndroidVpnSettings(): Promise<void> {
  const module = await getNativeModule();
  await module.openVpnSettings();
}

export async function readLiveConnections(): Promise<LiveVpnFlow[]> {
  const module = await getNativeModule();
  return module.getLiveConnections();
}
