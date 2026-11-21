import { describe, expect, it, vi } from "vitest";
import {
  AUTHOR_EMAIL,
  BANK_CARD_NUMBER,
  ORGANIZATION_NAME,
  PROJECT_YOUTUBE_URL,
  SOCIOCYBERNEERING_VIDEO_URL,
  SUPPORT_DESTINATIONS,
  TELEGRAM_HANDLE,
  copyBankCardNumber,
  openSupportDestination,
} from "../lib/support-info";

describe("CyberVPN support and project details", () => {
  it("keeps the displayed organization and contact details exact", () => {
    expect(ORGANIZATION_NAME).toBe("SocioCyberneering Inc.");
    expect(BANK_CARD_NUMBER).toBe("2202 2081 1034 0461");
    expect(AUTHOR_EMAIL).toBe("sociocyber1@gmail.com");
    expect(TELEGRAM_HANDLE).toBe("@sc_sinus");
  });

  it("maps contact and project actions to the requested destinations", () => {
    expect(SUPPORT_DESTINATIONS.email).toBe("mailto:sociocyber1@gmail.com");
    expect(SUPPORT_DESTINATIONS.telegram).toBe("https://t.me/sc_sinus");
    expect(SUPPORT_DESTINATIONS.project).toBe("https://www.youtube.com/@JacqueFrescoRU");
    expect(PROJECT_YOUTUBE_URL).toBe(SUPPORT_DESTINATIONS.project);
    expect(SOCIOCYBERNEERING_VIDEO_URL).toBe("https://youtu.be/258cx_PsrRA?t=1362");
    expect(SUPPORT_DESTINATIONS.bank).toBe("sberbankonline://");
  });

  it("hands the selected URL to the platform link handler", async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined);

    await openSupportDestination("telegram", openUrl);

    expect(openUrl).toHaveBeenCalledOnce();
    expect(openUrl).toHaveBeenCalledWith("https://t.me/sc_sinus");
  });

  it("copies the exact card number through the supplied clipboard handler", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyBankCardNumber(writeText);

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("2202 2081 1034 0461");
  });
});
