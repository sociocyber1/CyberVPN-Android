import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

import { DEFAULT_VPN_DNS_SETTINGS, parseVpnDnsServers } from "../lib/dns-settings";

describe("tunneled DNS settings", () => {
  it("uses non-Cloudflare tunneled defaults", () => {
    expect(DEFAULT_VPN_DNS_SETTINGS).toEqual({ transport: "udp", servers: ["8.8.8.8", "8.8.4.4"] });
  });

  it("accepts IPv4 and IPv6 addresses for UDP and TCP", () => {
    expect(parseVpnDnsServers("8.8.8.8, 2001:4860:4860::8888", "udp")).toEqual({
      ok: true,
      servers: ["8.8.8.8", "2001:4860:4860::8888"],
    });
  });

  it("requires numeric endpoints for plain UDP and TCP", () => {
    expect(parseVpnDnsServers("dns.google", "udp").ok).toBe(false);
    expect(parseVpnDnsServers("256.1.1.1", "tcp").ok).toBe(false);
  });

  it("accepts named DoT servers and canonicalizes their case", () => {
    expect(parseVpnDnsServers("DNS.GOOGLE, one.one.one.one", "tls")).toEqual({
      ok: true,
      servers: ["dns.google", "one.one.one.one"],
    });
  });

  it("normalizes DoH hostnames to the DNS query endpoint and rejects insecure URLs", () => {
    expect(parseVpnDnsServers("dns.google, https://resolver.example/dns-query", "https")).toEqual({
      ok: true,
      servers: ["https://dns.google/dns-query", "https://resolver.example/dns-query"],
    });
    expect(parseVpnDnsServers("http://resolver.example/dns-query", "https").ok).toBe(false);
    expect(parseVpnDnsServers("https://user:pass@resolver.example/dns-query", "https").ok).toBe(false);
  });
});
