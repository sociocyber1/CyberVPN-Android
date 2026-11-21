import { requireNativeModule } from "expo-modules-core";

export type NativeVpnState = {
  state: "disconnected" | "connecting" | "connected" | "reconnecting" | "disconnecting" | "error";
  error?: string;
};

type CyberVpnNativeModule = {
  connect(configUri: string, bypassDomains: string[], dnsTransport: string, dnsServers: string[]): Promise<NativeVpnState>;
  setBypassDomains(domains: string[]): Promise<NativeVpnState>;
  disconnect(): Promise<NativeVpnState>;
  getStatus(): NativeVpnState;
};

export default requireNativeModule<CyberVpnNativeModule>("CyberVpn");
