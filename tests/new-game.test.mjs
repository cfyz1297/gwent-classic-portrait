import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function leaderIndex(page, faction) {
	return page.card_dict.findIndex((card) => card.row === "leader" && card.deck === faction);
}

function avengerData(page) {
	const data = page.card_dict.find((card) => (card.ability || "").split(" ").includes("avenger"));
	assert.ok(data, "an Avenger card must exist");
	return data;
}

function plainUnit(page) {
	const data = page.card_dict.find((card) => card.row === "close" && card.ability === "" && Number(card.strength) > 0);
	assert.ok(data, "a plain close-combat unit must exist");
	return data;
}

function setup() {
	const { window, page } = boot();
	const deck = (faction) => ({
		faction,
		leader: page.card_dict[leaderIndex(page, faction)],
		cards: []
	});
	const me = new page.Player(0, "Геральт", deck("realms"));
	const op = new page.Player(1, "Соперник", deck("skellige"));
	page.me = me;
	page.op = op;
	me.endTurn = () => {};
	op.endTurn = () => {};
	return { window, page, me, op };
}

/* An Avenger (Cow) summons its replacement from the removed handler. During a
   round clear that spawn used to land after the board was already emptied and
   stayed for the next round, adding its power to that round's score. */
test("an Avenger does not summon into the board while a round is being cleared", async () => {
	const { page, me } = setup();
	const cow = new page.Card(avengerData(page), me);
	const row = page.board.row[3];
	await row.addCard(cow);

	await page.board.clearRound();
	await tick();

	assert.equal(row.cards.length, 0);
	assert.equal(row.elem.querySelectorAll(".card").length, 0);
	assert.equal(me.total, 0, "the round ends at zero, not with a phantom unit");
});

/* The same spawn fired while a game was being reset. The replacement survived
   on the shared row and appeared on the board of the next game. */
test("leaving a game does not leave the Avenger's replacement behind", async () => {
	const { page, op } = setup();
	const cow = new page.Card(avengerData(page), op);
	const row = page.board.row[2];
	await row.addCard(cow);

	page.game.returnToCustomization();
	await tick();

	assert.equal(row.cards.length, 0);
	assert.equal(row.elem.querySelectorAll(".card").length, 0);
});

/* Regression: the rows belong to every game while the players are built anew.
   A card left on a row was therefore inherited, and when the row was cleared
   later its total was subtracted from the fresh score: the opponent went -8. */
test("a new game starts from an empty board and zeroed scores", async () => {
	const { window, page } = setup();
	const stale = new page.Card(plainUnit(page), page.op);
	const row = page.board.row[2];
	await row.addCard(stale);
	assert.ok(page.op.total > 0, "the stale card counts for the old opponent");

	// What DeckMaker.startNewGame does: new players, same shared rows.
	const unit = plainUnit(page);
	const deck = (faction) => ({
		faction,
		leader: page.card_dict[leaderIndex(page, faction)],
		cards: [{ index: page.card_dict.indexOf(unit), count: 15 }]
	});
	const freshMe = new page.Player(0, "Геральт", deck("realms"));
	const freshOp = new page.Player(1, "Соперник", deck("skellige"));
	page.me = freshMe;
	page.op = freshOp;
	page.game.coinToss = async () => { page.game.firstPlayer = freshMe; };
	page.game.initialRedraw = async () => {};
	page.game.startRound = () => {};

	await page.game.startGame();

	assert.equal(row.cards.length, 0, "the stale card is gone");
	assert.equal(freshMe.total, 0);
	assert.equal(freshOp.total, 0);
	assert.equal(window.document.getElementById("score-total-op").children[0].textContent, "0");
});
