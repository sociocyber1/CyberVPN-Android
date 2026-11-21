# Сторонние компоненты Android VPN

CyberVPN включает исходный код Android-библиотеки из проекта [Bedlam](https://github.com/0xSVV/Bedlam), лицензированного по GNU GPL-3.0. Использованная ревизия Bedlam: `3d914e9b131d2d82329f82f121dbc2701a0bca56`. Соответствующий текст лицензии находится в корневом файле [`LICENSE`](LICENSE). Часть Android-адаптации CyberVPN изменена для службы `VpnService` и интерфейса Expo.

Go-ядро Hysteria2 предоставляется проектом [Apernet Hysteria](https://github.com/apernet/hysteria) и зафиксировано в `modules/cybervpn-vpn/android/hysteria-upstream-commit.txt` (commit `c2b181e0b0e72b077e4b0b7297735af14d1f9929`). Код-обёртка gomobile взят из Bedlam `hysteria/golib`. Официальная документация Hysteria для сторонних приложений: [Third-party apps](https://v2.hysteria.network/docs/getting-started/3rd-party-apps/). Архив ядра и его файл LICENSE загружаются Android-сборкой из этого commit; перед распространением APK необходимо сохранить все применимые уведомления исходной лицензии.

Пользователь согласился распространять CyberVPN под GPL-3.0 при включении компонентов Bedlam. Исходный код приложения и производные изменения должны сопровождаться лицензией GPL-3.0 и полными применимыми уведомлениями. Это техническое указание, не юридическое заключение.

## Сборка Android

Gradle-задача `buildHysteriaAar` запускает `android/build-hysteria-aar.sh`: она скачивает Go `1.26.8` при отсутствии локального инструментария, получает ядро Hysteria по указанному commit, ставит зафиксированные `gomobile`/`gobind` из `golang.org/x/mobile`, затем создаёт `libs/golib.aar` для `arm64-v8a` и `armeabi-v7a`. Требуются JDK 21, Android SDK и установленный Android NDK; минимальная версия Android приложения — API 29.

В текущей рабочей среде отсутствуют Go, Android SDK/NDK и эмулятор/устройство. Поэтому исходный код интеграции создан, но нативная сборка APK и сквозная проверка трафика на Android здесь не подтверждены. Это ограничение не следует трактовать как успешно протестированный рабочий APK.
