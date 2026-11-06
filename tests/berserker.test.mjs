import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function leader(page, deck) {
	return page.card_dict.find((card) => card.row === "leader" && card.deck === deck);
}

test("Mardroeme transforms a Berserker into a Vildkaarl", async () => {
	const { page } = boot();
	const me = new page.Player(0, "Геральт", { faction: "skellige", leader: leader(page, "skellige"), cards: [] });
	const op = new page.Player(1, "Соперник", { faction: "realms", leader: leader(page, "realms"), cards: [] });
	page.me = me;
	page.op = op;
	me.endTurn = () => {};
	op.endTurn = () => {};

	const berserkerData = page.card_dict.find((card) => card.name === "Berserker");
	const mardroemeData = page.card_dict.find((card) => card.name === "Mardroeme");
	const berserker = new page.Card(berserkerData, me);
	const row = page.board.row[3];
	await row.addCard(berserker);

	const mardroeme = new page.Card(mardroemeData, me);
	await row.addCard(mardroeme);

	assert.equal(row.cards.includes(berserker), false, "the old Berserker leaves the row");
	const transformed = row.cards.find((card) => card.name.startsWith("Transformed"));
	assert.ok(transformed, "a transformed card must take its place");
	assert.equal(transformed.name, "Transformed Vildkaarl");
	assert.equal(transformed.power, 14);
	assert.equal(transformed.basePower, 14);
});