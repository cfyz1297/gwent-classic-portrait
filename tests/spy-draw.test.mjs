import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function leader(page, deck) {
	return page.card_dict.find((card) => card.row === "leader" && card.deck === deck);
}

function spyData(page) {
	return page.card_dict.find((card) => {
		const ability = (card.ability || "").split(" ");
		return ability.includes("spy") && !ability.includes("hero");
	});
}

function unitData(page, index) {
	const units = page.card_dict.filter((card) => card.row !== "leader" && Number(card.count) > 0 && card.deck !== "special" && card.deck !== "weather");
	return units[index];
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

test("a played spy shows the two drawn cards for a moment", async () => {
	const { window, page, me } = setup();
	me.deck.addCard(new page.Card(unitData(page, 0), me));
	me.deck.addCard(new page.Card(unitData(page, 1), me));

	const spy = new page.Card(spyData(page), me);
	me.hand.addCard(spy);
	await me.playCard(spy);

	assert.equal(me.hand.cards.length, 2, "spy drew two cards into an empty hand");
	const host = window.document.getElementById("drawn-cards");
	assert.ok(host, "the preview must exist");
	assert.equal(host.classList.contains("hide"), false, "the preview is visible");
	assert.equal(host.querySelectorAll(".drawn-card").length, 2);
	assert.match(host.querySelector("p").textContent, /Вы взяли/);
	const bg = host.querySelector(".drawn-card").style.backgroundImage;
	assert.ok(bg.includes("img/lg/"), "the preview uses the full card face");
});

test("the opponent's spy does not open the preview", async () => {
	const { window, page, op } = setup();
	op.deck.addCard(new page.Card(unitData(page, 0), op));
	op.deck.addCard(new page.Card(unitData(page, 1), op));
	const spy = new page.Card(spyData(page), op);
	op.hand.addCard(spy);
	await op.playCard(spy);
	const host = window.document.getElementById("drawn-cards");
	assert.ok(!host || host.classList.contains("hide"), "no preview for the AI draw");
});