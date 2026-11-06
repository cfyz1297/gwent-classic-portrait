#!/usr/bin/env node
/* Stages the Russian web root: a copy of www/ with the localized card faces
 * from assets-ru/lg. The build script points Capacitor at build/www-ru. */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "build", "www-ru");

export async function stageRuWww() {
	await rm(out, { recursive: true, force: true });
	await mkdir(out, { recursive: true });
	await cp(join(root, "www"), out, { recursive: true });
	await cp(join(root, "assets-ru", "lg"), join(out, "img", "lg"), { recursive: true, force: true });
	await writeFile(join(out, "variant.json"), JSON.stringify({
		language: "ru",
		cards: "assets-ru",
		appId: "com.thinkl.gwentclassic.ru"
	}, null, 2) + "\n");
	return out;
}

const invokedDirectly = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/stage-ru-www.mjs");
if (invokedDirectly) {
	stageRuWww().then((dir) => console.log("Русский web-root: " + dir)).catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
