# Архитектура

## Обязательные разделы

### 1) Архитектурный стиль

- **Слоистый монолит на классических скриптах.** Одна страница, общий глобальный скоуп, без модулей, бандлера и фреймворка. Классы движка, данные карт и мобильные оверлеи живут в отдельных файлах, но связываются через глобальные синглтоны (`www/gwent.js:3611-3619`).
- **Данные отделены от поведения.** `cards.js`/`decks.js`/`ru.js` — данные; `abilities.js`/`factions.js` — обработчики; `rules.js` — чистые предикаты; `gwent.js` — движок и DOM.
- **Мобильный слой — декоратор.** `portrait.js`, `portrait-ui.js`, `leader-picker.js` и `portrait.css` не меняют движок, а переставляют DOM, перехватывают ввод и патчат прототипы (`www/portrait.js:190-201`, `www/portrait-ui.js:619-661`, `www/leader-picker.js:209-233`).
- Главные ограничения: порядок загрузки скриптов критичен; всё состояние мутабельно и глобально; асинхронные эффекты координируются массивами колбэков и фиксированными `sleep`.

### 2) Поток системы

```text
index.html
  -> загрузка скриптов в фиксированном порядке (ru, common, cards, decks, abilities, factions, rules, portrait, gwent, portrait-ui, leader-picker)
  -> gwent.js создаёт синглтоны ui/board/weather/game/dm и читает Settings из localStorage
  -> DeckMaker собирает колоду фракции из card_dict + premade_deck, лидер выбирается leader-picker.js
  -> Game.startGame: initPlayers (лидеры + фракции) -> раздача 10+10 -> муллиган до 2 карт -> startRound
  -> ход: UI.selectCard/selectRow или жесты portrait-ui -> ability_dict[].placed -> Row.updateState/updateScore
  -> Game.endRound: подсчёт силы, ничья = победа Нильфгаарда, потеря гема, конец партии/следующий раунд
```

Ключевые точки: `Game.startGame` (`www/gwent.js:1504-1520`), `Game.endRound` (`www/gwent.js:1596-1604`), `UI.selectCard` (`www/gwent.js:2076-2105`), `UI.resolveDecoy` (`www/gwent.js:2191-2198`), `Row.addCard` (`www/gwent.js:1018-1036`), `Row.calcCardScore` (`www/gwent.js:1165`), `ControllerAI.playCard` (`www/gwent.js:155`).

### 3) Ответственность слоёв

| Слой / модуль | Владеет | Не должен владеть | Доказательство |
|---------------|---------|-------------------|----------------|
| `rules.js` | Предикаты правил: сторона стола, цель Чучела, лидеры, лимиты колоды, разбор импортируемого JSON | DOM, состояние партии, глобальные синглтоны | `www/rules.js:44-85,111-135,148-224` |
| `gwent.js` — модель | `Player`, `Card`, `Row`, `Board`, `Weather`, `Game`, счёт, раунды, ИИ | Мобильная раскладка, русские подписи | `www/gwent.js:19,467,991,1243,1316,1425,1729` |
| `gwent.js` — UI | `UI`, `Carousel`, `Popup`, `DeckMaker`, `AudioManager`, `Settings`; DOM и `localStorage` | Чистые правила (делегирует в `GwentRules`) | `www/gwent.js:1948,2433,2587,2637,3149,3324` |
| `abilities.js` | Побочные эффекты карт/лидеров через `placed`/`activated` | Отрисовка вне `board`/`ui` API | `www/abilities.js:3-556` |
| `factions.js` | Хуки фракций на старт игры/раунда/конец раунда | Логика отдельных карт | `www/factions.js:3-99` |
| `portrait.js` | Перестановка DOM, док, подписи, тап по ряду, `Hand.resize` | Правила игры | `www/portrait.js:14-31,101-201` |
| `portrait-ui.js` | Жесты, карточный лист, зум руки, муллиган, пас удержанием, переключатель фракций, валидация колоды перед стартом | Расчёт силы и правил | `www/portrait-ui.js:4-9,336-400,619-661,664-952` |
| `leader-picker.js` | Полноэкранный диалог выбора лидера, сохранение выбора | Механика способностей лидера | `www/leader-picker.js:6-22,107-123,209-247` |
| `scripts/` | Импорт русских лиц, staging `build/www-ru`, сборка варианта APK | Runtime-логика | `scripts/import-ru-cards.mjs`, `scripts/stage-ru-www.mjs`, `scripts/build-ru-variant.mjs` |
| `tests/` | Проверка поведения на реальной странице в jsdom | Production-код | `tests/helpers/boot.mjs:72-118` |

### 4) Повторно используемые паттерны

| Паттерн | Где | Зачем |
|---------|-----|-------|
| Глобальные синглтоны как composition root | `www/gwent.js:3611-3619` | Классические скрипты не имеют модулей; все слои обращаются к `ui`, `board`, `game` |
| Очереди хуков на массивах | `Game.reset/startGame` (`gameStart`, `roundStart`, `roundEnd`, `turnStart`, `turnEnd`) — `www/gwent.js:1443-1447,1509,1548,1569,1578` | Лидеры и фракции подписываются на события, не меняя `Game` |
| Данные-словари | `card_dict` (`www/cards.js`), `ability_dict` (`www/abilities.js`), `factions` (`www/factions.js`) | Карты и способности описываются данными, а не ветвлениями |
| Стратегия для игрока и ИИ | `Controller` и `ControllerAI` (`www/gwent.js:16,19`) | Один интерфейс хода для человека и компьютера |
| Декоратор через prototype patch | `portrait.js` (`Hand.resize`), `portrait-ui.js` (`DeckMaker.startNewGame`, `UI.setDescription`), `leader-picker.js` (`DeckMaker.selectLeader/setFaction/loadPlayerDeck/setLeader`) | Мобильные правки не трогают upstream-код |
| UMD-экспорт | `www/rules.js:4-8` | Одни и те же правила работают в браузере (`window.GwentRules`) и в `node:test` (`require`) |
| Полностраничный jsdom-харнесс | `tests/helpers/boot.mjs:72-118` | Тесты видят реальный DOM и порядок скриптов, а не изолированные функции |

### 5) Известные архитектурные риски

- **Скрытые связи через порядок загрузки.** `portrait-ui.js` и `leader-picker.js` патчат прототипы `DeckMaker`/`UI`; если поменять порядок в `index.html` или загрузить файл отдельно, правки молча не применятся (`www/index.html:299-309`, `www/leader-picker.js:4`).
- **Глобальное мутабельное состояние.** `card_dict`, `board`, `game`, `player_me/op` доступны всем; тест или эффект может изменить состояние другого теста/экрана. Изоляция достигается только новым jsdom-экземпляром на тест.
- **Асинхронность на фиксированных задержках.** `Player.playCardAction` ждёт 1000 мс, `Row.addCard` — 600 мс, активация лидера — 1500 мс (`www/gwent.js:582,1034,620`). В тестах `sleep` заглушен, но на устройстве порядок эффектов держится на времени, а не на событиях.
- **Дублирование UI-слоёв.** Наследованный `style.css` (1570 строк) и портретный `portrait.css` (2429 строк) описывают одни элементы; приоритет зависит от порядка подключения (`www/index.html:15-16`).
- **Монолитный `gwent.js`.** 3622 строки, движок, DOM, ИИ и настройки в одном файле; любая правка требует прогона всего набора тестов.
- **Единственный экземпляр партии.** `Game` не параметризован; тесты вынуждены загружать всю страницу заново (`tests/helpers/boot.mjs:72-107`).

### 6) Доказательства

- `www/index.html:299-309`
- `www/gwent.js:1425-1604,1948-2198,3611-3619`
- `www/rules.js:44-85,148-224`
- `www/portrait.js:101-201`, `www/portrait-ui.js:619-661,920-952`
- `tests/helpers/boot.mjs:72-118`
- `docs/decoy-fix.md`, `docs/rules-audit.md`
