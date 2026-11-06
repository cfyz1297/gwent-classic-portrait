/* Portrait layout for phones. Runs before gwent.js so element ids stay valid. */
(function () {
	var root = document.documentElement;
	root.classList.add("gwent-portrait");

	var main = document.querySelector("main");
	var board = document.getElementById("panel-mid");
	var weather = document.getElementById("weather");
	var fieldMe = document.getElementById("field-me");
	if (weather && board && fieldMe) {
		board.insertBefore(weather, fieldMe);
	}

	var dock = document.getElementById("portrait-dock");
	if (!dock && main) {
		dock = document.createElement("section");
		dock.id = "portrait-dock";
		main.appendChild(dock);
	}
	["pass-button", "leader-me", "deck-me", "grave-me", "grave-op"].forEach(function (id) {
		var el = document.getElementById(id);
		if (el && dock) dock.appendChild(el);
	});

	/* Opponent leader and deck sit on the opponent score row.
	   Left to right: leader, deck, then the name, lives and total. */
	var statsOp = document.getElementById("stats-op");
	["deck-op", "leader-op"].forEach(function (id) {
		var el = document.getElementById(id);
		if (el && statsOp) statsOp.insertBefore(el, statsOp.firstChild);
	});

	var captions = {
		"grave-op": "Сброс",
		"deck-op": "Колода",
		"leader-op": "Лидер",
		"leader-me": "Лидер",
		"grave-me": "Сброс",
		"deck-me": "Колода"
	};
	Object.keys(captions).forEach(function (id) {
		var el = document.getElementById(id);
		if (el) el.setAttribute("data-caption", captions[id]);
	});

	var pass = document.getElementById("pass-button");
	if (pass) {
		pass.textContent = "Пас";
		pass.setAttribute("data-title", "Пас");
	}

	var text = {
		"start-game": "Начать игру",
		"change-faction": "Сменить фракцию",
		"upload-deck": "Загрузить колоду",
		"download-deck": "Скачать колоду"
	};
	Object.keys(text).forEach(function (id) {
		var el = document.getElementById(id);
		if (!el) return;
		if (id === "upload-deck") {
			var input = el.querySelector("input");
			el.textContent = "";
			if (input) el.appendChild(input);
			el.appendChild(document.createTextNode(text[id]));
		} else {
			el.textContent = text[id];
		}
	});

	var end = document.getElementById("end-screen");
	if (end) {
		var buttons = end.querySelectorAll("button");
		var labels = ["К колоде", "Ещё раз", "Новая игра"];
		for (var i = 0; i < buttons.length && i < labels.length; i++) {
			buttons[i].textContent = labels[i];
		}
	}

	var cust = document.getElementById("deck-customization");
	var start = document.getElementById("start-game");
	var desc = document.getElementById("faction-description");
	if (cust && start && desc) desc.insertAdjacentElement("afterend", start);

	var deckTitle = document.getElementById("card-deck-title");
	var cardDeck = document.getElementById("card-deck");
	if (deckTitle && cardDeck) cardDeck.insertAdjacentElement("beforebegin", deckTitle);

	if (cust && !document.getElementById("portrait-disclaimer")) {
		var note = document.createElement("p");
		note.id = "portrait-disclaimer";
		note.textContent = "Фанатская сборка мини-игры. Это не официальный Гвинт CD PROJEKT RED.";
		cust.insertBefore(note, cust.firstChild);
	}

	var bankTitle = document.getElementById("card-bank-title");
	var deckTitleEl = document.getElementById("card-deck-title");
	if (bankTitle) bankTitle.textContent = "Коллекция";
	if (deckTitleEl) deckTitleEl.textContent = "Колода";

	/* Play-row handler lives on .row-cards or .row-special. Taps on the
	   score, the label, or the rest of the row are the same zone. */
	/* In landscape the carousel's card strip fills the screen, so a tap
	   outside a card hits it and cancels. In portrait that strip used to
	   shrink to the cards and the dark area swallowed every tap. */
	var carousel = document.getElementById("carousel");
	if (carousel) {
		carousel.addEventListener("click", function (e) {
			if (!window.Carousel || !Carousel.curr) return;
			var row = carousel.children[0];
			if (row && (e.target === row || row.contains(e.target))) return;
			Carousel.curr.cancel();
		});
	}

	function rowObject(row) {
		if (!window.board || !board.row) return null;
		for (var i = 0; i < board.row.length; i++) {
			if (board.row[i].elem_parent === row) return board.row[i];
		}
		return null;
	}

	document.querySelectorAll(".field-row").forEach(function (row) {
		row.addEventListener("click", function (e) {
			if (e.__gwentRow) return;
			var cards = row.querySelector(".row-cards");
			var special = row.querySelector(".row-special");
			var cardsOn = cards && cards.classList.contains("row-selectable") && !cards.classList.contains("noclick");
			var specialOn = special && special.classList.contains("row-selectable") && !special.classList.contains("noclick");
			var preview = window.ui && ui.previewCard;

			if (!preview) {
				if (!cards || cards.classList.contains("noclick")) return;
				if (e.target === cards || cards.contains(e.target)) return;
				if (special && (e.target === special || special.contains(e.target))) return;
				e.__gwentRow = true;
				cards.click();
				return;
			}

			if (preview.name === "Decoy") {
				/* Witcher 3: any non-hero unit on this side is a legal target,
				   including an opponent spy that flipped to this player. A hero,
				   another row, or a miss must not substitute another unit. */
				var unit = e.target.closest && e.target.closest(".card");
				var model = unit && row.contains(unit) ? unit._gwentCard : null;
				var obj = rowObject(row);
				var index = obj && window.board ? board.row.indexOf(obj) : -1;
				// The rule is authoritative: a target placed after the preview was opened
				// still carries the noclick class, but it is a legal Decoy target.
				var legal = !!model && typeof GwentRules !== "undefined" && GwentRules.isDecoyTarget(model, preview.holder, index);
				e.preventDefault();
				e.stopPropagation();
				if (!legal) {
					if (window.gwentHint) {
						var why = "Чучелом можно заменить только негеройский отряд на своей стороне.";
						if (model && index >= 0 && index < 3) why = "Чучело работает только на вашей стороне стола.";
						else if (model && model.hero) why = "Героя нельзя заменить Чучелом.";
						else if (model && typeof model.isUnit === "function" && !model.isUnit()) why = "Чучелом можно заменить только карту отряда.";
						gwentHint(why);
					}
					return;
				}
				if (obj) ui.lastRow = obj;
				ui.selectCard(model);
				return;
			}

			if (cards && (e.target === cards || cards.contains(e.target)) && cardsOn) return;
			if (special && (e.target === special || special.contains(e.target)) && specialOn) return;
			if (cardsOn) {
				e.preventDefault();
				e.stopPropagation();
				e.__gwentRow = true;
				cards.click();
				return;
			}
			if (specialOn) {
				e.preventDefault();
				e.stopPropagation();
				e.__gwentRow = true;
				special.click();
			}
		}, true);
	});

	/* Fit the whole hand on screen. The stock resize only overlaps from 11
	   cards, so a phone hand of 10 left the rightmost cards off-screen. */
	document.addEventListener("DOMContentLoaded", function () {
		if (typeof Hand !== "function") return;
		Hand.prototype.resize = function () {
			this.counter.innerHTML = this.cards.length;
			if (!this.elem) return;
			var cards = this.elem.getElementsByClassName("card");
			for (var i = 0; i < cards.length; i++) {
				cards[i].style.marginLeft = "0px";
				cards[i].style.marginRight = "0px";
			}
		};
	});
})();