import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function setup() {
	const alerts = [];
	const { window, page } = boot({ alert: (message) => alerts.push(String(message)) });
	return { window, page, alerts };
}

function leaderIndex(page, faction) {
	return page.card_dict.findIndex((card) => card.row === "leader" && card.deck === faction);
}

function cardIndex(page, faction, predicate) {
	return page.card_dict.findIndex((card) => card.deck === faction && card.row !== "leader" && (!predicate || predicate(card)));
}

test("a valid deck imports without warnings", () => {
	const { page, alerts } = setup();
	const leader = leaderIndex(page, "realms");
	const card = cardIndex(page, "realms");
	const deck = page.dm.deckFromJSON(JSON.stringify({ faction: "realms", leader: leader, cards: [[card, 1]] }));
	assert.ok(deck);
	assert.equal(deck.faction, "realms");
	assert.equal(deck.leader, leader);
	assert.equal(deck.cards.length, 1);
	assert.deepEqual(alerts, []);
});

test("hostile deck JSON is rejected with a readable message", () => {
	const { page, alerts } = setup();
	const cases = [
		["{", /не JSON/],
		[JSON.stringify({ faction: "realms", leader: "__proto__", cards: [] }), /Лидер/],
		[JSON.stringify({ faction: "realms", leader: leaderIndex(page, "realms"), cards: [[0, "1"]] }), /запись/],
		[JSON.stringify({ faction: "realms", leader: leaderIndex(page, "realms"), cards: [[999999, 1]] }), /запись/],
		[JSON.stringify({ faction: "atlantis", leader: 0, cards: [] }), /фракция/i]
	];
	for (const [text, pattern] of cases) {
		const before = alerts.length;
		assert.equal(page.dm.deckFromJSON(text), undefined, "must not return a deck for " + text);
		assert.equal(alerts.length, before + 1);
		assert.match(alerts[alerts.length - 1], pattern);
	}
});

test("loadDeck drops unknown ids and refuses a mismatched leader", () => {
	const { page } = setup();
	const leader = leaderIndex(page, "realms");
	const valid = page.dm.loadDeck({ faction: "realms", leader: leader, cards: [[cardIndex(page, "realms"), 1], [999999, 1]] }, true);
	assert.equal(valid, null, "unknown ids invalidate the deck in strict mode");

	const mismatched = page.dm.loadDeck({ faction: "monsters", leader: leader, cards: [] }, true);
	assert.equal(mismatched, null);
});

test("an invalid custom opponent deck falls back to a premade deck", () => {
	const { window, page } = setup();
	page.dm.opponentData = { faction: "realms", leader: 999999, cards: [[0, 1]] };
	page.dm.updatedCustomOpponent();
	const deck = page.dm.constructOpponentDeck(true);
	assert.ok(deck && deck.leader && deck.leader.row === "leader", "fallback must still find a leader");
	assert.ok(deck.faction);
	assert.equal(window.document.getElementById("op-preview-leader").children[1].textContent, "Random");
});