#!/usr/bin/env node
/* Builds the Russian card-face set from an extracted duskworld/diablo1 archive.
 *
 *   node scripts/import-ru-cards.mjs --from tmp/cards [--out assets-ru]
 *
 * Matching is done by perceptual hash of the illustration area, not by file
 * names: the archive numbers its files per faction (sev_1, nilf_7, ...) while
 * the game keys art by <deck>_<filename>. Every archive image is compared with
 * the English faces in www/img/lg and the closest one wins; duplicates keep the
 * lowest distance. Alternative Ballad Heroes art (...a.png) is skipped because
 * the base illustration is already present.
 */
import sharp from "sharp";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
	const index = process.argv.indexOf("--" + name);
	return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const sourceDir = join(root, arg("from", "tmp/cards"));
const outDir = join(root, arg("out", "assets-ru"));
const lgDir = join(root, "www/img/lg");
const threshold = Number(arg("threshold", "60"));
const JPEG_QUALITY = 86;

function loadCards() {
	const code = readFileSync(join(root, "www/cards.js"), "utf8");
	const context = {};
	vm.createContext(context);
	vm.runInContext(code, context);
	return context.card_dict;
}

const cardDict = loadCards();
const known = new Set();
for (const card of cardDict) {
	if (!card || !card.deck || !card.filename) continue;
	known.add(card.deck + "_" + card.filename);
}

async function dHash(file, crop) {
	const image = sharp(file).rotate();
	const meta = await image.metadata();
	const left = Math.round(meta.width * crop.x0);
	const top = Math.round(meta.height * crop.y0);
	const width = Math.round(meta.width * (crop.x1 - crop.x0));
	const height = Math.round(meta.height * (crop.y1 - crop.y0));
	const raw = await image
		.extract({ left, top, width, height })
		.resize(17, 16, { fit: "fill" })
		.greyscale()
		.raw()
		.toBuffer();
	let bits = "";
	for (let y = 0; y < 16; y++) {
		for (let x = 0; x < 16; x++) {
			bits += raw[y * 17 + x] > raw[y * 17 + x + 1] ? "1" : "0";
		}
	}
	return bits;
}

function distance(a, b) {
	let d = 0;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
	return d;
}

async function walk(dir, prefix = "") {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const rel = prefix ? prefix + "/" + entry.name : entry.name;
		if (entry.isDirectory()) out.push(...(await walk(join(dir, entry.name), rel)));
		else if (entry.name.toLowerCase().endsWith(".png")) out.push(rel);
	}
	return out;
}

const CROP_EN = { x0: 0.18, x1: 0.92, y0: 0.02, y1: 0.72 };
const CROP_RU = { x0: 0.18, x1: 0.92, y0: 0.02, y1: 0.70 };

async function main() {
	if (!existsSync(sourceDir)) {
		console.error("Нет каталога с картинками: " + sourceDir);
		console.error("Распакуйте архив cards.rar и передайте --from <каталог>.");
		process.exit(2);
	}

	const englishFiles = (await readdir(lgDir)).filter((name) => name.endsWith(".jpg"));
	const english = [];
	for (const name of englishFiles) {
		if (!known.has(name.replace(/\.jpg$/, ""))) continue;
		english.push({ name, hash: await dHash(join(lgDir, name), CROP_EN) });
	}

	const files = (await walk(sourceDir)).filter((file) => !file.startsWith("Обложки для карт"));
	const candidates = [];
	const skipped = [];

	for (const file of files) {
		const base = file.split("/").pop();
		// Ballad Heroes alternative art: the base illustration is already in the set.
		if (/a\.png$/i.test(base) && file.startsWith("Нейтральные карты/")) {
			skipped.push({ file, reason: "alternative-art" });
			continue;
		}
		const hash = await dHash(join(sourceDir, file), CROP_RU);
		let best = null;
		for (const item of english) {
			const d = distance(hash, item.hash);
			if (!best || d < best.distance) best = { name: item.name, distance: d };
		}
		if (!best || best.distance > threshold) {
			skipped.push({ file, reason: "no-match", distance: best ? best.distance : null });
			continue;
		}
		candidates.push({ file, source: join(sourceDir, file), target: best.name, distance: best.distance });
	}

	// One Russian image per English card: keep the closest match, prefer plain
	// file names over ...a variants.
	candidates.sort((a, b) => a.distance - b.distance || a.file.localeCompare(b.file));
	const chosen = new Map();
	for (const candidate of candidates) {
		if (chosen.has(candidate.target)) continue;
		chosen.set(candidate.target, candidate);
	}

	const outLg = join(outDir, "lg");
	await mkdir(outLg, { recursive: true });

	const cards = [];
	for (const [target, candidate] of [...chosen.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		const jpeg = await sharp(candidate.source)
			.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
			.toBuffer();
		await writeFile(join(outLg, target), jpeg);
		const base = target.replace(/\.jpg$/, "");
		const deck = base.slice(0, base.indexOf("_"));
		cards.push({
			en: target,
			ru: candidate.file,
			deck,
			filename: base.slice(deck.length + 1),
			distance: candidate.distance
		});
	}

	const missing = cardDict
		.filter((card) => card && card.deck && card.filename && card.deck !== "faction")
		.map((card) => card.deck + "_" + card.filename + ".jpg")
		.filter((name, index, list) => list.indexOf(name) === index && !chosen.has(name));

	const manifest = {
		source: "duskworld.ru / diablo1.ru card archive",
		matching: "perceptual hash of the illustration area",
		threshold,
		total: cards.length,
		cards,
		missing,
		skipped
	};
	await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

	console.log("Карточек перенесено: " + cards.length);
	console.log("Без русской картинки: " + missing.length + " (" + missing.slice(0, 8).join(", ") + ")");
	console.log("Пропущено: " + skipped.length);
	console.log("Среднее расстояние: " + (cards.reduce((a, c) => a + c.distance, 0) / cards.length).toFixed(1));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});