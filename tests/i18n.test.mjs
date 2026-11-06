import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function text(window, selector) {
	const node = window.document.querySelector(selector);
	return node ? node.textContent.trim() : null;
}

test("static interface labels are Russian", () => {
	const { window } = boot();
	assert.equal(text(window, "#name-op"), "Соперник");
	assert.equal(text(window, "#passed-op"), "Пас");
	assert.equal(text(window, "#passed-me"), "Пас");
	assert.equal(text(window, "#card-bank-title"), "Коллекция");
	assert.equal(text(window, "#card-deck-title"), "Колода");
	assert.equal(text(window, "#start-game"), "Начать игру");
	assert.equal(text(window, "#op-preview-leader p"), "Случайная");
	assert.equal(text(window, "#card-leader > p"), "Лидер");
	assert.match(text(window, "#end-screen table"), /Раунд 1/);
	assert.match(text(window, "#end-screen table"), /Соперник/);
});

test("players get Russian names and faction labels", () => {
	const { window, page } = boot();
	const leader = page.card_dict.find((card) => card.row === "leader" && card.deck === "realms");
	const me = new page.Player(0, "Геральт", { faction: "realms", leader: leader, cards: [] });
	assert.equal(text(window, "#name-me"), "Геральт");
	assert.equal(text(window, "#deck-name-me"), "Северные королевства");
	const op = new page.Player(1, "Соперник", { faction: "nilfgaard", leader: page.card_dict.find((card) => card.row === "leader" && card.deck === "nilfgaard"), cards: [] });
	assert.equal(text(window, "#name-op"), "Соперник");
	assert.equal(text(window, "#deck-name-op"), "Империя Нильфгаард");
	me.reset();
	op.reset();
});
