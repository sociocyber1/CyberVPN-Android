import { Platform } from "react-native";
import { DEFAULT_VPN_DNS_SETTINGS, type VpnDnsSettings } from "./dns-settings";

export type VpnState = "disconnected" | "connecting" | "connected" | "reconnecting" | "disconnecting" | "error";
export type VpnStatus = { state: VpnState; error?: string };

type NativeVpnModule = {
  connect(configUri: string, bypassDomains: string[], dnsTransport: string, dnsServers: string[]): Promise<VpnStatus>;
  setBypassDomains(domains: string[]): Promise<VpnStatus>;
  disconnect(): Promise<VpnStatus>;
  getStatus(): VpnStatus;
};

let nativeModule: Promise<NativeVpnModule> | undefined;

async function getNativeModule(): Promise<NativeVpnModule> {
  if (Platform.OS !== "android") throw new Error("VPN-подключение доступно только в приложении для Android.");
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
