import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function leader(page, deck) {
	return page.card_dict.find((card) => card.row === "leader" && card.deck === deck);
}

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
