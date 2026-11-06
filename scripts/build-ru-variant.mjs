#!/usr/bin/env node
/* Builds the Russian APK next to the default one.
 *
 *   node scripts/build-ru-variant.mjs
 *
 * The script stages build/www-ru, temporarily switches capacitor.config.json
 * and the Android label/appId to the .ru variant, runs cap sync + Gradle and
 * restores the default tree afterwards. Requires ANDROID_HOME and JDK 21.
 */
import { execFileSync } from "node:child_process";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stageRuWww } from "./stage-ru-www.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_ID = "com.thinkl.gwentclassic.ru";
const APP_NAME = "Гвинт (рус.)";

const configPath = join(root, "capacitor.config.json");
const stringsPath = join(root, "android/app/src/main/res/values/strings.xml");
const gradleDir = join(root, "android");

function run(command, args) {
	const isWindows = process.platform === "win32";
	execFileSync(isWindows ? command + ".cmd" : command, args, {
		stdio: "inherit",
		cwd: root,
		shell: isWindows
	});
}

async function gradle(args) {
	const isWindows = process.platform === "win32";
	const command = join(gradleDir, isWindows ? "gradlew.bat" : "gradlew");
	// Git on Windows does not keep the executable bit, so restore it on POSIX.
	if (!isWindows) await chmod(command, 0o755);
	execFileSync(command, args, { stdio: "inherit", cwd: gradleDir });
}

async function main() {
	const version = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version;
	const originalConfig = await readFile(configPath, "utf8");
	const originalStrings = await readFile(stringsPath, "utf8");
	const config = JSON.parse(originalConfig);

	await stageRuWww();

	config.webDir = "build/www-ru";
	config.appId = APP_ID;
	config.appName = APP_NAME;
	await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");

	await writeFile(stringsPath, [
		"<?xml version='1.0' encoding='utf-8'?>",
		"<resources>",
		'    <string name="app_name">' + APP_NAME + "</string>",
		'    <string name="title_activity_main">' + APP_NAME + "</string>",
		'    <string name="package_name">' + APP_ID + "</string>",
		'    <string name="custom_url_scheme">' + APP_ID + "</string>",
		"</resources>",
		""
	].join("\n"));

	try {
		run("npx", ["cap", "sync", "android"]);
		await gradle(["--no-daemon", "assembleDebug", "-PappId=" + APP_ID]);

		const apk = join(gradleDir, "app/build/outputs/apk/debug/app-debug.apk");
		const artifacts = join(root, "artifacts");
		await mkdir(artifacts, { recursive: true });
		const target = join(artifacts, "gwent-classic-portrait-ru-" + version + "-debug.apk");
		await copyFile(apk, target);
		console.log("Русский APK: " + target);
	} finally {
		await writeFile(configPath, originalConfig);
		await writeFile(stringsPath, originalStrings);
		run("npx", ["cap", "sync", "android"]);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});