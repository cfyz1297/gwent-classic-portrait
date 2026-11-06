/* Portrait extras: saved-deck editor labels, hold-to-read sheet, large hand.
   Loaded after gwent.js so Card / DeckMaker already exist.
   A short tap inspects a hand card. A second tap within 350 ms plays it. */
(function () {
	var HOLD_MS = 450;
	var DOUBLE_MS = 350;
	var TAP_SLOP = 14;
	var SCROLL_SLOP = 8;
	var PASS_HOLD_MS = 2000;

	/* Transient one-line hint for illegal decoy taps and similar dead ends. */
	var hintEl = document.createElement("div");
	hintEl.id = "gwent-hint";
	hintEl.className = "hide";
	hintEl.setAttribute("role", "status");
	hintEl.setAttribute("aria-live", "polite");
	document.body.appendChild(hintEl);
	var hintTimer = null;
	function showHint(text) {
		if (!text) return;
		hintEl.textContent = text;
		hintEl.classList.remove("hide");
		if (hintTimer) clearTimeout(hintTimer);
		hintTimer = setTimeout(function () {
			hintEl.classList.add("hide");
			hintTimer = null;
		}, 2600);
	}
	window.gwentHint = showHint;

	function rowName(row) {
		if (RU.rows[row]) return RU.rows[row];
		return "—";
	}

	function strengthText(row, power) {
		if (row !== "close" && row !== "ranged" && row !== "siege" && row !== "agile") return "—";
		if (power === null || power === undefined || isNaN(power)) return "—";
		return String(power);
	}

	function abilityText(abilities, hero, row) {
		var parts = [];
		var seen = {};
		function push(text) {
			if (!text || seen[text]) return;
			seen[text] = true;
			parts.push(text);
		}
		if (row === "agile" && RU.abilities.agile) push(RU.abilities.agile.description);
		(abilities || []).forEach(function (id) {
			if (!id || id === "hero") return;
			var ab = RU.abilities[id];
			if (ab && ab.description) push(ab.description);
		});
		if (hero && RU.abilities.hero) push(RU.abilities.hero.description);
		if (!parts.length) return RU.noAbility;
		return parts.join("\n");
	}

	function fromRaw(data) {
		if (!data) return null;
		var parts = (data.ability || "").split(" ").filter(Boolean);
		var hero = parts[0] === "hero";
		if (hero) parts = parts.slice(1);
		var row = data.row;
		if (data.deck === "weather") row = "weather";
		else if (data.deck === "special") row = "special";
		var power = data.strength === "" || data.strength === undefined ? NaN : Number(data.strength);
		return {
			name: ruCardName(data.name),
			strength: strengthText(row, power),
			row: rowName(row),
			ability: abilityText(parts, hero, data.row),
			art: largeURL(data.deck + "_" + data.filename)
		};
	}

	function fromFactionCard(card) {
		var id = (card.abilities && card.abilities[0]) || card.filename;
		var fac = RU.factions[id];
		return {
			name: fac ? fac.name : (card.desc_name || id || "Фракция"),
			strength: "—",
			row: "—",
			ability: fac ? fac.description : (card.desc || RU.noAbility),
			art: iconURL("deck_shield_" + id)
		};
	}

	function fromCard(card) {
		if (!card) return null;
		if (card.faction === "faction") return fromFactionCard(card);
		var row = card.row;
		if (card.faction === "weather") row = "weather";
		else if (card.faction === "special") row = "special";
		var power = card.power;
		if (power === null || power === undefined || isNaN(power)) power = card.basePower;
		var art = "";
		if (card.faction && card.filename) art = largeURL(card.faction + "_" + card.filename);
		return {
			name: ruCardName(card.name),
			strength: strengthText(row, power),
			row: rowName(row),
			ability: abilityText(card.abilities || [], !!card.hero, row),
			art: art
		};
	}

	function deckMaker() {
		return typeof dm !== "undefined" ? dm : null;
	}

	function infoFromDeckElem(el) {
		var maker = deckMaker();
		if (!maker) return null;
		var pools = [maker.bank, maker.deck];
		for (var p = 0; p < pools.length; p++) {
			var list = pools[p] || [];
			for (var i = 0; i < list.length; i++) {
				if (list[i].elem === el) return fromRaw(card_dict[list[i].index]);
			}
		}
		return null;
	}

	function infoFromCarousel(el) {
		if (typeof Carousel === "undefined" || !Carousel.curr || !Carousel.curr.previews) return null;
		var previews = Carousel.curr.previews;
		var index = -1;
		for (var i = 0; i < previews.length; i++) {
			if (previews[i] === el) index = i;
		}
		if (index < 0) return null;
		var curr = Carousel.curr.index - 2 + index;
		if (curr < 0 || curr >= Carousel.curr.indices.length) return null;
		var card = Carousel.curr.container.cards[Carousel.curr.indices[curr]];
		if (!card) return null;
		if (card.faction === "faction" || (!card.name && card.desc_name)) return fromFactionCard(card);
		return fromCard(card);
	}

	function cardInfoFromEvent(e) {
		var target = e.target;
		if (!target || !target.closest) return null;
		if (target.closest("#card-sheet, #pass-button, #hand-zoom-open, #hand-zoom-close, .settings-button, #settings-gear, #settings-menu, #exit-game, #start-game, .deck-options, #faction-switch, #mulligan-actions"))
			return null;

		var carouselCard = target.closest("#carousel .card-lg");
		if (carouselCard && !carouselCard.classList.contains("hide")) return infoFromCarousel(carouselCard);

		var editorCard = target.closest("#card-bank .card-lg, #card-deck .card-lg");
		if (editorCard && !editorCard.classList.contains("empty") && !editorCard.classList.contains("hide"))
			return infoFromDeckElem(editorCard);

		if (target.closest("#card-leader")) {
			var maker = deckMaker();
			if (maker && maker.leader && maker.leader.card) return fromRaw(maker.leader.card);
			return null;
		}

		var leader = target.closest("#leader-me, #leader-op");
		if (leader) {
			if (leader.id === "leader-me" && window.player_me && player_me.leader) return fromCard(player_me.leader);
			if (leader.id === "leader-op" && window.player_op && player_op.leader) return fromCard(player_op.leader);
			return null;
		}

		var cardEl = target.closest(".card");
		if (cardEl && cardEl._gwentCard) return fromCard(cardEl._gwentCard);

		var grave = target.closest("#grave-me, #grave-op");
		if (grave && window.player_me && window.player_op) {
			var pile = grave.id === "grave-me" ? player_me.grave : player_op.grave;
			if (pile && pile.cards && pile.cards.length) return fromCard(pile.cards[pile.cards.length - 1]);
		}
		return null;
	}

	var sheet = document.createElement("section");
	sheet.id = "card-sheet";
	sheet.className = "hide";
	sheet.innerHTML = ''
		+ '<div id="card-sheet-dim"></div>'
		+ '<div id="card-sheet-panel">'
		+ '<div id="card-sheet-art"></div>'
		+ '<h2 id="card-sheet-name"></h2>'
		+ '<p id="card-sheet-meta"></p>'
		+ '<p id="card-sheet-ability"></p>'
		+ '</div>';
	document.body.appendChild(sheet);

	function showSheet(info) {
		document.getElementById("card-sheet-art").style.backgroundImage = info.art || "none";
		document.getElementById("card-sheet-name").textContent = info.name;
		document.getElementById("card-sheet-meta").textContent = "Сила: " + info.strength + "\nРяд: " + info.row;
		document.getElementById("card-sheet-ability").textContent = info.ability === RU.noAbility
			? info.ability
			: "Способность: " + info.ability;
		sheet.classList.remove("hide");
		closeSettings();
	}

	function closeSheet() {
		sheet.classList.add("hide");
	}

	document.getElementById("card-sheet-dim").addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		closeSheet();
	});

	var hold = { id: null, timer: null, fired: false };
	var press = { id: null, x: 0, y: 0, t: 0, moved: false, card: null, holdFired: false, scroller: null, scrollLeft: 0 };
	var settingsOpen = false;
	var settingsSwallow = false;
	var tap = { card: null, at: 0, timer: null, token: 0, armed: false };
	var allowClick = false;

	function forwardClick(el) {
		allowClick = true;
		try { el.click(); }
		finally { allowClick = false; }
	}

	function clearHoldTimer() {
		if (hold.timer) {
			clearTimeout(hold.timer);
			hold.timer = null;
		}
	}

	function clearSingleTimer() {
		if (tap.timer) {
			clearTimeout(tap.timer);
			tap.timer = null;
		}
	}

	function pointOf(e) {
		if (e.changedTouches && e.changedTouches.length) {
			return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
		}
		return { x: e.clientX, y: e.clientY };
	}

	/* Hit-test with the coordinates of this event. Do not reuse a previous
	   mouse position: on Android the synthetic mouseup often carries stale
	   coordinates while the touch point is the real one. */
	function targetAt(x, y, fallback) {
		var el = null;
		if (x || y) el = document.elementFromPoint(x, y);
		if (!el || el === document.body || el === document.documentElement) {
			if (fallback && fallback !== document.body && fallback !== document.documentElement) return fallback;
		}
		return el || fallback;
	}

	function playerLocked() {
		var main = document.querySelector("main");
		if (!main || main.classList.contains("noclick")) return true;
		var carousel = document.getElementById("carousel");
		if (carousel && !carousel.classList.contains("hide")) return true;
		var deck = document.getElementById("deck-customization");
		if (deck && !deck.classList.contains("hide")) return true;
		return !window.ui || !window.player_me;
	}

	var inspect = document.createElement("section");
	inspect.id = "card-inspect";
	inspect.innerHTML = ''
		+ '<div id="card-inspect-dim"></div>'
		+ '<div id="card-inspect-panel">'
		+ '<div id="card-inspect-card" class="card"></div>'
		+ '<p id="card-inspect-name"></p>'
		+ '<p id="card-inspect-hint">Двойное нажатие кладёт на стол</p>'
		+ '<button type="button" id="card-inspect-close">Закрыть</button>'
		+ '</div>';
	document.body.appendChild(inspect);

	function mulliganActive() {
		var el = document.getElementById("mulligan");
		return !!(el && el.classList.contains("open") && Carousel.curr && Carousel.curr._mulligan);
	}

	function stillInHand(card) {
		if (mulliganActive()) {
			var curr = Carousel.curr;
			return !!(card && curr.container && curr.container.cards.indexOf(card) !== -1);
		}
		return !!(card && window.player_me && player_me.hand && player_me.hand.cards.indexOf(card) !== -1);
	}

	function handCardEl(target) {
		if (!target || !target.closest) return null;
		var el = target.closest(".card");
		if (!el || !el._gwentCard) return null;
		if (el.classList.contains("noclick")) return null;
		if (mulliganActive() && (el.closest("#mulligan-row") || el.id === "card-inspect-card")) return el;
		if (el.closest("#hand-row") || el.id === "card-inspect-card") return el;
		return null;
	}

	function openInspect(card) {
		if (!stillInHand(card)) return;
		if (window.ui && ui.previewCard) ui.cancel();
		var face = document.getElementById("card-inspect-card");
		var art = card.faction && card.filename ? largeURL(card.faction + "_" + card.filename) : "";
		face.style.backgroundImage = art || "none";
		face._gwentCard = card;
		document.getElementById("card-inspect-name").textContent = ruCardName(card.name);
		document.getElementById("card-inspect-hint").textContent = mulliganActive()
			? "Двойное нажатие отмечает замену"
			: "Двойное нажатие кладёт на стол";
		inspect.classList.add("open");
		closeSettings();
	}

	function closeInspect() {
		inspect.classList.remove("open");
		var face = document.getElementById("card-inspect-card");
		if (face) face._gwentCard = null;
	}

	function selectableTargets() {
		var list = [];
		document.querySelectorAll(".row-selectable").forEach(function (el) {
			if (!el.classList.contains("noclick")) list.push(el);
		});
		return list;
	}

	/* Double tap highlights every legal row. One row is played at once.
	   Decoy still needs a unit: the only legal own unit is unambiguous. */
	function playCard(card) {
		if (mulliganActive()) {
			tap.token++;
			clearSingleTimer();
			tap.card = null;
			tap.armed = false;
			toggleMulligan(card);
			return;
		}
		if (playerLocked() || !stillInHand(card)) return;
		tap.token++;
		clearSingleTimer();
		tap.card = null;
		tap.armed = false;
		closeInspect();
		closeSheet();
		if (typeof zoom !== "undefined" && zoom.classList.contains("open")) closeZoom();
		ui.selectCard(card);
		if (!ui.previewCard || ui.previewCard !== card) return;
		if (card.name === "Decoy") {
			/* Witcher 3: only non-hero units on this side are legal — an enemy
			   spy that flipped to this player included. One legal target is
			   unambiguous; with several, the highlighted rows wait for a tap. */
			var legal = [];
			if (window.board && board.row && typeof GwentRules !== "undefined") {
				board.row.forEach(function (row, index) {
					legal = legal.concat(GwentRules.decoyTargets(row.cards, card.holder, index));
				});
			}
			if (legal.length === 1) {
				var target = legal[0].elem;
				if (target && !target.classList.contains("noclick")) forwardClick(target);
				return;
			}
			if (legal.length === 0) showHint("Чучелу нужен негеройский отряд на вашей стороне стола.");
			return;
		}
		if (card.name === "Scorch") return;
		var targets = selectableTargets();
		if (targets.length === 1) forwardClick(targets[0]);
	}

	function armSingle(card) {
		clearSingleTimer();
		tap.card = card;
		tap.at = Date.now();
		tap.armed = false;
		var token = ++tap.token;
		tap.timer = setTimeout(function () {
			if (tap.token !== token) return;
			tap.timer = null;
			if (tap.card === card) openInspect(card);
		}, DOUBLE_MS);
	}

	document.getElementById("card-inspect-dim").addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		closeInspect();
	});
	document.getElementById("card-inspect-close").addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		closeInspect();
	});

	function gestureScroller(el) {
		var node = el;
		while (node && node !== document.documentElement) {
			if (node.id === "hand-row" || node.id === "mulligan-row") return node;
			node = node.parentElement;
		}
		return null;
	}

	function pointerPastSlop(e) {
		var dx = e.clientX - press.x;
		var dy = e.clientY - press.y;
		if (dx * dx + dy * dy > TAP_SLOP * TAP_SLOP) return true;
		if (press.scroller && Math.abs(press.scroller.scrollLeft - press.scrollLeft) > SCROLL_SLOP) return true;
		return false;
	}

	document.addEventListener("pointerdown", function (e) {
		if (e.isPrimary === false) return;
		if (e.pointerType === "mouse" && e.button !== 0) return;
		if (settingsOpen && !(e.target.closest && e.target.closest("#settings-gear, #settings-menu"))) {
			closeSettings();
			settingsSwallow = true;
			press.id = null;
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		press.id = e.pointerId;
		press.x = e.clientX;
		press.y = e.clientY;
		press.t = Date.now();
		press.moved = false;
		press.holdFired = false;
		press.scroller = gestureScroller(e.target);
		press.scrollLeft = press.scroller ? press.scroller.scrollLeft : 0;
		var cardEl = handCardEl(e.target);
		press.card = cardEl ? cardEl._gwentCard : null;
		if (press.card && tap.card === press.card && (Date.now() - tap.at) <= DOUBLE_MS) {
			tap.token++;
			clearSingleTimer();
			tap.armed = true;
		} else {
			tap.armed = false;
		}
		var info = cardInfoFromEvent(e);
		clearHoldTimer();
		hold.id = null;
		hold.fired = false;
		if (!info) return;
		hold.id = e.pointerId;
		hold.timer = setTimeout(function () {
			hold.timer = null;
			hold.fired = true;
			press.holdFired = true;
			tap.armed = false;
			tap.token++;
			clearSingleTimer();
			showSheet(info);
		}, HOLD_MS);
	}, true);

	document.addEventListener("pointermove", function (e) {
		if (e.pointerId !== press.id || press.moved) return;
		if (pointerPastSlop(e)) {
			press.moved = true;
			clearHoldTimer();
			hold.id = null;
			tap.armed = false;
		}
	}, true);

	function onPointerUp(e) {
		if (press.id === null || e.pointerId !== press.id) return;
		var moved = press.moved || (press.scroller && Math.abs(press.scroller.scrollLeft - press.scrollLeft) > SCROLL_SLOP);
		var held = press.holdFired || hold.fired || (Date.now() - press.t) >= HOLD_MS;
		var downCard = press.card;
		var armed = tap.armed;
		var pt = pointOf(e);
		press.id = null;
		press.card = null;
		clearHoldTimer();
		hold.id = null;
		if (held) {
			hold.fired = false;
			tap.armed = false;
			return;
		}
		hold.fired = false;
		if (moved) {
			tap.armed = false;
			return;
		}
		var upEl = handCardEl(targetAt(pt.x, pt.y, e.target));
		var upCard = upEl ? upEl._gwentCard : downCard;
		if (armed && upCard && upCard === tap.card && stillInHand(upCard)) {
			playCard(upCard);
			return;
		}
		tap.armed = false;
		if (upCard && stillInHand(upCard)) armSingle(upCard);
	}
	document.addEventListener("pointerup", onPointerUp, true);
	document.addEventListener("pointercancel", function (e) {
		if (press.id !== null && e.pointerId === press.id) {
			press.id = null;
			tap.armed = false;
		}
		clearHoldTimer();
		hold.id = null;
	}, true);

	document.addEventListener("click", function (e) {
		if (settingsSwallow) {
			settingsSwallow = false;
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (allowClick) return;
		var cardEl = e.target.closest && e.target.closest(".card");
		if (!cardEl || !cardEl._gwentCard) return;
		if (cardEl.closest("#hand-row") || cardEl.closest("#mulligan-row") || cardEl.id === "card-inspect-card") {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (window.ui && ui.previewCard && ui.previewCard.name === "Decoy" && !cardEl.classList.contains("noclick")) return;
		e.preventDefault();
		e.stopPropagation();
		var grave = cardEl.closest(".grave");
		if (grave) grave.click();
	}, true);

	document.addEventListener("contextmenu", function (e) {
		if (e.target.closest && e.target.closest(".card, .card-lg, .leader-box, #card-leader, #carousel, #pass-button, #mulligan"))
			e.preventDefault();
	}, true);

	var origCreate = Card.prototype.createCardElem;
	Card.prototype.createCardElem = function (card) {
		var elem = origCreate.call(this, card);
		elem._gwentCard = card;
		return elem;
	};

	var zoom = document.createElement("section");
	zoom.id = "hand-zoom";
	zoom.innerHTML = ''
		+ '<button type="button" id="hand-zoom-close">К столу</button>'
		+ '<p id="hand-zoom-empty" class="hide">В руке нет карт.</p>'
		+ '<div id="hand-zoom-body"></div>';
	document.body.appendChild(zoom);

	var handButton = document.createElement("button");
	handButton.id = "hand-zoom-open";
	handButton.type = "button";
	handButton.textContent = "Рука";
	var fieldHand = document.getElementById("field-hand");
	if (fieldHand) fieldHand.appendChild(handButton);
	else document.body.appendChild(handButton);

	function openZoom() {
		var carousel = document.getElementById("carousel");
		if (carousel && !carousel.classList.contains("hide")) return;
		var hand = document.getElementById("hand-row");
		if (!hand) return;
		document.getElementById("hand-zoom-body").appendChild(hand);
		var empty = document.getElementById("hand-zoom-empty");
		empty.classList.toggle("hide", hand.querySelectorAll(".card").length > 0);
		zoom.classList.add("open");
		handButton.classList.add("hide");
	}

	function closeZoom() {
		var hand = document.getElementById("hand-row");
		var field = document.getElementById("field-hand");
		if (hand && field && hand.parentNode !== field) {
			if (handButton.parentNode === field) field.insertBefore(hand, handButton);
			else field.appendChild(hand);
		}
		zoom.classList.remove("open");
		handButton.classList.remove("hide");
	}

	handButton.addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		openZoom();
	});
	document.getElementById("hand-zoom-close").addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		closeZoom();
	});

	zoom.addEventListener("click", function (e) {
		if (!zoom.classList.contains("open")) return;
		if (e.target.closest(".card, #hand-zoom-close")) return;
		closeZoom();
	});

	function markFaction(name) {
		var buttons = document.querySelectorAll("#faction-switch button");
		for (var i = 0; i < buttons.length; i++)
			buttons[i].classList.toggle("is-on", buttons[i].dataset.faction === name);
		var fac = RU.factions[name];
		var title = document.querySelector("#faction-title h1");
		if (title && fac) title.textContent = fac.name;
		var desc = document.getElementById("faction-description");
		if (desc && fac) desc.textContent = fac.description;
		var leaderName = document.getElementById("leader-name-ru");
		var maker = deckMaker();
		if (leaderName && maker && maker.leader && maker.leader.card)
			leaderName.textContent = ruCardName(maker.leader.card.name);
	}

	var origSetFaction = DeckMaker.prototype.setFaction;
	DeckMaker.prototype.setFaction = function (name, force) {
		var result = origSetFaction.apply(this, arguments);
		if (this.faction) markFaction(this.faction);
		return result;
	};

	var origStart = DeckMaker.prototype.startNewGame;
	DeckMaker.prototype.startNewGame = function () {
		var warning = "";
		if (this.stats.units < 22)
			warning += "В колоде должно быть не меньше 22 карт отрядов.\n";
		if (this.stats.special > 10)
			warning += "Особых карт должно быть не больше 10.\n";
		if (warning) {
			AudioManager.playSFX("warning");
			alert(warning);
			return;
		}
		closeZoom();
		closeSheet();
		closeInspect();
		return origStart.apply(this, arguments);
	};

	DeckMaker.prototype.updateFauxCard = function (container) {
		var fauxCard = container.getElementsByClassName("empty")[0];
		if (!fauxCard) {
			fauxCard = document.createElement("div");
			fauxCard.classList.add("card-lg");
			fauxCard.classList.add("empty");
		} else if (fauxCard.parentNode === container) {
			container.removeChild(fauxCard);
		}
		var visible = container.querySelectorAll(".card-lg:not(.hide):not(.empty)").length;
		if (visible % 2 === 1) container.appendChild(fauxCard);
	};

	var origQueue = UI.prototype.queueCarousel;
	UI.prototype.queueCarousel = function (container, count, action, predicate, bSort, bQuit, title) {
		if (title === "Choose up to 2 cards to redraw.")
			title = "Можно заменить до двух карт.";
		return origQueue.call(this, container, count, action, predicate, bSort, bQuit, title);
	};

	var mulligan = document.createElement("section");
	mulligan.id = "mulligan";
	mulligan.className = "hide";
	mulligan.innerHTML = ''
		+ '<p id="mulligan-title">Можно заменить до двух карт.</p>'
		+ '<p id="mulligan-hint">Короткое нажатие увеличивает. Удержание показывает описание. Двойное отмечает замену.</p>'
		+ '<div id="mulligan-row"></div>'
		+ '<div id="mulligan-actions">'
		+ '<button type="button" id="mulligan-commit" disabled>Заменить</button>'
		+ '<button type="button" id="mulligan-skip">Оставить</button>'
		+ '</div>';
	document.body.appendChild(mulligan);

	function isRedrawTitle(title) {
		if (!title) return false;
		var text = String(title);
		return text.indexOf("заменить") !== -1 || text.indexOf("redraw") !== -1;
	}

	function updateMulliganCount() {
		var curr = Carousel.curr;
		var selected = curr && curr._selected ? curr._selected.length : 0;
		var limit = curr && curr._mulliganLimit ? curr._mulliganLimit : 2;
		var hint = document.getElementById("mulligan-hint");
		if (hint) {
			hint.textContent = "Выбрано " + selected + " из " + limit
				+ ". Короткое нажатие увеличивает. Удержание — описание. Двойное отмечает замену.";
		}
		var commit = document.getElementById("mulligan-commit");
		if (commit) commit.disabled = selected < 1;
	}

	function closeMulligan() {
		var wasOpen = mulligan.classList.contains("open");
		mulligan.classList.remove("open");
		mulligan.classList.add("hide");
		var row = document.getElementById("mulligan-row");
		if (row) row.innerHTML = "";
		if (wasOpen) {
			closeInspect();
			closeSheet();
		}
	}

	function openMulligan(carousel) {
		carousel._mulligan = true;
		carousel._mulliganLimit = carousel.count > 0 ? carousel.count : 2;
		carousel._selected = [];
		carousel._mulliganBusy = false;
		if (carousel.elem) {
			carousel.elem.classList.add("hide");
			carousel.elem.classList.remove("mulligan-pending");
		}
		var row = document.getElementById("mulligan-row");
		row.innerHTML = "";
		var cards = carousel.container.cards;
		for (var i = 0; i < cards.length; i++) {
			var card = cards[i];
			var el = document.createElement("div");
			el.className = "card";
			var art = card.faction && card.filename ? largeURL(card.faction + "_" + card.filename) : "";
			el.style.backgroundImage = art || "none";
			el._gwentCard = card;
			row.appendChild(el);
		}
		var title = document.getElementById("mulligan-title");
		if (title) title.textContent = carousel.title || "Можно заменить до двух карт.";
		updateMulliganCount();
		mulligan.classList.remove("hide");
		mulligan.classList.add("open");
		closeSettings();
	}

	function toggleMulligan(card) {
		var curr = Carousel.curr;
		if (!curr || !curr._mulligan || curr._mulliganBusy) return;
		if (!curr._selected) curr._selected = [];
		var limit = curr._mulliganLimit || 2;
		var index = curr._selected.indexOf(card);
		if (index >= 0) curr._selected.splice(index, 1);
		else if (curr._selected.length >= limit) return;
		else curr._selected.push(card);
		var faces = document.querySelectorAll("#mulligan-row .card");
		for (var i = 0; i < faces.length; i++) {
			faces[i].classList.toggle("is-picked", curr._selected.indexOf(faces[i]._gwentCard) >= 0);
		}
		updateMulliganCount();
		closeInspect();
		closeSheet();
	}

	function skipMulligan() {
		var curr = Carousel.curr;
		if (!curr || !curr._mulligan || curr._mulliganBusy) return;
		curr._mulliganBusy = true;
		curr.cancel();
	}

	async function commitMulligan() {
		var curr = Carousel.curr;
		if (!curr || !curr._mulligan || curr._mulliganBusy) return;
		var selected = (curr._selected || []).slice();
		if (!selected.length) return;
		curr._mulliganBusy = true;
		closeInspect();
		closeSheet();
		try {
			for (var i = 0; i < selected.length; i++) {
				var card = selected[i];
				var index = curr.container.cards.indexOf(card);
				if (index < 0) continue;
				await curr.action(curr.container, index);
			}
		} finally {
			if (Carousel.curr === curr) curr.exit();
		}
	}

	document.getElementById("mulligan-commit").addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		commitMulligan();
	});
	document.getElementById("mulligan-skip").addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		skipMulligan();
	});

	var origCarouselStart = Carousel.prototype.start;
	Carousel.prototype.start = function () {
		var redraw = isRedrawTitle(this.title);
		if (redraw && this.elem) this.elem.classList.add("mulligan-pending");
		var result = origCarouselStart.apply(this, arguments);
		if (redraw && Carousel.curr === this) openMulligan(this);
		else if (this.elem) this.elem.classList.remove("mulligan-pending");
		return result;
	};

	var origCarouselExit = Carousel.prototype.exit;
	Carousel.prototype.exit = function () {
		closeMulligan();
		return origCarouselExit.apply(this, arguments);
	};

	function closeSettings() {
		settingsOpen = false;
		var menu = document.getElementById("settings-menu");
		var gear = document.getElementById("settings-gear");
		if (menu) menu.classList.add("hide");
		if (gear) {
			gear.classList.remove("is-on");
			gear.setAttribute("aria-expanded", "false");
		}
	}

	function toggleSettings() {
		settingsOpen = !settingsOpen;
		var menu = document.getElementById("settings-menu");
		var gear = document.getElementById("settings-gear");
		if (menu) menu.classList.toggle("hide", !settingsOpen);
		if (gear) {
			gear.classList.toggle("is-on", settingsOpen);
			gear.setAttribute("aria-expanded", settingsOpen ? "true" : "false");
		}
	}

	var gear = document.createElement("button");
	gear.id = "settings-gear";
	gear.type = "button";
	gear.setAttribute("aria-label", "Настройки");
	gear.setAttribute("aria-expanded", "false");
	gear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 2h-4l-.3 2.9a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1L11 22h4l.3-2.9a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.7zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>';
	var menu = document.createElement("div");
	menu.id = "settings-menu";
	menu.className = "hide";
	var settingLabels = {
		"toggle-music": "Музыка",
		"toggle-sfx": "Звук",
		"toggle-notifications": "Уведомления"
	};
	Object.keys(settingLabels).forEach(function (id) {
		var el = document.getElementById(id);
		if (!el) return;
		var name = document.createElement("span");
		name.className = "settings-label";
		name.textContent = settingLabels[id];
		el.appendChild(name);
		menu.appendChild(el);
	});
	document.body.appendChild(gear);
	document.body.appendChild(menu);
	gear.addEventListener("click", function (e) {
		e.preventDefault();
		e.stopPropagation();
		toggleSettings();
	});

	function passBlocked() {
		var pass = document.getElementById("pass-button");
		if (!pass || pass.classList.contains("noclick")) return true;
		var main = document.querySelector("main");
		if (main && main.classList.contains("noclick")) return true;
		var deck = document.getElementById("deck-customization");
		if (deck && !deck.classList.contains("hide")) return true;
		if (mulliganActive()) return true;
		var zoomEl = document.getElementById("hand-zoom");
		if (zoomEl && zoomEl.classList.contains("open")) return true;
		var end = document.getElementById("end-screen");
		if (end && !end.classList.contains("hide")) return true;
		return !window.player_me;
	}

	function installPassHold() {
		var old = document.getElementById("pass-button");
		if (!old) return;
		var pass = old.cloneNode(true);
		old.parentNode.replaceChild(pass, old);
		var label = document.createElement("span");
		label.className = "pass-label";
		label.textContent = "Пас";
		var fill = document.createElement("span");
		fill.className = "pass-fill";
		pass.textContent = "";
		pass.appendChild(fill);
		pass.appendChild(label);
		pass.style.setProperty("--pass-p", "0");
		var state = { id: null, timer: 0, start: 0, done: false };

		function paint(p) {
			pass.style.setProperty("--pass-p", String(p));
			pass.classList.toggle("is-holding", p > 0);
		}

		function finishPass() {
			state.done = true;
			state.id = null;
			if (state.timer) clearInterval(state.timer);
			state.timer = 0;
			paint(1);
			if (typeof player_me !== "undefined" && player_me && typeof player_me.passRound === "function") {
				player_me.passRound();
				if (window.AudioManager) AudioManager.playSFX("pass");
			}
			paint(0);
			pass.classList.remove("is-holding");
		}

		function reset() {
			if (state.timer) clearInterval(state.timer);
			state.timer = 0;
			state.id = null;
			state.done = false;
			paint(0);
		}

		pass.addEventListener("pointerdown", function (e) {
			if (e.isPrimary === false) return;
			if (e.pointerType === "mouse" && e.button !== 0) return;
			if (passBlocked()) return;
			e.preventDefault();
			e.stopPropagation();
			reset();
			state.id = e.pointerId;
			state.start = Date.now();
			try { pass.setPointerCapture(e.pointerId); } catch (err) {}
			state.timer = setInterval(function () {
				if (state.id !== e.pointerId) return;
				var p = Math.min(1, (Date.now() - state.start) / PASS_HOLD_MS);
				paint(p);
				if (p >= 1) finishPass();
			}, 40);
		});
		pass.addEventListener("pointerup", function (e) {
			if (state.id === null || e.pointerId !== state.id) return;
			e.preventDefault();
			e.stopPropagation();
			reset();
		});
		pass.addEventListener("pointercancel", function (e) {
			if (state.id === null || e.pointerId !== state.id) return;
			reset();
		});
		pass.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
		}, true);
	}
	installPassHold();

	var switcher = document.createElement("div");
	switcher.id = "faction-switch";
	[
		["realms", "Север"],
		["nilfgaard", "Нильфгаард"],
		["monsters", "Чудовища"],
		["scoiatael", "Скоя'таэли"],
		["skellige", "Скеллиге"]
	].forEach(function (pair) {
		var button = document.createElement("button");
		button.type = "button";
		button.textContent = pair[1];
		button.dataset.faction = pair[0];
		button.addEventListener("click", function () {
			dm.loadFactionDeck(pair[0]);
		});
		switcher.appendChild(button);
	});
	var start = document.getElementById("start-game");
	if (start) start.parentNode.insertBefore(switcher, start);

	var saveNote = document.createElement("p");
	saveNote.id = "deck-save-note";
	saveNote.textContent = "Для каждой фракции колода собирается заранее и хранится на этом телефоне. В партию берётся сохранённая. Отрядов не меньше 22, особых не больше 10, копий карты — не больше, чем в правилах клиента. Удерживайте карту, чтобы прочитать её. Короткое нажатие перекладывает.";
	if (start) start.insertAdjacentElement("afterend", saveNote);

	var leaderLabel = document.querySelector("#card-leader > p");
	if (leaderLabel) leaderLabel.textContent = "Лидер";
	var leaderName = document.createElement("p");
	leaderName.id = "leader-name-ru";
	var leaderArt = document.querySelector("#card-leader > div");
	if (leaderArt) leaderArt.insertAdjacentElement("afterend", leaderName);
	if (leaderArt) {
		new MutationObserver(function () {
			var maker = deckMaker();
			if (maker && maker.faction) markFaction(maker.faction);
		}).observe(leaderArt, { attributes: true, attributeFilter: ["style"] });
	}

	var stats = document.getElementById("deck-stats");
	if (stats) {
		var labels = ["Карт в колоде", "Отряды (минимум 22)", "Особые (максимум 10)", "Сумма силы отрядов", "Герои"];
		for (var s = 0; s < labels.length; s++) {
			if (stats.children[s * 2]) stats.children[s * 2].textContent = labels[s];
		}
	}
	var opponentLabel = document.querySelector("#opponent-preview p");
	if (opponentLabel) opponentLabel.textContent = "Колода соперника";
	var randomLabel = document.querySelector("#op-preview-leader p");
	if (randomLabel) randomLabel.textContent = "Случайная";

	var origDesc = UI.prototype.setDescription;
	UI.prototype.setDescription = function (card, desc) {
		origDesc.call(this, card, desc);
		if (!card || !desc || !desc.children || !desc.children[1]) return;
		var info = (card.faction === "faction" || (!card.name && card.desc_name)) ? fromFactionCard(card) : fromCard(card);
		if (!info) return;
		desc.classList.remove("hide");
		desc.children[1].textContent = info.name;
		var abilityLine = info.ability === RU.noAbility ? info.ability : "Способность: " + info.ability;
		desc.children[2].textContent = "Сила: " + info.strength + ". Ряд: " + info.row + ".\n" + abilityLine;
	};

	var makerNow = deckMaker();
	if (makerNow && makerNow.faction) {
		markFaction(makerNow.faction);
		if (typeof makerNow.update === "function") makerNow.update();
	}
})();
