import { Platform } from "react-native";

export type VpnState = "disconnected" | "connecting" | "connected" | "reconnecting" | "disconnecting" | "error";
export type VpnStatus = { state: VpnState; error?: string };

type NativeVpnModule = {
  connect(configUri: string): Promise<VpnStatus>;
  disconnect(): Promise<VpnStatus>;
  getStatus(): VpnStatus;
};

let nativeModule: Promise<NativeVpnModule> | undefined;

async function getNativeModule(): Promise<NativeVpnModule> {
  if (Platform.OS !== "android") throw new Error("VPN-подключение доступно только в приложении для Android.");
  nativeModule ??= import("@cybervpn/vpn-native").then((module) => module.default);
  return nativeModule;
}

export async function connectVpn(configUri: string): Promise<void> {
  const module = await getNativeModule();
  await module.connect(configUri);
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
