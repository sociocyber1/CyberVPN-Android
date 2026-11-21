import { afterEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({ default: asyncStorage }));

import { parseConfigs, refreshConfigs } from "../lib/config-feed";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Hysteria2 README feed", () => {
  it("extracts and deduplicates valid links from README lines", () => {
    const configs = parseConfigs([
      "# Public server list",
      "hy2://user-a@example.com:443?obfs=salamander#Netherlands",
      "hy2://user-a@example.com:443?obfs=salamander#Netherlands",
      "not a config",
      "hy2://missing-port@example.com?obfs=salamander",
    ].join("\n"));

    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({
      name: "Netherlands",
      uri: "hy2://user-a@example.com:443?obfs=salamander#Netherlands",
    });
  });

  it("fetches a fresh README with a simple GET and caches parsed configs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      "hy2://user@example.com:443?obfs=salamander#Test",
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const configs = await refreshConfigs();

    expect(configs).toHaveLength(1);
    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      "cybervpn.configs.v1",
      JSON.stringify(configs),
    );
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(new URL(requestUrl).searchParams.has("_")).toBe(true);
    expect(init?.headers).toBeUndefined();
    expect(init?.method).toBeUndefined();
  });
});
