import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { boot, wwwDir } from "./helpers/boot.mjs";

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
