import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
	const { window, page } = boot();
	const picker = window.document.getElementById("leader-picker");
	assert.ok(picker, "picker element must exist");
	return { window, page, picker };
}

function options(picker) {
	return Array.from(picker.querySelectorAll(".leader-option"));
}

test("the deck editor exposes a leader tile that opens the picker", () => {
	const { page, picker } = setup();
	assert.ok(picker.classList.contains("hide"));
	assert.ok(page.dm.leaders.length >= 2);
	page.dm.selectLeader();
	assert.ok(picker.classList.contains("open"));
	assert.equal(picker.getAttribute("aria-hidden"), "false");
	assert.equal(options(picker).length, page.dm.leaders.length);
});

test("every leader option shows a Russian name, ability text and a badge", () => {
	const { page, picker } = setup();
	page.dm.selectLeader();
	for (const option of options(picker)) {
		assert.ok(option.querySelector(".leader-option-name").textContent.length > 3);
		assert.ok(option.querySelector(".leader-option-ability").textContent.length > 10);
		const badge = option.querySelector(".leader-option-badge").textContent;
		assert.ok(/Активная|Пассивная/.test(badge), "unexpected badge: " + badge);
		assert.ok(option.querySelector(".leader-option-art").style.backgroundImage.includes("img/lg/"));
	}
});

test("tapping a leader stores it for the faction and closes the panel", async () => {
	const { window, page, picker } = setup();
	page.dm.selectLeader();
	const list = options(picker);
	const target = list[list.length - 1];
	const index = Number(target.dataset.index);
	target.click();
	await tick();

	assert.equal(picker.classList.contains("open"), false);
	assert.equal(page.dm.leader.index, index);
	const saved = page.Settings.getFactionSettings("realms").get();
	assert.equal(saved.leader, index, "leader must persist in localStorage");
	assert.equal(window.document.getElementById("leader-name-ru").textContent, target.querySelector(".leader-option-name").textContent);
});

test("the current leader is marked and reopen keeps the selection", () => {
	const { page, picker } = setup();
	page.dm.selectLeader();
	const current = page.dm.leader.index;
	const checked = picker.querySelector('.leader-option[aria-checked="true"]');
	assert.ok(checked);
	assert.equal(Number(checked.dataset.index), current);
	picker.querySelector("#leader-picker-close").click();
	assert.equal(picker.classList.contains("open"), false);
	assert.equal(page.dm.leader.index, current, "closing must not change the leader");
});

test("skellige offers two leaders, one of them passive", async () => {
	const { page, picker } = setup();
	page.dm.loadFactionDeck("skellige");
	await tick();
	page.dm.selectLeader();
	const list = options(picker);
	assert.equal(list.length, 2);
	const badges = list.map((o) => o.querySelector(".leader-option-badge").textContent);
	assert.ok(badges.includes("Пассивная способность"), "Bran must be marked passive");
	const bran = page.dm.leaders.find((entry) => entry.card.ability === "king_bran");
	assert.ok(bran, "King Bran must be listed");
	assert.equal(page.GwentRules.isPassiveLeader(page.ability_dict, bran.card), true);
});

test("Escape closes the picker and restores focus", () => {
	const { window, page, picker } = setup();
	const opener = window.document.getElementById("leader-picker-open");
	assert.ok(opener, "deck editor needs a visible leader button");
	opener.focus();
	opener.click();
	assert.ok(picker.classList.contains("open"));
	window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
	assert.equal(picker.classList.contains("open"), false);
	assert.equal(window.document.activeElement, opener);
});
test("importing a deck refreshes the Russian leader name", async () => {
	const { window, page } = setup();
	const nilfgaardLeader = page.card_dict.findIndex((card) => card.row === "leader" && card.deck === "nilfgaard");
	page.dm.loadPlayerDeck({ faction: "nilfgaard", leader: nilfgaardLeader, cards: [] }, true);
	await tick();
	const label = window.document.getElementById("leader-name-ru").textContent;
	const expected = window.RU.cards[page.card_dict[nilfgaardLeader].name] || page.card_dict[nilfgaardLeader].name;
	assert.equal(label, expected);
	assert.equal(page.dm.leader.index, nilfgaardLeader);
});
