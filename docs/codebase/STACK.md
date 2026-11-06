# Технологический стек

Снимок на коммит `6d2bb66` ветки `main` (2026-11-06). Номера строк — подсказка, искать
по символу. Карта не обновляется автоматически: перед использованием сверяй
`git log -1 --format=%h -- . ':(exclude)docs/codebase'` с `.map-head`.

## Обязательные разделы

### 1) Сводка по рантайму

| Область | Значение | Доказательство |
|---------|----------|----------------|
| Основной язык | JavaScript (классические `<script>`, без модулей и сборщика) + HTML/CSS | `www/index.html:299-309` (порядок скриптов), `www/gwent.js` |
| Язык инструментов | Node.js ESM (`.mjs`) для тестов и сборки русской версии | `tests/helpers/boot.mjs:1-8`, `scripts/build-ru-variant.mjs:1-14` |
| Рантайм приложения | Android WebView внутри Capacitor 7; JS исполняется в WebView, не в Node | `capacitor.config.json` (`webDir: www`), `android/app/src/main/java/com/thinkl/gwentclassic/MainActivity.java` |
| Версия Node | `package.json` требует `>=22.22.2`; CI — Node 24; проверено локально на v24.21.0 | `package.json` (`engines`), `.github/workflows/android.yml:24-27` |
| Java/JDK | JDK 21 в CI; Gradle 8.11.1, Android Gradle Plugin 8.7.2 | `.github/workflows/android.yml:80-83`, `android/gradle/wrapper/gradle-wrapper.properties`, `android/build.gradle:9` |
| Android SDK | compileSdk/targetSdk 35, minSdk 23, build-tools 35.0.0 | `android/variables.gradle:2-4`, `.github/workflows/android.yml:93` |
| Пакетный менеджер | npm + `package-lock.json` (lockfileVersion 3) | `package.json`, `package-lock.json` |
| Система сборки | Capacitor CLI (`cap sync`) + Gradle (`assembleDebug`); отдельного бандлера нет | `build-apk.sh:21-27`, `npm run sync`/`assemble` |

### 2) Продакшн-зависимости и фреймворки

| Зависимость | Версия | Роль в системе | Доказательство |
|-------------|--------|----------------|----------------|
| `@capacitor/core` | `^7.4.3` (lock: 7.6.9) | Мост «веб-слой ↔ Android WebView» | `package.json` (`dependencies`), `package-lock.json` |
| `@capacitor/android` | `^7.4.3` (lock: 7.6.9) | Нативный Android-контейнер | `package.json`, `android/capacitor.settings.gradle` |
| YouTube IFrame API | внешний, без версии | Фоновая музыка через iframe; единственный внешний контент | `www/index.html:310` (`iframe_api`), `www/index.html:14` (CSP), `www/gwent.js:3600` (`onYouTubeIframeAPIReady`) |
| `androidx.*` / `capacitor-android` | см. `variables.gradle` | Каркас Activity, splash screen, FileProvider | `android/app/build.gradle:71-82`, `android/variables.gradle` |

Других runtime-библиотек нет: игровая логика, DOM и звук — ванильный JS и `<audio>`.

### 3) Инструменты разработки

| Инструмент | Назначение | Доказательство |
|------------|------------|----------------|
| `node:test` (встроенный) | Тест-раннер, 15 файлов, 59 тестов | `package.json` (`scripts.test`), вывод `npm test` |
| `jsdom` `^31.0.0` | Загрузка реального `index.html` и всех скриптов в тестах | `tests/helpers/boot.mjs:72-107` |
| `sharp` `^0.35.5` | Одноразовый импорт русских лиц карт; в рантайм APK не попадает | `scripts/import-ru-cards.mjs:13`, `docs/ponytail-audit.md` |
| `@capacitor/cli` | `cap sync android` | `package.json` (`devDependencies`, `scripts.sync`) |
| Синтаксическая проверка | `node --check www/*.js` в CI; отдельного линтера/форматтера нет | `.github/workflows/android.yml:32-35` |
| GitHub Actions | Тесты, security-скан, две сборки APK, релиз по тегу | `.github/workflows/android.yml:18-216` |

### 4) Ключевые команды

```bash
npm ci                                  # зависимости (jsdom, Capacitor CLI, sharp)
npm test                                # 59 тестов, ~6.5 с на Windows/Node 24
node --check www/gwent.js               # та же проверка, что в CI
npx cap sync android                    # копирует www/ в android/app/src/main/assets/public/
./build-apk.sh                          # debug APK; нужны ANDROID_HOME и JDK 21+
node scripts/build-ru-variant.mjs        # отдельный APK com.thinkl.gwentclassic.ru
```

### 5) Окружение и конфигурация

- Конфиги: `capacitor.config.json`, `android/variables.gradle`, `android/app/build.gradle`, `package.json`.
- Переменные окружения: `ANDROID_HOME` (обязательна для `build-apk.sh` и Gradle), `ANDROID_SDK_ROOT` (выставляется скриптом). Секретов в env нет.
- Ограничения: сборка возможна только с Android SDK 35 и JDK 21+; npm-пакеты ставятся из публичного registry; сеть нужна только для музыки YouTube, и без неё партия играется.
- Идентификаторы сборки: `com.thinkl.gwentclassic` (обычная) и `com.thinkl.gwentclassic.ru` (русская); `versionName` 1.4.1, `versionCode` 8.

### 6) Доказательства

- `package.json`, `package-lock.json`
- `build-apk.sh`, `capacitor.config.json`
- `android/app/build.gradle`, `android/variables.gradle`, `android/app/src/main/AndroidManifest.xml`
- `.github/workflows/android.yml`
- `tests/helpers/boot.mjs`
- Локальный прогон `npm test`: 59 pass / 0 fail, Node v24.21.0, 2026-11-06.
