# Android VPN-модуль CyberVPN

## Архитектура

`modules/cybervpn-vpn` — локальный Expo-модуль только для Android. `CyberVpnModule` открывает системный диалог `VpnService.prepare()`, передаёт выбранную ссылку `hy2://` в foreground-сервис и сообщает JS фактическое состояние из системного хранилища. `CyberVpnService` создаёт TUN через `VpnService.Builder`, применяет IPv4 default route, IPv6 default route при включённом IPv6 и DNS-адреса Hysteria; защищает сокеты ядра через `VpnService.protect(fd)`. Состояние «подключено» устанавливается только после успешного старта клиента Hysteria.

Hysteria URI разбирается нативным парсером Bedlam (`parseHysteriaUri`); исходный URI не передаётся в shell и не сохраняется приложением дополнительно. Конфигурации остаются в существующем локальном кэше репозитория, который уже использует приложение.

## Исходники и версии

- Bedlam Android API: `https://github.com/0xSVV/Bedlam`, commit `3d914e9b131d2d82329f82f121dbc2701a0bca56`.
- Apernet Hysteria upstream: `https://github.com/apernet/hysteria`, pinned commit `c2b181e0b0e72b077e4b0b7297735af14d1f9929`.
- Документация Hysteria по интеграции сторонних приложений: `https://v2.hysteria.network/docs/getting-started/3rd-party-apps/`.
- Лицензия и уведомления: [`../LICENSE`](../LICENSE), [`../THIRD_PARTY.md`](../THIRD_PARTY.md).

## Сборочная среда

Android minSdk поднят до 29. Gradle `preBuild` вызывает `buildHysteriaAar`, который при необходимости загружает Go `1.26.8`, подготавливает pinned Hysteria source tree и выполняет gomobile bind для `arm64-v8a` и `armeabi-v7a`. Ожидаются переменные `ANDROID_HOME` или `ANDROID_SDK_ROOT` и `ANDROID_NDK_HOME` (если NDK не указан явно, скрипт ищет самую новую side-by-side версию в `$ANDROID_HOME/ndk`). AAR является генерируемым файлом и исключён из Git.

## Ограничение подтверждения

Cloud Sandbox не содержит Android SDK/NDK, Go, ADB, эмулятора или подключённого Android-устройства. На этой стадии не выполнены native Gradle build, выдача Android permission в реальном системном диалоге, подключение к рабочему серверу и проверка маршрутизации реального пользовательского трафика. Не заявляйте, что APK уже собран или сквозной туннель подтверждён, пока Android-сборка и устройство не проверены.
