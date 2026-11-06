# Тестирование

## Обязательные разделы

### 1) Стек тестов и команды

- Раннер: встроенный `node:test` (без Jest/Vitest/Mocha).
- DOM: `jsdom` `^31.0.0`.
- Ассерты: `node:assert/strict`.
- Команды:

```bash
npm ci                  # один раз; ставит jsdom и Capacitor CLI
npm test                # все 15 файлов, 59 тестов
npm run test:rules      # только tests/rules.test.mjs
```

- Покрытие:

```bash
# Инструмент покрытия не настроен; команды нет.
```

- Проверено: `npm test` → 59 pass / 0 fail / 0 skipped, ~6.5 с, Node v24.21.0, Windows, 2026-11-06.

### 2) Раскладка тестов

- Каталог `tests/`, не рядом с исходниками.
- Имя: `<фича>.test.mjs`; общий харнесс — `tests/helpers/boot.mjs`.
- Явный список файлов в `package.json` (`scripts.test`), глоб не используется.
- `boot()` читает реальный `www/index.html`, склеивает все скрипты в порядке `index.html` и выполняет одним `eval` в jsdom, затем отдаёт `window.__gwent` (`tests/helpers/boot.mjs:12-24,72-118`).
- Каждый тест вызывает `boot()` заново — изоляция через новый jsdom-экземпляр, а не через сброс глобального состояния.

### 3) Матрица охвата

| Уровень | Есть? | Что покрыто | Заметки |
|---------|-------|-------------|---------|
| Unit (чистые правила) | да | Чучело и стороны стола, лидеры, лимиты/импорт колоды, Испепеление, погода, пас, берсерк, добор шпиона | `rules.test.mjs` (11), `decoy.test.mjs` (6), `scorch.test.mjs` (3), `weather.test.mjs` (2), `pass.test.mjs` (1), `berserker.test.mjs` (1), `spy-draw.test.mjs` (2) |
| Integration (DOM + движок в jsdom) | да | Поток Чучела с ИИ, панель лидера, импорт/редактор колоды, превью карт, русские строки и ассеты | `decoy-flow.test.mjs` (3), `leader-picker.test.mjs` (7), `deck-import.test.mjs` (5), `ui-preview.test.mjs` (1), `i18n.test.mjs` (5), `ru-assets.test.mjs` (4) |
| Security/static | да | CSP, отсутствие `eval`, cleartext/внешние origin, манифест, утечки секретов, подпись | `security.test.mjs` (7), `signing.test.mjs` (1) |
| E2E на устройстве/эмуляторе | **нет** | — | Android-тесты — сгенерированные заглушки Capacitor (`android/app/src/test/.../ExampleUnitTest.java`, `android/app/src/androidTest/.../ExampleInstrumentedTest.java`), в CI не запускаются |
| Визуальная регрессия | **нет** | — | Скриншоты в `docs/screenshots/` сделаны вручную |
| Сборка APK | да, в CI | `test` + `security` → `apk` и `apk-ru`; проверка подписи `apksigner` против коммитнутого keystore | `.github/workflows/android.yml:68-139,141-197` |

### 4) Моки и изоляция

- Медиа: `HTMLMediaElement.play/pause/load` заглушены, `Audio` создаётся через jsdom (`tests/helpers/boot.mjs:58-68`).
- YouTube: `window.YT.PlayerState`, `YT.Player` и `onYouTubeIframeAPIReady` — заглушки (`tests/helpers/boot.mjs:87-95`).
- Анимации и звук: после загрузки `window.sleep` и `window.translateTo` заменяются на мгновенные, `AudioManager.play/playSFX/init` — на пустышки (`tests/helpers/boot.mjs:109-116`).
- `alert`/`confirm` подменяются настраиваемыми функциями (`tests/helpers/boot.mjs:82-83`).
- Сеть не мокается: jsdom не загружает внешние ресурсы, а игровой код в тестах сеть не использует.
- Частый сбой: если забыть добавить новый скрипт в `SCRIPTS` (`tests/helpers/boot.mjs:12-24`) или в `index.html`, поведение в тесте и в приложении разойдётся.

### 5) Покрытие и сигналы качества

- Инструмент покрытия и порог: **не настроены** (`coverage/` в `.gitignore`, но сборщика нет).
- CI-гейты: `node --check www/*.js`, `npm test`, `npm audit --omit=dev --audit-level=high`, `gitleaks`, сборка APK и сверка SHA-256 подписи (`android.yml:32-35,37-38,56-66,113-125`).
- Известные пробелы: тач-жесты и раскладка (jsdom не считает геометрию), жизненный цикл Android/WebView, реальная загрузка музыки, русская сборка целиком (проверяются только строки/ассеты, не APK), визуальная регрессия.
- Ложных/флаки-тестов в прогоне не наблюдалось; тесты детерминированы, кроме ИИ с `Math.random`, который проверяется по инвариантам, а не по конкретному ходу.

### 6) Доказательства

- `package.json` (`scripts.test`)
- `tests/helpers/boot.mjs:12-24,58-118`
- `tests/*.test.mjs` (15 файлов)
- `.github/workflows/android.yml:18-216`
- `docs/ponytail-audit.md` (почему список тестов явный)
- Локальный прогон `npm test`, 59 pass.
