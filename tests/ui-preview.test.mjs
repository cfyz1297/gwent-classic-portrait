import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

function leader(page, deck) {
	return page.card_dict.find((card) => card.row === "leader" && card.deck === deck);
}

test("unit previews use the art-only face, leaders the printed face", () => {
	const { window, page } = boot();
	const me = new page.Player(0, "Геральт", { faction: "realms", leader: leader(page, "realms"), cards: [] });
	page.me = me;

	const unit = new page.Card(page.card_dict.find((card) => card.name === "Prince Stennis"), me);
	page.ui.showPreviewVisuals(unit);
	let art = window.document.querySelector(".card-preview .card-lg").style.backgroundImage;
	assert.ok(art.includes("img/sm/"), "unit preview must use the small art: " + art);

	const lead = new page.Card(leader(page, "realms"), me);
	page.ui.showPreviewVisuals(lead);
	art = window.document.querySelector(".card-preview .card-lg").style.backgroundImage;
	assert.ok(art.includes("img/lg/"), "leader preview keeps the full face: " + art);
});
