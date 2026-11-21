import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

import { parseDomainSuffixes, parseNoToVpnSites, saveNoToVpnSettings } from "../lib/no-to-vpn";

describe("NoToVPN domain suffixes", () => {
  it("normalizes the confirmed local suffix examples and removes duplicates", () => {
    expect(parseDomainSuffixes(".ru, .kz; .eu\n*.RU")).toEqual({
      ok: true,
      suffixes: [".ru", ".kz", ".eu"],
    });
  });

  it("converts internationalized domains to IDNA ASCII", () => {
    expect(parseDomainSuffixes(".рф, bücher.example")).toEqual({
      ok: true,
      suffixes: [".xn--p1ai", ".xn--bcher-kva.example"],
    });
  });

  it("allows an empty list when the feature is disabled", () => {
    expect(parseDomainSuffixes("  , ;\n ")).toEqual({ ok: true, suffixes: [] });
  });

  it.each([".", "example.ru/path", "bad..domain", "192.0.2.4", "*.", "-bad.example"]) (
    "rejects malformed suffix %s",
    (input) => {
      expect(parseDomainSuffixes(input).ok).toBe(false);
    },
  );
});

describe("NoToVPN exact site list", () => {
  it("keeps exact host entries separate from explicit subdomain suffixes", () => {
    expect(parseNoToVpnSites("gosuslugi.ru, *.nalog.gov.ru, .government.ru")).toEqual({
      ok: true,
      domains: ["gosuslugi.ru", ".nalog.gov.ru", ".government.ru"],
    });
  });

  it("normalizes internationalized hostnames and rejects URLs/paths", () => {
    expect(parseNoToVpnSites("пример.рф")).toEqual({ ok: true, domains: ["xn--e1afmkfd.xn--p1ai"] });
    expect(parseNoToVpnSites("https://example.ru").ok).toBe(false);
    expect(parseNoToVpnSites("example.ru/path").ok).toBe(false);
  });
});

describe("NoToVPN combined Android rule limit", () => {
  it("rejects settings whose zone and site lists exceed 400 rules in total", async () => {
    const suffixes = Array.from({ length: 201 }, (_, index) => `.zone${index}.example`);
    const sites = Array.from({ length: 200 }, (_, index) => `site${index}.example`);
    await expect(saveNoToVpnSettings({ enabled: false, suffixes, sites })).rejects.toThrow("400 правил NoToVPN суммарно");
  });
});
