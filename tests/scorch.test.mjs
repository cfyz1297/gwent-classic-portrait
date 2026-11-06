import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function leader(page, deck) {
	return page.card_dict.find((card) => card.row === "leader" && card.deck === deck);
}

function setup() {
	const { window, page } = boot();
	const me = new page.Player(0, "Геральт", { faction: "realms", leader: leader(page, "realms"), cards: [] });
	const op = new page.Player(1, "Соперник", { faction: "monsters", leader: leader(page, "monsters"), cards: [] });
	page.me = me;
	page.op = op;
	me.endTurn = () => {};
	op.endTurn = () => {};
	return { window, page, me, op };
}

function unit(page, holder, strength, row, name) {
	const data = {
		name: name || "Unit " + strength,
		deck: holder === page.me ? "realms" : "monsters",
		row: row || "close",
		strength: String(strength),
		ability: "",
		filename: "x"
	};
	return new page.Card(data, holder);
}

test("Scorch kills only the opponent's strongest unit", async () => {
	const { page, me, op } = setup();
	const mine = unit(page, me, 10);
	const theirs = unit(page, op, 8);
	page.board.row[3].addCard(mine);
	page.board.row[2].addCard(theirs);

	const scorch = new page.Card(page.card_dict.find((card) => card.name === "Scorch"), me);
	me.hand.addCard(scorch);
	await page.ability_dict["scorch"].activated(scorch);

	assert.ok(page.board.row[3].cards.includes(mine), "own strongest unit must survive");
	assert.equal(page.board.row[2].cards.includes(theirs), false, "enemy strongest unit is destroyed");
	assert.ok(op.grave.cards.includes(theirs));
});

test("Scorch removes every tied strongest enemy unit", async () => {
	const { page, me, op } = setup();
	const a = unit(page, op, 7, "close", "A");
	const b = unit(page, op, 7, "ranged", "B");
	const c = unit(page, op, 3, "siege", "C");
	page.board.row[2].addCard(a);
	page.board.row[1].addCard(b);
	page.board.row[0].addCard(c);

	const scorch = new page.Card(page.card_dict.find((card) => card.name === "Scorch"), me);
	me.hand.addCard(scorch);
	await page.ability_dict["scorch"].activated(scorch);

	assert.equal(op.grave.cards.includes(a), true);
	assert.equal(op.grave.cards.includes(b), true);
	assert.equal(op.grave.cards.includes(c), false);
});

test("Scorch does nothing on an empty enemy side", async () => {
	const { page, me, op } = setup();
	const mine = unit(page, me, 12);
	page.board.row[4].addCard(mine);
	const scorch = new page.Card(page.card_dict.find((card) => card.name === "Scorch"), me);
	me.hand.addCard(scorch);
	await page.ability_dict["scorch"].activated(scorch);
	assert.ok(page.board.row[4].cards.includes(mine));
	assert.equal(op.grave.cards.length, 0);
});
