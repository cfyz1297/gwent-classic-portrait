/* Faction leader picker for the deck editor.
   Replaces the generic card carousel with a full-screen list: art, Russian
   name, ability text, and whether the ability fires once or works passively.
   Loaded after portrait-ui.js so DeckMaker already exists. */
(function () {
	var picker = document.createElement("section");
	picker.id = "leader-picker";
	picker.className = "hide";
	picker.setAttribute("role", "dialog");
	picker.setAttribute("aria-modal", "true");
	picker.setAttribute("aria-labelledby", "leader-picker-title");
	picker.innerHTML = ''
		+ '<div id="leader-picker-panel">'
		+ '<header>'
		+ '<h2 id="leader-picker-title">Лидер фракции</h2>'
		+ '<p id="leader-picker-subtitle"></p>'
		+ '</header>'
		+ '<p id="leader-picker-hint">Нажмите на лидера, чтобы взять его в партию. Активная способность срабатывает один раз за игру, пассивная работает сама.</p>'
		+ '<div id="leader-picker-list" role="radiogroup" aria-labelledby="leader-picker-title"></div>'
		+ '<footer><button type="button" id="leader-picker-close">Закрыть</button></footer>'
		+ '</div>';
	document.body.appendChild(picker);

	var lastFocus = null;

	function deckMaker() {
		return typeof dm !== "undefined" ? dm : null;
	}

	function ruName(card) {
		if (window.RU && RU.cards && RU.cards[card.name]) return RU.cards[card.name];
		return card.name;
	}

	function abilityId(card) {
		return (card.ability || "").split(" ")[0] || "";
	}

	function ruAbility(card) {
		var id = abilityId(card);
		var ru = window.RU && RU.abilities && RU.abilities[id];
		if (ru && ru.description) return ru.description;
		var ab = window.ability_dict && ability_dict[id];
		return ab && ab.description ? ab.description : "";
	}

	function isPassive(card) {
		if (window.GwentRules) return GwentRules.isPassiveLeader(ability_dict, card);
		var ab = ability_dict[abilityId(card)];
		return !ab || !ab.activated || ab.activated.length === 0;
	}

	function label(card) {
		return isPassive(card) ? "Пассивная способность" : "Активная способность";
	}

	function build(maker) {
		var list = document.getElementById("leader-picker-list");
		list.textContent = "";
		var current = maker.leader;
		var subtitle = document.getElementById("leader-picker-subtitle");
		var factionName = (window.RU && RU.factions && RU.factions[maker.faction])
			? RU.factions[maker.faction].name
			: maker.faction;
		subtitle.textContent = factionName + " · " + maker.leaders.length + " лидеров";

		maker.leaders.forEach(function (entry) {
			var card = entry.card;
			var button = document.createElement("button");
			button.type = "button";
			button.className = "leader-option";
			button.setAttribute("role", "radio");
			button.setAttribute("aria-checked", current && current.index === entry.index ? "true" : "false");
			button.dataset.index = String(entry.index);

			var art = document.createElement("span");
			art.className = "leader-option-art";
			art.style.backgroundImage = largeURL(card.deck + "_" + card.filename);

			var text = document.createElement("span");
			text.className = "leader-option-text";

			var name = document.createElement("span");
			name.className = "leader-option-name";
			name.textContent = ruName(card);

			var ability = document.createElement("span");
			ability.className = "leader-option-ability";
			ability.textContent = ruAbility(card);

			var badge = document.createElement("span");
			badge.className = "leader-option-badge";
			badge.textContent = label(card);

			text.appendChild(name);
			text.appendChild(ability);
			text.appendChild(badge);
			button.appendChild(art);
			button.appendChild(text);
			button.addEventListener("click", function () {
				apply(maker, entry);
			});
			list.appendChild(button);
		});
	}

	function apply(maker, entry) {
		var card = entry.card;
		if (!maker.leader || maker.leader.index !== entry.index) {
			maker.setLeader(entry.index);
			maker.leader = entry;
			try {
				Settings.getFactionSettings(card.deck).setLeader(entry);
			} catch (err) {
				/* settings are best-effort: the deck still works in this session */
			}
			if (window.AudioManager) AudioManager.playSFX("ui_card_bank");
		}
		updateLeaderLabel();
		markFactionLabel();
		close(true);
		if (window.gwentHint) gwentHint("Лидер: " + ruName(card));
	}

	function updateLeaderLabel() {
		var maker = deckMaker();
		var labelEl = document.getElementById("leader-name-ru");
		if (!maker || !maker.leader || !labelEl) return;
		labelEl.textContent = ruName(maker.leader.card);
	}

	function markFactionLabel() {
		var maker = deckMaker();
		var buttons = document.querySelectorAll("#faction-switch button");
		if (!maker) return;
		for (var i = 0; i < buttons.length; i++)
			buttons[i].classList.toggle("is-on", buttons[i].dataset.faction === maker.faction);
	}

	function open() {
		var maker = deckMaker();
		if (!maker) return;
		if (!maker.leaders || maker.leaders.length === 0) {
			if (window.gwentHint) gwentHint("У этой фракции нет лидеров.");
			return;
		}
		if (isOpen()) return;
		lastFocus = document.activeElement;
		build(maker);
		picker.classList.remove("hide");
		picker.classList.add("open");
		picker.setAttribute("aria-hidden", "false");
		document.body.classList.add("leader-picker-open");
		var selected = picker.querySelector('.leader-option[aria-checked="true"]') || picker.querySelector(".leader-option");
		if (selected) {
			if (typeof selected.scrollIntoView === "function") selected.scrollIntoView({ block: "nearest" });
			selected.focus({ preventScroll: true });
		}
	}

	function close(restoreFocus) {
		if (!isOpen()) return;
		picker.classList.remove("open");
		picker.classList.add("hide");
		picker.setAttribute("aria-hidden", "true");
		document.body.classList.remove("leader-picker-open");
		if (restoreFocus && lastFocus && typeof lastFocus.focus === "function") {
			lastFocus.focus({ preventScroll: true });
		}
		lastFocus = null;
	}

	function isOpen() {
		return picker.classList.contains("open");
	}

	document.getElementById("leader-picker-close").addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		close(true);
	});

	picker.addEventListener("click", function (e) {
		if (e.target === picker) {
			e.preventDefault();
			close(true);
		}
	});

	document.addEventListener("keydown", function (e) {
		if (!isOpen()) return;
		if (e.key === "Escape") {
			e.preventDefault();
			close(true);
			return;
		}
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
		var items = Array.prototype.slice.call(picker.querySelectorAll(".leader-option"));
		if (!items.length) return;
		var at = items.indexOf(document.activeElement);
		e.preventDefault();
		if (e.key === "Home") at = 0;
		else if (e.key === "End") at = items.length - 1;
		else at = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
		items[at].focus();
	});

	// The deck editor's leader tile opens this panel instead of the carousel.
	DeckMaker.prototype.selectLeader = function () {
		open();
	};

	// Keep the Russian leader name in sync after faction switches and imports.
	var origSetFaction = DeckMaker.prototype.setFaction;
	DeckMaker.prototype.setFaction = function () {
		var result = origSetFaction.apply(this, arguments);
		if (result) setTimeout(updateLeaderLabel, 0);
		return result;
	};

	var origSetLeader = DeckMaker.prototype.setLeader;
	DeckMaker.prototype.setLeader = function () {
		var result = origSetLeader.apply(this, arguments);
		setTimeout(updateLeaderLabel, 0);
		return result;
	};

	var leaderBlock = document.getElementById("card-leader");
	if (leaderBlock && !document.getElementById("leader-picker-open")) {
		var openButton = document.createElement("button");
		openButton.id = "leader-picker-open";
		openButton.type = "button";
		openButton.textContent = "Выбрать лидера";
		openButton.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			open();
		});
		leaderBlock.appendChild(openButton);
	}

	setTimeout(updateLeaderLabel, 0);
})();