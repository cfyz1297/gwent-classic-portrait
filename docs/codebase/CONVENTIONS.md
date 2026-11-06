# Соглашения кода

## Обязательные разделы

### 1) Правила именования

| Элемент | Правило | Пример | Доказательство |
|---------|---------|--------|----------------|
| Файлы веб-слоя | Одно слово или `camelCase`; данные — существительное | `gwent.js`, `leader-picker.js`, `portrait-ui.js`, `cards.js` | `www/` |
| Файлы скриптов/тестов | `kebab-case` | `build-ru-variant.mjs`, `deck-import.test.mjs` | `scripts/`, `tests/` |
| Классы | `PascalCase` | `Game`, `DeckMaker`, `ControllerAI` | `www/gwent.js:19,1425,2637` |
| Функции/методы | `camelCase` | `startGame`, `isDecoyTarget`, `resolveDecoy` | `www/gwent.js:1504,2191`; `www/rules.js:59` |
| Глобальные данные upstream | `snake_case` | `card_dict`, `ability_dict`, `premade_deck`, `player_me` | `www/cards.js:1`, `www/abilities.js:3`, `www/decks.js:1`, `www/gwent.js:3615` |
| Идентификаторы способностей | Короткие строки, иногда с суффиксом ряда | `decoy`, `spy`, `scorch_c/r/s`, `emhyr_whiteflame` | `www/abilities.js:33,91,125-138,353` |
| CSS-классы | `kebab-case`, состояние — отдельный класс | `row-selectable`, `noclick`, `side-passed`, `is-on` | `www/gwent.js:533-539`, `www/portrait.css` |
| Пользовательские строки | Русский текст; идентификаторы — английские | `"Чучелом можно заменить только..."` | `AGENTS.md`, `www/portrait.js:157-160` |

### 2) Форматирование и линтинг

- Форматтер **не настроен**: нет `.prettierrc*`, `.editorconfig`, ESLint.
- Линтер **не настроен**. Единственная автоматическая проверка синтаксиса — `node --check www/*.js` в CI (`.github/workflows/android.yml:32-35`).
- Фактический стиль неоднороден: upstream-файлы (`gwent.js`, `style.css`) используют табы и местами опускают точки с запятой; новые мобильные файлы (`portrait.js`, `portrait-ui.js`, `leader-picker.js`) — табы, `var`, IIFE, точки с запятой. Правило: **сохранять стиль правимого файла**, не переформатировать чужие файлы целиком.
- `.gitattributes` фиксирует LF для текста и `binary` для картинок/звука/keystore (`.gitattributes`).
- Запуск проверок: `npm test`, `node --check www/gwent.js`.

### 3) Импорты и модули

- Модулей нет: все скрипты — классические `<script>` в одном глобальном скоупе. Порядок загрузки задан в `www/index.html:299-309` и продублирован в тестовом харнессе (`tests/helpers/boot.mjs:12-24`).
- Новый файл нужно подключить в **обоих** местах, иначе он не попадёт ни в приложение, ни в тесты.
- `www/rules.js` — единственный файл с UMD-экспортом: `window.GwentRules` для браузера и `module.exports` для `node:test` (`www/rules.js:4-8`).
- Правила игры (Чучело, стороны стола, лидеры, лимиты колоды, импорт JSON) обязаны жить в `rules.js`; дублировать проверки в `gwent.js`/`portrait*.js` нельзя (`AGENTS.md`).
- Внешние ассеты — только внутри `www/` (или `assets-ru/` для русской сборки); новые внешние домены требуют правки CSP и теста `tests/security.test.mjs` (`AGENTS.md`).

### 4) Ошибки, подсказки и логирование

- Импорт колоды: `GwentRules.parseDeckJSON` **никогда не бросает исключение**, возвращает `{ok, deck, reasons}`; ошибки показываются списком в UI (`www/rules.js:145-224`, `tests/deck-import.test.mjs`).
- Пользовательские тупики объясняются одной строкой через `window.gwentHint` (роль `status`, `aria-live="polite"`), например нелегальный тап Чучелом (`www/portrait-ui.js:11-29`, `www/portrait.js:155-162`).
- Сохранение настроек — best-effort: в `leader-picker.js` вызов `Settings...setLeader` обёрнут в `try/catch`, чтобы сбой `localStorage` не ломал текущую партию (`www/leader-picker.js:112-116`).
- Логирования и телеметрии нет: только `console` браузера и логи GitHub Actions. Секреты не логируются, потому что их нет в runtime.
- Русские тексты для интерфейса берутся из `RU` (`www/ru.js`) или пишутся рядом с компонентом; английские описания способностей остаются в `abilities.js` для движка/отладки.

### 5) Соглашения тестирования

- Любая правка поведения = тест в `tests/` и зелёный `npm test` (`AGENTS.md`).
- Файл теста называется по фиче: `decoy.test.mjs`, `scorch.test.mjs`, `weather.test.mjs`.
- Список тестов **явный** в `package.json` (`scripts.test`), не глоб; новый файл нужно туда добавить. Причина — переносимость между Node 20/24 и Windows/Linux (`docs/ponytail-audit.md`).
- Тесты загружают реальную страницу через `tests/helpers/boot.mjs`, а не импортируют функции по отдельности.
- Эталон ожидаемого поведения — `docs/witcher3-rules.md`; для каждого правила в `docs/rules-audit.md` указан держащий его тест.

### 6) Коммиты

История следует Conventional Commits без строгого скоупа: `feat:`, `fix:`, `docs:`, `ci:`; иногда со скоупом — `fix(ci):`. Примеры: `feat: Russian APK variant with localized card faces`, `fix: Decoy tap on freshly placed spies, art-only preview, stable signing`.

### 7) Доказательства

- `www/index.html:299-309`
- `tests/helpers/boot.mjs:12-24`
- `package.json` (`scripts.test`)
- `www/rules.js:145-224`
- `www/portrait-ui.js:11-29`
- `AGENTS.md`
- `git log -12 --pretty=format:%s`
