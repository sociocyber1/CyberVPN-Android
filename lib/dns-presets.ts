import type { VpnDnsTransport } from "./dns-settings";

export type PublicDnsPreset = {
  id: string;
  name: string;
  detail: string;
  servers: Partial<Record<VpnDnsTransport, string[]>>;
};

// Public resolver endpoints documented by Cloudflare, Google Public DNS, and Quad9.
// Sources: https://developers.cloudflare.com/1.1.1.1/ip-addresses/
// https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-tls/
// https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/
// https://developers.google.com/speed/public-dns/docs/using
// https://quad9.net/service/service-addresses-and-features/
export const PUBLIC_DNS_PRESETS: PublicDnsPreset[] = [
  {
    id: "cloudflare",
    name: "Cloudflare 1.1.1.1",
    detail: "Без фильтрации контента",
    servers: {
      udp: ["1.1.1.1", "1.0.0.1"], tcp: ["1.1.1.1", "1.0.0.1"],
      tls: ["one.one.one.one"], https: ["https://cloudflare-dns.com/dns-query"],
    },
  },
  {
    id: "google",
    name: "Google Public DNS",
    detail: "Публичный рекурсивный DNS",
    servers: {
      udp: ["8.8.8.8", "8.8.4.4"], tcp: ["8.8.8.8", "8.8.4.4"],
      tls: ["dns.google"], https: ["https://dns.google/dns-query"],
    },
  },
  {
    id: "quad9",
    name: "Quad9 Secure",
    detail: "Блокирует известные вредоносные домены",
    servers: {
      udp: ["9.9.9.9", "149.112.112.112"], tcp: ["9.9.9.9", "149.112.112.112"],
      tls: ["dns.quad9.net"], https: ["https://dns.quad9.net/dns-query"],
    },
  },
];
