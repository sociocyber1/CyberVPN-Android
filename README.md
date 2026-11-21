# CyberVPN for Android

<p align="center">
  <img src="docs/images/app-icon.png" alt="CyberVPN app icon" width="112" />
</p>

<p align="center"><strong>A clean, Russian-language Hysteria2 VPN client for Android.</strong><br />Simple controls, configurable DNS, and opt-in domain and site exclusions.</p>

<p align="center">
  <img src="docs/images/app-home-preview.png" alt="CyberVPN home screen preview" width="320" />
</p>

> **Screenshot note:** This is a mobile-sized app preview, not a screenshot from an installed Android build. The Android release build is being corrected and has not been published yet.

## Highlights

- One-tap VPN connection using Hysteria2 configurations from the project’s configured feed.
- Android `VpnService` integration with a native Kotlin bridge and the Hysteria Go core.
- User-selectable DNS upstreams: UDP, TCP, DNS-over-TLS (DoT), and DNS-over-HTTPS (DoH).
- NoToVPN controls with separate domain-zone and individual-site lists, exact host rules, and wildcard/subdomain rules.
- Optional preset of active country-code top-level domains from IANA; it is not enabled automatically.
- Russian-language interface, with no advertisements or subscription prompts.

## Android release

**APK: not available yet.** The first Dashboard release attempt stopped during Kotlin compilation because the native module could not resolve its generated `BuildConfig`. The source fix now enables and imports the library's generated `BuildConfig`; it still needs a fresh successful Dashboard build. The repository currently contains the application source and interface preview, not an installable APK.

## Build environment

This is an Expo / React Native project with a local Expo Android module and Go Hysteria core. The supported release build is produced through the project’s Android build workflow; a browser preview or TypeScript check alone does not verify the Android APK or a live VPN tunnel.

## Repository contents

- `app/`, `components/`, `lib/` — Expo UI, settings, and application logic.
- `modules/cybervpn-vpn/` — Android `VpnService`, Kotlin bridge, and Go DNS/tunnel core.
- `docs/` — integration notes, domain-list sources, and interface preview assets.

## Privacy and routing notes

NoToVPN is DNS-aware IP routing, not a strict per-domain firewall. Shared CDN addresses can temporarily affect routing for other domains, and apps using their own encrypted DNS may not reveal hostnames to the VPN module. Direct DNS for NoToVPN exclusions is intentionally separate from ordinary DNS routed through the VPN tunnel.

## License

GPL-3.0. See [`LICENSE`](LICENSE) and [`THIRD_PARTY.md`](THIRD_PARTY.md) for licensing and third-party notices.
