export const ORGANIZATION_NAME = "SocioCyberneering Inc.";
export const BANK_CARD_NUMBER = "2202 2081 1034 0461";
export const AUTHOR_EMAIL = "sociocyber1@gmail.com";
export const TELEGRAM_HANDLE = "@sc_sinus";
export const PROJECT_YOUTUBE_URL = "https://www.youtube.com/@JacqueFrescoRU";
export const SOCIOCYBERNEERING_VIDEO_URL = "https://youtu.be/258cx_PsrRA?t=1362";

export const SUPPORT_DESTINATIONS = {
  email: `mailto:${AUTHOR_EMAIL}`,
  telegram: "https://t.me/sc_sinus",
  bank: "sberbankonline://",
  project: PROJECT_YOUTUBE_URL,
} as const;

export type SupportDestination = keyof typeof SUPPORT_DESTINATIONS;

export async function openSupportDestination(
  destination: SupportDestination,
  openUrl: (url: string) => Promise<unknown>,
): Promise<void> {
  await openUrl(SUPPORT_DESTINATIONS[destination]);
}

export async function copyBankCardNumber(
  writeText: (text: string) => Promise<unknown>,
): Promise<void> {
  await writeText(BANK_CARD_NUMBER);
}
