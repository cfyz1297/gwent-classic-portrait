import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function cardByName(page, name) {
	const index = page.card_dict.findIndex((card) => card.name === name);
	assert.notEqual(index, -1, "card not found: " + name);
	return page.card_dict[index];
}

function leaderIndex(page, faction) {
	const index = page.card_dict.findIndex((card) => card.row === "leader" && card.deck === faction);
	assert.notEqual(index, -1, "leader not found: " + faction);
	return index;
}

function setup() {
	const { window, page } = boot();
	const me = new page.Player(0, "Player 1", {
		faction: "realms",
		leader: page.card_dict[leaderIndex(page, "realms")],
		cards: []
	});
	const op = new page.Player(1, "Player 2", {
		faction: "nilfgaard",
		leader: page.card_dict[leaderIndex(page, "nilfgaard")],
		cards: []
	});
	page.me = me;
	page.op = op;
	me.endTurn = () => { me.ended = (me.ended || 0) + 1; };
	op.endTurn = () => { op.ended = (op.ended || 0) + 1; };
	return { window, page, me, op };
}

function spyCard(page) {
	const data = page.card_dict.find((card) => {
		const ability = (card.ability || "").split(" ");
		return ability.includes("spy") && !ability.includes("hero");
	});
	assert.ok(data, "no ordinary spy card in the database");
	return data;
}

function heroCard(page) {
	const data = page.card_dict.find((card) => {
		const ability = (card.ability || "").split(" ");
		return card.row === "close" && ability.includes("hero") && !ability.includes("spy");
	});
	assert.ok(data, "no hero card in the database");
	return data;
}

test("enemy spy on this side is a legal Decoy target and comes into hand", async () => {
	const { page, me, op } = setup();
	const decoy = new page.Card(cardByName(page, "Decoy"), me);
	const spy = new page.Card(spyCard(page), op);

	// A spy flips its holder to the opponent on placement, so this card now
	// belongs to this player and stands on this player's side.
	spy.holder = me;
	const row = page.board.row[3];
	await row.addCard(spy);
	me.hand.addCard(decoy);

	assert.equal(page.GwentRules.isDecoyTarget(spy, me, 3), true, "rules must accept a flipped spy");
	assert.deepEqual(Array.from(page.GwentRules.decoyRows(page.board.row, me)), [3]);

	page.ui.selectCard(decoy);
	assert.equal(page.ui.previewCard, decoy);
	assert.ok(row.elem.classList.contains("row-selectable"), "row with a spy must be selectable");
	assert.equal(spy.elem.classList.contains("noclick"), false, "spy must be tappable");

	await page.ui.selectCard(spy);

	assert.ok(me.hand.cards.includes(spy), "spy returns to the Decoy owner's hand");
	assert.ok(row.cards.includes(decoy), "Decoy takes the spy's place");
	assert.equal(row.cards.includes(spy), false, "spy left the board");
	assert.equal(decoy.holder, me);
	assert.equal(me.ended, 1, "playing a Decoy ends the turn");
});

test("heroes cannot be swapped by a Decoy", async () => {
	const { page, me } = setup();
	const decoy = new page.Card(cardByName(page, "Decoy"), me);
	const hero = new page.Card(heroCard(page), me);
	const row = page.board.row[4];
	row.addCard(hero);
	me.hand.addCard(decoy);

	assert.equal(page.GwentRules.isDecoyTarget(hero, me, 4), false);

	page.ui.selectCard(decoy);
	assert.equal(hero.elem.classList.contains("noclick"), true, "a hero stays unselectable");
	assert.equal(row.elem.classList.contains("row-selectable"), false, "a hero-only row is not offered");

	await page.ui.selectCard(hero);
	assert.ok(me.hand.cards.includes(decoy), "Decoy stays in hand");
	assert.ok(row.cards.includes(hero), "hero stays on the board");
	assert.equal(me.ended || 0, 0, "a rejected Decoy must not end the turn");
});

test("Decoy cannot reach the opponent side of the board", async () => {
	const { page, me, op } = setup();
	const decoy = new page.Card(cardByName(page, "Decoy"), me);
	const ownSpy = new page.Card(spyCard(page), op);
	ownSpy.holder = op;
	const opRow = page.board.row[0];
	opRow.addCard(ownSpy);
	me.hand.addCard(decoy);

	assert.equal(page.GwentRules.isDecoyTarget(ownSpy, me, 0), false);

	page.ui.selectCard(decoy);
	assert.equal(opRow.elem.classList.contains("row-selectable"), false);
	assert.equal(opRow.cards.length, 1);
	assert.equal(me.ended || 0, 0);
});

test("Decoy on a second copy stays legal and the hand keeps ordering", async () => {
	const { page, me, op } = setup();
	const decoy = new page.Card(cardByName(page, "Decoy"), me);
	const spyOne = new page.Card(spyCard(page), op);
	const spyTwo = new page.Card(spyCard(page), op);
	spyOne.holder = me;
	spyTwo.holder = me;
	page.board.row[3].addCard(spyOne);
	page.board.row[5].addCard(spyTwo);
	me.hand.addCard(decoy);

	page.ui.selectCard(decoy);
	assert.ok(page.board.row[3].elem.classList.contains("row-selectable"));
	assert.ok(page.board.row[5].elem.classList.contains("row-selectable"));

	await page.ui.selectCard(spyTwo);
	assert.ok(me.hand.cards.includes(spyTwo));
	assert.ok(page.board.row[5].cards.includes(decoy));
	assert.ok(page.board.row[3].cards.includes(spyOne));
});
test("a spy with a stale opponent holder is still decoyed from this side", async () => {
	const { page, me, op } = setup();
	const decoy = new page.Card(cardByName(page, "Decoy"), me);
	const spy = new page.Card(spyCard(page), op);
	// The placement hook has not flipped the holder yet, but the card already
	// stands on this player's side. Decoy must still take it.
	const row = page.board.row[5];
	await row.addCard(spy);
	spy.holder = op; // simulate a placement hook that has not flipped yet
	me.hand.addCard(decoy);

	page.ui.selectCard(decoy);
	assert.ok(row.elem.classList.contains("row-selectable"), "stale-holder spy must be selectable");
	assert.equal(spy.elem.classList.contains("noclick"), false);

	await page.ui.selectCard(spy);
	assert.ok(me.hand.cards.includes(spy), "the spy joins the Decoy owner's hand");
	assert.equal(spy.holder, me);
	assert.ok(row.cards.includes(decoy));
});