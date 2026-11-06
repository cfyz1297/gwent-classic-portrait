/* Witcher 3 Gwent rules that both the game and the test suite rely on.
   Pure functions only: no DOM, no globals besides the export.
   Browser: window.GwentRules. Node: require("./rules.js"). */
(function (root, factory) {
	var api = factory();
	if (typeof module === "object" && module && module.exports) module.exports = api;
	if (root) root.GwentRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
	"use strict";

	var COMBAT_ROWS = ["close", "ranged", "siege", "agile"];
	var DECK_FACTIONS = ["realms", "nilfgaard", "monsters", "scoiatael", "skellige"];
	var DECK_EXTRA_DECKS = ["neutral", "special", "weather"];
	var ME_ROW_START = 3;              // Board.row[0..2] = opponent, [3..5] = player
	var MIN_UNITS = 22;
	var MAX_SPECIALS = 10;
	var MAX_DECK_JSON = 64 * 1024;     // imported deck files are tiny; refuse anything huge
	var MAX_IMPORT_CARDS = 200;

	function abilitiesOf(card) {
		if (!card) return [];
		if (Array.isArray(card.abilities)) return card.abilities;
		if (typeof card.ability === "string") return card.ability.split(" ").filter(Boolean);
		return [];
	}

	function hasAbility(card, id) {
		return abilitiesOf(card).indexOf(id) !== -1;
	}

	function isHero(card) {
		return !!(card && (card.hero || hasAbility(card, "hero")));
	}

	// A unit is a combat card that is not a hero. Heroes are immune to Decoy,
	// Scorch and every other card ability.
	function isUnit(card) {
		if (!card) return false;
		if (typeof card.isUnit === "function") return card.isUnit();
		if (isHero(card)) return false;
		return COMBAT_ROWS.indexOf(card.row) !== -1;
	}

	// Board rows 0..2 belong to the opponent, 3..5 to the local player.
	// `sideStart` is the first row of the side that plays the Decoy: 3 for the
	// local player, 0 for the AI. Both sides own exactly three rows.
	function onSide(rowIndex, sideStart) {
		var start = sideStart === undefined ? ME_ROW_START : sideStart;
		return typeof rowIndex === "number" && rowIndex >= start && rowIndex <= start + 2;
	}

	/* Decoy in The Witcher 3: swap with a non-hero unit standing on *your*
	   side of the battlefield, then take that card into your hand.
	   An opponent spy sits on your side, so it is a legal target even while
	   its placement hook has not flipped the holder yet: Decoying it steals
	   the spy and lets you replay it for two more cards. Ownership is decided
	   by the side of the board, not by the holder field, which also survives
	   replayed or decoyed spies. Heroes and empty slots are never legal. */
	function isDecoyTarget(card, decoyHolder, rowIndex, sideStart) {
		if (!card || !decoyHolder) return false;
		if (!onSide(rowIndex, sideStart)) return false;
		return isUnit(card);
	}

	function decoyTargets(cards, decoyHolder, rowIndex, sideStart) {
		var out = [];
		(cards || []).forEach(function (card) {
			if (isDecoyTarget(card, decoyHolder, rowIndex, sideStart)) out.push(card);
		});
		return out;
	}

	// Rows 3..5 that currently hold at least one legal Decoy target.
	function decoyRows(boardRows, decoyHolder, sideStart) {
		var out = [];
		(boardRows || []).forEach(function (row, index) {
			if (!row || !onSide(index, sideStart)) return;
			if (decoyTargets(row.cards, decoyHolder, index, sideStart).length) out.push(index);
		});
		return out;
	}

	function hasDecoyTarget(boardRows, decoyHolder, sideStart) {
		return decoyRows(boardRows, decoyHolder, sideStart).length > 0;
	}

	// Leader cards of one faction, in card_dict order (same order the editor shows).
	function leadersFor(cardDict, faction) {
		var out = [];
		(cardDict || []).forEach(function (card, index) {
			if (card && card.row === "leader" && card.deck === faction) {
				out.push({ index: index, card: card });
			}
		});
		return out;
	}

	// A leader ability is "active" when it can be fired once per game and
	// "passive" when it is applied automatically (Eredin the Treacherous,
	// Emhyr the Invader, Bran, Daisy of the Valley).
	function isPassiveLeader(abilityDict, card) {
		var id = card && abilitiesOf(card)[0];
		var ability = id && abilityDict ? abilityDict[id] : null;
		if (!ability) return true;
		// ability_dict stores a single function, while older code could store a list.
		if (typeof ability.activated === "function") return false;
		if (Array.isArray(ability.activated)) return ability.activated.length === 0;
		return true;
	}

	function deckStats(cardDict, entries) {
		var stats = { total: 0, units: 0, specials: 0, strength: 0, heroes: 0 };
		(entries || []).forEach(function (entry) {
			var card = cardDict && cardDict[entry && entry.index];
			if (!card) return;
			var count = Number(entry.count) || 0;
			stats.total += count;
			if (card.deck === "special" || card.deck === "weather") {
				stats.specials += count;
				return;
			}
			if (card.row === "leader") return;
			stats.units += count;
			stats.strength += (Number(card.strength) || 0) * count;
			if (isHero(card)) stats.heroes += count;
		});
		return stats;
	}

	function validateDeckStats(stats) {
		var warnings = [];
		if (!stats || stats.units < MIN_UNITS) warnings.push("units");
		if (stats && stats.specials > MAX_SPECIALS) warnings.push("specials");
		return warnings;
	}

	function isPlainObject(value) {
		return !!value && typeof value === "object" && !Array.isArray(value);
	}

	function isIndex(value, length) {
		return typeof value === "number" && isFinite(value) && Math.floor(value) === value && value >= 0 && value < length;
	}

	/* Strict import of a deck file. Returns { ok, deck, reasons } and never
	   throws, so a hostile JSON cannot break the editor or reach card_dict with
	   a non-numeric key ("__proto__", "constructor", ...). */
	function parseDeckJSON(text, cardDict, factions) {
		var known = factions && factions.length ? factions : DECK_FACTIONS;
		if (typeof text !== "string" || text.length === 0) return { ok: false, reasons: ["empty"] };
		if (text.length > MAX_DECK_JSON) return { ok: false, reasons: ["too-large"] };

		var raw;
		try {
			raw = JSON.parse(text);
		} catch (e) {
			return { ok: false, reasons: ["unparsable"] };
		}
		if (!isPlainObject(raw)) return { ok: false, reasons: ["not-object"] };

		var reasons = [];
		if (typeof raw.faction !== "string" || known.indexOf(raw.faction) === -1) reasons.push("faction");

		var cardCount = Array.isArray(cardDict) ? cardDict.length : 0;
		if (!isIndex(raw.leader, cardCount)) {
			reasons.push("leader");
		} else {
			var leader = cardDict[raw.leader];
			if (!leader || leader.row !== "leader" || leader.deck !== raw.faction) reasons.push("leader-faction");
		}

		if (!Array.isArray(raw.cards)) {
			reasons.push("cards");
		} else if (raw.cards.length > MAX_IMPORT_CARDS) {
			reasons.push("cards-too-many");
		}

		if (reasons.length) return { ok: false, reasons: reasons };

		var merged = {};
		var order = [];
		var broken = [];
		raw.cards.forEach(function (entry) {
			if (!Array.isArray(entry) || entry.length !== 2) {
				broken.push("entry");
				return;
			}
			var index = entry[0];
			var count = entry[1];
			if (!isIndex(index, cardCount) || typeof count !== "number" || !isFinite(count) || Math.floor(count) !== count || count < 1) {
				broken.push("entry");
				return;
			}
			var card = cardDict[index];
			if (!card || [raw.faction].concat(DECK_EXTRA_DECKS).indexOf(card.deck) === -1 || card.row === "leader") {
				broken.push("card");
				return;
			}
			var available = Number(card.count) || 0;
			if (available < 1) {
				broken.push("unavailable");
				return;
			}
			count = Math.min(count, available);
			if (!merged[index]) {
				merged[index] = 0;
				order.push(index);
			}
			merged[index] += count;
			if (merged[index] > available) merged[index] = available;
		});

		if (broken.length) return { ok: false, reasons: broken };

		return {
			ok: true,
			deck: {
				faction: raw.faction,
				leader: raw.leader,
				cards: order.map(function (index) { return { index: index, count: merged[index] }; })
			},
			reasons: []
		};
	}

	return {
		ME_ROW_START: ME_ROW_START,
		MIN_UNITS: MIN_UNITS,
		MAX_SPECIALS: MAX_SPECIALS,
		MAX_DECK_JSON: MAX_DECK_JSON,
		MAX_IMPORT_CARDS: MAX_IMPORT_CARDS,
		DECK_FACTIONS: DECK_FACTIONS,
		abilitiesOf: abilitiesOf,
		hasAbility: hasAbility,
		isHero: isHero,
		isUnit: isUnit,
		onSide: onSide,
		isDecoyTarget: isDecoyTarget,
		decoyTargets: decoyTargets,
		decoyRows: decoyRows,
		hasDecoyTarget: hasDecoyTarget,
		leadersFor: leadersFor,
		isPassiveLeader: isPassiveLeader,
		deckStats: deckStats,
		validateDeckStats: validateDeckStats,
		parseDeckJSON: parseDeckJSON
	};
});