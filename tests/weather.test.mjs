import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function leader(page, deck) {
	return page.card_dict.find((card) => card.row === "leader" && card.deck === deck);
}

function setup() {
	const { window, page } = boot();
	const me = new page.Player(0, "Геральт", { faction: "realms", leader: leader(page, "realms"), cards: [] });
	const op = new page.Player(1, "Соперник", { faction: "nilfgaard", leader: leader(page, "nilfgaard"), cards: [] });
	page.me = me;
	page.op = op;
	me.endTurn = () => {};
	op.endTurn = () => {};
	return { window, page, me, op };
}

function card(page, name) {
	return new page.Card(page.card_dict.find((c) => c.name === name), page.me);
}

test("Skellige Storm drops ranged and siege units of both sides to 1", async () => {
	const { page, me, op } = setup();
	const rows = [0, 1, 2, 3, 4, 5];
	rows.forEach((i) => {
		const holder = i < 3 ? op : me;
		const rowName = i % 3 === 0 ? "siege" : i % 3 === 1 ? "ranged" : "close";
		const u = new page.Card({ name: "U" + i, deck: holder === me ? "realms" : "nilfgaard", row: rowName, strength: "7", ability: "", filename: "x" }, holder);
		page.board.row[i].addCard(u);
	});

	const storm = card(page, "Skellige Storm");
	await page.weather.addCard(storm);

	for (const i of [0, 1, 4, 5]) {
		assert.equal(page.board.row[i].effects.weather, true, "row " + i + " must be under weather");
		assert.equal(page.board.row[i].cards[0].power, 1, "row " + i + " unit drops to 1");
	}
	for (const i of [2, 3]) {
		assert.equal(page.board.row[i].effects.weather, false, "close combat row " + i + " is unaffected");
		assert.equal(page.board.row[i].cards[0].power, 7);
	}
});

test("rain and storm on one row keep the weather until both are gone", async () => {
	const { page } = setup();
	const u = new page.Card({ name: "Siege", deck: "realms", row: "siege", strength: "6", ability: "", filename: "x" }, page.me);
	page.board.row[5].addCard(u);

	const rain = card(page, "Torrential Rain");
	const storm = card(page, "Skellige Storm");
	await page.weather.addCard(rain);
	await page.weather.addCard(storm);
	assert.equal(page.board.row[5].effects.weather, true);
	assert.equal(u.power, 1);

	page.weather.removeCard(storm);
	assert.equal(page.board.row[5].effects.weather, true, "rain still covers the row");
	assert.equal(u.power, 1);

	page.weather.removeCard(rain);
	assert.equal(page.board.row[5].effects.weather, false);
	assert.equal(u.power, 6);
});