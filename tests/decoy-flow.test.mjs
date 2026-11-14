import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function leaderIndex(page, faction) {
	return page.card_dict.findIndex((card) => card.row === "leader" && card.deck === faction);
}

function spyData(page) {
	const data = page.card_dict.find((card) => {
		const ability = (card.ability || "").split(" ");
		return ability.includes("spy") && !ability.includes("hero");
	});
	assert.ok(data);
	return data;
}

function heroData(page) {
	const data = page.card_dict.find((card) => {
		const ability = (card.ability || "").split(" ");
		return ability.includes("hero") && !ability.includes("spy") && card.row === "close";
	});
	assert.ok(data);
	return data;
}

function setup() {
	const { window, page } = boot();
	const me = new page.Player(0, "Player 1", {
		faction: "nilfgaard",
		leader: page.card_dict[leaderIndex(page, "nilfgaard")],
		cards: []
	});
	const op = new page.Player(1, "Player 2", {
		faction: "realms",
		leader: page.card_dict[leaderIndex(page, "realms")],
		cards: []
	});
	page.me = me;
	page.op = op;
	me.endTurn = () => { me.ended = (me.ended || 0) + 1; };
	op.endTurn = () => { op.ended = (op.ended || 0) + 1; };
	return { window, page, me, op };
}

test("the AI decoys a flipped enemy spy instead of leaving it on the board", async () => {
	const { page, me, op } = setup();
	const spy = new page.Card(spyData(page), me);
	// The spy was played by this player and stands on the AI's side.
	spy.holder = op;
	page.board.row[0].addCard(spy);

	const decoy = new page.Card(page.card_dict.find((card) => card.name === "Decoy"), op);
	op.hand.addCard(decoy);

	let actions = 0;
	op.playCardAction = async (card, action) => {
		actions++;
		await action();
	};

	const controller = op.controller;
	await controller.decoy(decoy, controller.getMaximums(), controller.getBoardData());

	assert.equal(actions, 1, "the AI must actually play the Decoy");
	assert.ok(op.hand.cards.includes(spy), "the AI takes the spy into its hand");
	assert.ok(page.board.row[0].cards.includes(decoy), "the Decoy takes the spy's slot");
	assert.equal(page.board.row[0].cards.includes(spy), false);
});

test("the AI does not spend a Decoy when only heroes are available", async () => {
	const { page, op } = setup();
	const hero = new page.Card(heroData(page), op);
	page.board.row[1].addCard(hero);
	const decoy = new page.Card(page.card_dict.find((card) => card.name === "Decoy"), op);
	op.hand.addCard(decoy);

	let actions = 0;
	op.playCardAction = async () => { actions++; };

	const controller = op.controller;
	await controller.decoy(decoy, controller.getMaximums(), controller.getBoardData());

	assert.equal(actions, 0, "no legal target, no play");
	assert.ok(op.hand.cards.includes(decoy));
	assert.ok(page.board.row[1].cards.includes(hero));
	assert.equal(op.ended, 1, "the turn must end instead of hanging on an unplayable Decoy");
});

/* Regression: the AI branch knew only the card and guessed index -1, so a Decoy
   on an ordinary unit was rejected and the turn never ended. The player passed,
   the opponent froze with cards in hand, and the exit button was locked too. */
test("the AI decoys its own ordinary unit and ends the turn", async () => {
	const { page, op } = setup();
	const unitData = page.card_dict.find((card) => card.row === "close" && card.ability === "" && card.count > 0);
	assert.ok(unitData, "a plain close-combat unit must exist");
	const unit = new page.Card(unitData, op);
	await page.board.row[0].addCard(unit);
	const decoy = new page.Card(page.card_dict.find((card) => card.name === "Decoy"), op);
	op.hand.addCard(decoy);

	let actions = 0;
	op.playCardAction = async (card, action) => {
		actions++;
		await action();
		op.endTurn();
	};

	const controller = op.controller;
	await controller.decoy(decoy, controller.getMaximums(), controller.getBoardData());

	assert.equal(actions, 1, "the AI must play the Decoy");
	assert.ok(op.hand.cards.includes(unit), "the unit joins the AI hand");
	assert.ok(page.board.row[0].cards.includes(decoy), "the Decoy takes the unit's slot");
	assert.equal(op.ended, 1, "the turn ends");
});

test("selecting a Decoy without a target explains the rule", () => {
	const { window, page, me } = setup();
	const hints = [];
	window.gwentHint = (text) => hints.push(String(text));
	const decoy = new page.Card(page.card_dict.find((card) => card.name === "Decoy"), me);
	me.hand.addCard(decoy);

	page.ui.showPreview(decoy);
	assert.equal(hints.length, 1);
	assert.match(hints[0], /негеройск/i);
	page.ui.cancel();
});
