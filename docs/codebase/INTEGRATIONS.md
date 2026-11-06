# Внешние интеграции

## Обязательные разделы

### 1) Инвентарь интеграций

| Система | Тип | Назначение | Модель авторизации | Критичность | Доказательство |
|---------|-----|------------|--------------------|-------------|----------------|
| YouTube IFrame API (`www.youtube.com/iframe_api`) | Внешний JS + iframe | Фоновая музыка; один ролик `UE9fPWy1_o4`, зациклен | Нет аккаунта и ключа; публичный iframe | низкая (без музыки игра работает) | `www/index.html:310`, `www/gwent.js:1998-2035`, CSP `www/index.html:14` |
| Capacitor bridge (`@capacitor/core`, `@capacitor/android`) | Нативный мост WebView ↔ Android | Запуск веб-слоя в APK, splash screen, FileProvider | Нет | высокая (без него нет APK) | `capacitor.config.json`, `android/app/build.gradle:71-82`, `MainActivity.java:3-5` |
| `localStorage` WebView | Локальное хранилище браузера | Настройки, выбранная фракция, колоды по фракциям, колода соперника | Нет; данные устройства | средняя (без них — значения по умолчанию) | `www/gwent.js:3202-3335` |
| npm registry | Пакетный реестр | Установка Capacitor CLI, jsdom, sharp | Публичный, без токена в репозитории | средняя (только сборка/тесты) | `package.json`, `package-lock.json` |
| GitHub Actions | CI | Тесты, security-скан, сборка двух APK, релиз по тегу | `GITHUB_TOKEN` выдаётся Actions; секретов в репозитории нет | высокая для релизов | `.github/workflows/android.yml:18-216` |
| GitHub Releases | Артефакты | Публикация APK по тегу `v*` | `GITHUB_TOKEN` (`contents: write`) | средняя | `.github/workflows/android.yml:199-216` |

Других сетевых вызовов нет: приложение не имеет сервера, аккаунтов, аналитики и рекламы (`SECURITY.md:3-18`).

### 2) Хранилища данных

| Хранилище | Роль | Слой доступа | Ключевой риск | Доказательство |
|-----------|------|--------------|---------------|----------------|
| `localStorage` | Настройки звука/музыки/уведомлений, последняя фракция, колоды пяти фракций, пользовательская колода соперника | `Settings`/`ToggleOption`/`SavedString`/`SavedDeck` | Повреждённый JSON в ключе роняет конструктор `SavedObject` при старте; очистка данных приложения лечит | `www/gwent.js:3202-3335` (ключи `gc-*`) |
| APK-ассеты | Карты, иконки, звуки, русские лица | Прямые относительные URL (`img/...`, `sfx/...`) | Размер APK; при `cap sync` копия `www/` попадает в APK | `www/gwent.js:3527-3558`, `capacitor.config.json` (`webDir: www`) |
| `android/keystore/gwent-debug.keystore` | Подпись debug-сборок | Gradle `signingConfigs.debug` | Пароль и ключ публичны; любой может собрать APK с той же подписью | `android/app/build.gradle:34-42`, `SECURITY.md:34-40`, `tests/signing.test.mjs` |

Базы данных, кэша, очередей и файлового хранилища, кроме ассетов, нет.

### 3) Секреты и учётные данные

- В runtime секретов нет: приложение локальное, без аккаунтов и API-ключей (`SECURITY.md:3-18`).
- В репозитории **намеренно** лежит debug-keystore с паролем `gwentdebug`; это нужно, чтобы обновления ставились поверх старых сборок. Для Google Play он не годится (`SECURITY.md:34-40`).
- CI использует только автоматический `GITHUB_TOKEN`; отдельных secrets для сборки APK нет (`.github/workflows/android.yml:10-11,204-205`).
- Защита от утечек: `gitleaks detect` в CI и статический тест «в репозитории нет очевидных credentials» (`tests/security.test.mjs`).
- Ротация ключа не описана; смена debug-ключа сломает обновления поверх установленных версий.

### 4) Надёжность и поведение при сбоях

- **Офлайн-first.** Игра не требует сети; без интернета недоступна только музыка. Это заявлено в `README.md:123-124` и проверяется CSP/манифестом.
- **YouTube.** Если iframe API не загрузился, `ui.youtube` остаётся `undefined`; переключатель музыки использует optional chaining и не падает (`www/gwent.js:2026-2035`). Ретраев и таймаутов нет.
- **Импорт колоды.** Ошибки разбора возвращаются списком причин, приложение не падает (`www/rules.js:148-224`).
- **localStorage.** Запись обёрнута в `?.`, но чтение в `SavedObject` делает `JSON.parse` без `try/catch` (`www/gwent.js:3235-3238`) — повреждённое значение может прервать запуск.
- **Сеть.** `usesCleartextTraffic=false`, `allowMixedContent=false`; внешние источники ограничены YouTube в CSP (`AndroidManifest.xml:4-30`, `capacitor.config.json`, `www/index.html:14`).
- **Ретраи/backoff/circuit breaker:** не реализованы и не требуются для локальной игры.

### 5) Наблюдаемость интеграций

- Логирование внешних вызовов: нет; ошибки YouTube не перехватываются и не логируются.
- Метрики/трейсинг: нет.
- Видимость: только консоль WebView (через `chrome://inspect` или logcat) и логи GitHub Actions для сборки/тестов.
- Пробелы: нет способа узнать с устройства, загрузилась ли музыка и почему нет; нет отчёта о падениях на устройстве.

### 6) Доказательства

- `www/index.html:14,310`
- `www/gwent.js:1998-2035,3202-3335,3527-3558`
- `android/app/src/main/AndroidManifest.xml`
- `.github/workflows/android.yml`
- `SECURITY.md`
- `tests/security.test.mjs`, `tests/signing.test.mjs`
