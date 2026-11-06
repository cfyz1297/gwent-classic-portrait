# Структура кодовой базы

## Обязательные разделы

### 1) Карта верхнего уровня

| Путь | Назначение | Доказательство |
|------|------------|----------------|
| `www/` | Единственная копия веб-слоя: игровая логика, UI, локализация, картинки, звук | `AGENTS.md` («`www/` — единственная копия веб-слоя»), `www/index.html` |
| `www/gwent.js` | Ядро: `Controller`, `ControllerAI`, `Player`, `Card`, `Row`, `Board`, `Game`, `UI`, `DeckMaker`, `Settings`, `AudioManager`; 3622 строки | `www/gwent.js:19,467,991,1316,1425,1729,1948,2637,3149,3324` |
| `www/rules.js` | Чистые правила без DOM (Чучело, лидеры, лимиты колоды, импорт JSON); UMD-экспорт для браузера и `require()` в тестах | `www/rules.js:1-8,226-248` |
| `www/abilities.js` | Словарь способностей карт и лидеров (`ability_dict`), включая `decoy`, `spy`, `medic`, `scorch`, `muster` | `www/abilities.js:3,33,91,163,187` |
| `www/factions.js` | Способности пяти фракций | `www/factions.js:3-99` |
| `www/cards.js` | Каталог карт `card_dict` (JSON в строке) | `www/cards.js:1-2` |
| `www/decks.js` | Десять готовых колод `premade_deck` (по две на фракцию) | `www/decks.js:1-12` |
| `www/ru.js` | Русские строки: названия карт, способности, фракции, ряды | `www/ru.js:3-279` |
| `www/portrait.js` | Перестановка DOM под вертикальный экран: док, погода, подписи, обработчик тапа по ряду, `Hand.resize` | `www/portrait.js:14-31,101-201` |
| `www/portrait-ui.js` | Мобильный ввод: удержание/двойной тап, карточный лист, зум руки, муллиган, «пас» удержанием, переключатель фракций | `www/portrait-ui.js:1-9,336,664,920` |
| `www/leader-picker.js` | Полноэкранный выбор лидера вместо карусели; патчит `DeckMaker` | `www/leader-picker.js:6-22,209-247` |
| `www/portrait.css` | Портретный слой поверх upstream-стилей (2429 строк) | `www/portrait.css`, `www/index.html:16` |
| `www/style.css` | Наследованный ландшафтный слой upstream (1570 строк); не удалён, перекрывается портретным | `www/style.css`, `docs/ponytail-audit.md` |
| `assets-ru/` | 214 русских лиц карт (`lg/*.jpg`, ~9.2 МБ) и `manifest.json` сопоставления | `assets-ru/manifest.json`, `docs/russian-build.md:18-46` |
| `scripts/` | `import-ru-cards.mjs` (импорт архива), `stage-ru-www.mjs` (сборка `build/www-ru`), `build-ru-variant.mjs` | `scripts/*.mjs` |
| `tests/` | 15 файлов `*.test.mjs` + `helpers/boot.mjs` (jsdom-загрузка всего приложения) | `package.json` (`scripts.test`), `tests/helpers/boot.mjs` |
| `android/` | Сгенерированный Capacitor-каркас; `MainActivity` пустой, вся логика в WebView | `android/app/src/main/java/com/thinkl/gwentclassic/MainActivity.java:1-5` |
| `docs/` | Правила, разборы, аудиты, скриншоты; эта карта — `docs/codebase/` | `docs/witcher3-rules.md`, `docs/decoy-fix.md`, `docs/rules-audit.md` |
| `.github/workflows/android.yml` | CI: тесты, security, два APK, релиз по тегу | `.github/workflows/android.yml` |
| `build-apk.sh` | Локальная сборка debug APK и копия в `artifacts/` | `build-apk.sh:1-34` |
| `SECURITY.md` | Модель угрозы и отчёт проверки | `SECURITY.md` |
| `AGENTS.md` | Правила работы агента в этом репозитории | `AGENTS.md` |

Всего в git 893 файла; 525 из них — изображения в `www/img` (`lg/` 221, `sm/` 216, иконки).

### 2) Точки входа

- Главная точка входа приложения: `www/index.html`. Он подключает скрипты строго в порядке `ru.js → common.js → cards.js → decks.js → abilities.js → factions.js → rules.js → portrait.js → gwent.js → portrait-ui.js → leader-picker.js` (`www/index.html:299-309`). Порядок важен: `gwent.js` создаёт глобальные синглтоны (`www/gwent.js:3611-3619`), `portrait-ui.js` и `leader-picker.js` патчат их прототипы, поэтому загружаются после.
- Android-точка входа: `MainActivity extends BridgeActivity` (`android/app/src/main/java/com/thinkl/gwentclassic/MainActivity.java:3-5`); Capacitor поднимает WebView с `webDir` из `capacitor.config.json`.
- Вспомогательные entry points: `scripts/import-ru-cards.mjs` (CLI), `scripts/stage-ru-www.mjs` (CLI + экспорт), `scripts/build-ru-variant.mjs` (CLI).
- Тестовая точка входа: `tests/helpers/boot.mjs` — собирает все скрипты в один `eval` в порядке `index.html` и отдаёт `window.__gwent` (`tests/helpers/boot.mjs:12-24,97-107`).

### 3) Границы модулей

| Граница | Что здесь | Чего здесь быть не должно |
|---------|-----------|---------------------------|
| `rules.js` | Чистые правила: сторона стола, цели Чучела, лидеры, статистика колоды, строгий разбор JSON | DOM, `board`, `ui`, `card_dict`-мутации |
| `gwent.js` | Движок, состояние партии, DOM-отрисовка, ИИ, настройки в `localStorage` | Дубли правил Чучела/сторон — обязаны вызывать `GwentRules` |
| `abilities.js` | Обработчики `placed`/`activated` для карт и лидеров | Прямая работа с DOM вне существующих `ui`/`board` API |
| `factions.js` | Хуки старта игры/раунда/конца раунда для фракций | Логика конкретных карт |
| `portrait*.js`, `portrait.css`, `leader-picker.js` | Мобильная адаптация: ввод, раскладка, оверлеи, русские подписи | Изменение правил игры; только вызовы `GwentRules` |
| `cards.js`, `decks.js`, `ru.js` | Данные (карты, готовые колоды, переводы) | Поведение и вычисления |
| `scripts/` | Подготовка ассетов и сборка варианта | Runtime-код приложения |
| `tests/` | Проверка поведения через реальную страницу в jsdom | Правки production-кода |

### 4) Именование и организация

- Файлы веб-слоя — `camelCase`/одно слово (`gwent.js`, `leader-picker.js`, `portrait-ui.js`), данные — существительное (`cards.js`, `decks.js`).
- Классы — `PascalCase` (`Game`, `DeckMaker`, `ControllerAI`); функции и методы — `camelCase`; часть upstream-данных — `snake_case` (`card_dict`, `ability_dict`, `premade_deck`, `player_me`).
- Новые мобильные файлы написаны в ES5-стиле (`var`, IIFE) и не используют модули; upstream-код — ES6-классы с табами. Смешение стилей — сознательное: меньше diff к upstream.
- Пользовательские строки — по-русски, идентификаторы — по-английски (`AGENTS.md`).
- Скрипты и тесты — `kebab-case` (`build-ru-variant.mjs`, `deck-import.test.mjs`).
- Импортов и алиасов нет: все скрипты делят один глобальный скоуп; `rules.js` дополнительно отдаёт UMD-экспорт для Node.

### 5) Доказательства

- `www/index.html:299-309`
- `www/gwent.js:3611-3619`
- `tests/helpers/boot.mjs:12-24`
- `AGENTS.md`
- `docs/ponytail-audit.md` (что удалено и что оставлено осознанно)
