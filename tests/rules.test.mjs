import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rules = require("../www/rules.js");

const cardDict = [
	{ name: "Decoy", deck: "special", row: "", strength: "", ability: "decoy", count: "3" },
	{ name: "Spy", deck: "nilfgaard", row: "close", strength: "4", ability: "spy", count: "3" },
	{ name: "Hero", deck: "realms", row: "close", strength: "15", ability: "hero", count: "1" },
	{ name: "Agile", deck: "scoiatael", row: "agile", strength: "6", ability: "", count: "1" },
	{ name: "Weather", deck: "weather", row: "", strength: "", ability: "frost", count: "3" },
	{ name: "Foltest", deck: "realms", row: "leader", strength: "", ability: "foltest_king", count: "1" },
	{ name: "Bran", deck: "skellige", row: "leader", strength: "", ability: "king_bran", count: "0" },
	{ name: "Emhyr", deck: "nilfgaard", row: "leader", strength: "", ability: "emhyr_imperial", count: "1" }
];

const abilityDict = {
	foltest_king: { activated: [function () {}] },
	king_bran: { placed: function () {} },
	decoy: { name: "Decoy" }
};

const me = { hand: { cards: [] } };
const op = { hand: { cards: [] } };

function unit(overrides) {
	return Object.assign({ row: "close", hero: false, abilities: [], holder: me }, overrides);
}

test("Decoy accepts a non-hero unit on the player side, spies included", () => {
	assert.equal(rules.isDecoyTarget(unit({ abilities: ["spy"] }), me, 3), true);
	assert.equal(rules.isDecoyTarget(unit({ row: "ranged" }), me, 4), true);
	assert.equal(rules.isDecoyTarget(unit({ row: "agile" }), me, 5), true);
});

test("Decoy rejects heroes, specials and the opponent side", () => {
	assert.equal(rules.isDecoyTarget(unit({ hero: true }), me, 3), false);
	assert.equal(rules.isDecoyTarget({ row: "", hero: false, abilities: [], holder: me }, me, 3), false);
	assert.equal(rules.isDecoyTarget(unit(), me, 2), false);
	assert.equal(rules.isDecoyTarget(unit({ holder: op }), me, 3), true, "a card on your side is yours to swap, whoever holds it");
	assert.equal(rules.isDecoyTarget(null, me, 3), false);
});

test("sides are three rows and can be addressed per player", () => {
	assert.equal(rules.onSide(3, undefined), true);
	assert.equal(rules.onSide(5, undefined), true);
	assert.equal(rules.onSide(2, undefined), false);
	assert.equal(rules.onSide(0, 0), true);
	assert.equal(rules.onSide(2, 0), true);
	assert.equal(rules.onSide(3, 0), false);
});

test("decoyRows only reports rows 3..5 that hold a legal target", () => {
	const rows = [
		{ cards: [unit({ holder: op })] },
		{ cards: [unit({ holder: op })] },
		{ cards: [unit({ holder: op })] },
		{ cards: [unit({ abilities: ["spy"] })] },
		{ cards: [unit({ hero: true })] },
		{ cards: [unit({ row: "siege" })] }
	];
	assert.deepEqual(rules.decoyRows(rows, me), [3, 5]);
	assert.equal(rules.hasDecoyTarget(rows, me), true);
	assert.equal(rules.hasDecoyTarget([{ cards: [] }, { cards: [] }, { cards: [] }, { cards: [] }], me), false);
});

test("leadersFor keeps card order and faction", () => {
	const leaders = rules.leadersFor(cardDict, "realms");
	assert.equal(leaders.length, 1);
	assert.equal(leaders[0].index, 5);
	assert.equal(leaders[0].card.name, "Foltest");
	assert.equal(rules.leadersFor(cardDict, "scoiatael").length, 0);
});

test("passive leader detection follows the ability definition", () => {
	assert.equal(rules.isPassiveLeader(abilityDict, cardDict[5]), false);
	assert.equal(rules.isPassiveLeader(abilityDict, cardDict[6]), true);
	assert.equal(rules.isPassiveLeader(abilityDict, { ability: "unknown" }), true);
	assert.equal(rules.isPassiveLeader({ single: { activated: async () => {} } }, { ability: "single" }), false, "a single function is an active ability");
	assert.equal(rules.isPassiveLeader({ none: {} }, { ability: "none" }), true);
});

test("deck stats and limits match the Witcher 3 deck rules", () => {
	const stats = rules.deckStats(cardDict, [
		{ index: 1, count: 3 },
		{ index: 4, count: 1 },
		{ index: 5, count: 1 }
	]);
	assert.equal(stats.units, 3);
	assert.equal(stats.specials, 1);
	assert.equal(stats.strength, 12);
	assert.equal(stats.heroes, 0);
	assert.deepEqual(rules.validateDeckStats({ units: 21, specials: 0 }), ["units"]);
	assert.deepEqual(rules.validateDeckStats({ units: 22, specials: 11 }), ["specials"]);
	assert.deepEqual(rules.validateDeckStats({ units: 22, specials: 10 }), []);
});

test("parseDeckJSON accepts a well formed deck", () => {
	const parsed = rules.parseDeckJSON(JSON.stringify({
		faction: "nilfgaard",
		leader: 7,
		cards: [[1, 3], [4, 1]]
	}), cardDict, ["realms", "nilfgaard"]);
	assert.equal(parsed.ok, true);
	assert.equal(parsed.deck.faction, "nilfgaard");
	assert.equal(parsed.deck.cards.length, 2);
	assert.equal(parsed.deck.cards[0].count, 3);
});

test("parseDeckJSON refuses malformed and hostile input", () => {
	const cases = [
		["", "empty"],
		["{", "unparsable"],
		["[]", "not-object"],
		[JSON.stringify({ faction: "nope", leader: 7, cards: [] }), "faction"],
		[JSON.stringify({ faction: "nilfgaard", leader: 0, cards: [] }), "leader-faction"],
		[JSON.stringify({ faction: "nilfgaard", leader: 99, cards: [] }), "leader"],
		[JSON.stringify({ faction: "nilfgaard", leader: 7, cards: "x" }), "cards"],
		[JSON.stringify({ faction: "nilfgaard", leader: 7, cards: [["__proto__", 1]] }), "entry"],
		[JSON.stringify({ faction: "nilfgaard", leader: 7, cards: [[1, 1.5]] }), "entry"],
		[JSON.stringify({ faction: "nilfgaard", leader: 7, cards: [[2, 1]] }), "card"]
	];
	for (const [text, reason] of cases) {
		const parsed = rules.parseDeckJSON(text, cardDict, ["realms", "nilfgaard"]);
		assert.equal(parsed.ok, false, "expected rejection for " + text);
		assert.ok(parsed.reasons.includes(reason), reason + " expected in " + JSON.stringify(parsed.reasons));
	}
});

test("parseDeckJSON caps counts, merges duplicates and ignores huge files", () => {
	const parsed = rules.parseDeckJSON(JSON.stringify({
		faction: "nilfgaard",
		leader: 7,
		cards: [[1, 2], [1, 2]]
	}), cardDict, ["nilfgaard"]);
	assert.equal(parsed.ok, true);
	assert.equal(parsed.deck.cards.length, 1);
	assert.equal(parsed.deck.cards[0].count, 3, "clamped to the number of copies in the collection");

	const huge = "x".repeat(rules.MAX_DECK_JSON + 1);
	assert.equal(rules.parseDeckJSON(huge, cardDict, ["nilfgaard"]).reasons[0], "too-large");
});

test("parseDeckJSON does not touch Object.prototype", () => {
	rules.parseDeckJSON(JSON.stringify({ faction: "nilfgaard", leader: 7, cards: [["__proto__", 1]] }), cardDict, ["nilfgaard"]);
	rules.parseDeckJSON('{"__proto__":{"polluted":true},"faction":"nilfgaard","leader":1,"cards":[]}', cardDict, ["nilfgaard"]);
	assert.equal({}.polluted, undefined);
});