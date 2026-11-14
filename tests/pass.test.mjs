import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { boot, wwwDir } from "./helpers/boot.mjs";

function leader(page, deck) {
	return page.card_dict.find((card) => card.row === "leader" && card.deck === deck);
}

/* An AI with an empty hand still weighs its leader. Eredin King reports -1 when
   no weather card is left in the deck, Francesca Hope -1 without agile units.
   The weighted pick then ran past the end of the list, the AI threw, and the
   board stayed locked on its turn with no pass badge. */
for (const name of ["Eredin - King of the Wild Hunt", "Francesca Findabair - Hope of the Aen Seidhe"]) {
	test(`an AI with no cards and a wasted ${name} passes instead of throwing`, async () => {
		const { page } = boot();
		const leaderData = page.card_dict.find((card) => card.name === name);
		assert.ok(leaderData, name + " must exist");
		const me = new page.Player(0, "Геральт", { faction: "realms", leader: leader(page, "realms"), cards: [] });
		const op = new page.Player(1, "Соперник", { faction: leaderData.deck, leader: leaderData, cards: [] });
		page.me = me;
		page.op = op;
		me.setPassed(true);            // the human already passed
		op.health = 1;                 // weightPass() is 0 on the last life
		op.leaderAvailable = true;
		page.game.currPlayer = op;
		page.game.roundCount = 2;
		let ended = 0;
		op.endTurn = () => { ended++; };

		await op.controller.startTurn(op);

		assert.equal(op.passed, true, "the AI must pass");
		assert.equal(ended, 1, "the turn must end exactly once");
	});
}

/* Any exception in the AI turn used to leave the board locked forever: nobody
   passed, the human could not act, and the match was dead. */
test("an AI error ends its turn instead of freezing the match", async () => {
	const { page } = boot();
	const me = new page.Player(0, "Геральт", { faction: "realms", leader: leader(page, "realms"), cards: [] });
	const op = new page.Player(1, "Соперник", { faction: "nilfgaard", leader: leader(page, "nilfgaard"), cards: [] });
	page.me = me;
	page.op = op;
	op.controller.startTurn = async () => { throw new Error("boom"); };
	let ended = 0;
	op.endTurn = () => { ended++; };
	const origError = console.error;
	console.error = () => {};
	try {
		await op.startTurn();
	} finally {
		console.error = origError;
	}
	assert.equal(op.passed, true, "the AI passes after a failure");
	assert.equal(ended, 1, "the turn is handed back");
});

test("a passed player is marked in the HUD and on their half of the board", () => {
	const { window, page } = boot();
	const me = new page.Player(0, "Геральт", { faction: "realms", leader: leader(page, "realms"), cards: [] });
	const op = new page.Player(1, "Соперник", { faction: "nilfgaard", leader: leader(page, "nilfgaard"), cards: [] });
	page.me = me;
	page.op = op;

	const badge = window.document.getElementById("passed-op");
	const field = window.document.getElementById("field-op");
	assert.equal(badge.classList.contains("passed"), false);
	assert.equal(field.classList.contains("side-passed"), false);

	op.setPassed(true);
	assert.equal(badge.classList.contains("passed"), true);
	assert.equal(field.classList.contains("side-passed"), true);

	op.setPassed(false);
	assert.equal(badge.classList.contains("passed"), false);
	assert.equal(field.classList.contains("side-passed"), false);
});

/* main.noclick blocks pointer events for the whole board, including the exit
   button, during every AI turn. When a turn never came back the game could not
   be left at all. */
test("the exit button stays clickable while the board is locked", () => {
	const { window } = boot();
	const main = window.document.querySelector("main");
	main.classList.add("noclick");
	const exit = window.document.getElementById("exit-game");
	assert.ok(main.contains(exit), "exit lives inside the locked main");

	const css = readFileSync(join(wwwDir, "portrait.css"), "utf8");
	assert.match(css, /main\.noclick #exit-game\s*\{[^}]*pointer-events:\s*auto/,
		"portrait.css must re-enable pointer events for the exit button");
});
