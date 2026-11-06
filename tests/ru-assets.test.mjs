import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { projectRoot } from "./helpers/boot.mjs";

const manifestPath = join(projectRoot, "assets-ru", "manifest.json");
const ruDir = join(projectRoot, "assets-ru", "lg");
const enDir = join(projectRoot, "www", "img", "lg");

async function readManifest() {
	return JSON.parse(await readFile(manifestPath, "utf8"));
}

function loadCards() {
	const code = readFileSync(join(projectRoot, "www", "cards.js"), "utf8");
	const context = {};
	vm.createContext(context);
	vm.runInContext(code, context);
	return context.card_dict;
}

test("the Russian set covers most of the card database", async () => {
	const manifest = await readManifest();
	assert.ok(manifest.total >= 200, "expected at least 200 localized faces, got " + manifest.total);
	assert.equal(manifest.total, manifest.cards.length);
	assert.ok(manifest.missing.length <= 3, "too many cards without a Russian face: " + manifest.missing.join(", "));
});

test("every manifest entry points to a real card and a real image", async () => {
	const manifest = await readManifest();
	const cards = loadCards();
	const keys = new Set(cards.map((card) => card && card.deck + "_" + card.filename));
	const seen = new Set();
	for (const entry of manifest.cards) {
		assert.ok(entry.en.endsWith(".jpg"), "unexpected file name: " + entry.en);
		assert.equal(seen.has(entry.en), false, "duplicate target: " + entry.en);
		seen.add(entry.en);
		assert.ok(keys.has(entry.en.replace(/\.jpg$/, "")), "no such card: " + entry.en);
		const info = await stat(join(ruDir, entry.en));
		assert.ok(info.size > 4096, "suspiciously small image: " + entry.en);
		const head = (await readFile(join(ruDir, entry.en))).subarray(0, 3);
		assert.deepEqual(Array.from(head), [0xff, 0xd8, 0xff], "not a JPEG: " + entry.en);
	}
});

test("every leader has a localized face", async () => {
	const manifest = await readManifest();
	const cards = loadCards();
	const localized = new Set(manifest.cards.map((entry) => entry.en));
	for (const card of cards) {
		if (card.row !== "leader") continue;
		assert.ok(localized.has(card.deck + "_" + card.filename + ".jpg"), "leader without Russian art: " + card.name);
	}
});

test("the staged web root replaces the faces but keeps the code", async () => {
	const { stageRuWww } = await import("../scripts/stage-ru-www.mjs");
	const out = await stageRuWww();
	const localized = await readFile(join(out, "img", "lg", "realms_poor_infantry.jpg"));
	const english = await readFile(join(enDir, "realms_poor_infantry.jpg"));
	assert.notDeepEqual(localized, english, "the localized face must differ from the English one");
	const variant = JSON.parse(await readFile(join(out, "variant.json"), "utf8"));
	assert.equal(variant.language, "ru");
	const faces = (await readdir(join(out, "img", "lg"))).filter((name) => name.endsWith(".jpg"));
	assert.ok(faces.length >= 210);
	const page = await readFile(join(out, "index.html"), "utf8");
	assert.ok(page.includes("leader-picker.js"));
});