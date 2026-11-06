import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { projectRoot, wwwDir } from "./helpers/boot.mjs";

const TEXT_EXT = new Set([".js", ".mjs", ".html", ".json", ".xml", ".gradle", ".md", ".sh", ".yml", ".yaml", ".properties", ".txt", ".cfg", ".pro"]);
const SKIP = new Set(["node_modules", ".git", "build", ".gradle", "artifacts", "tmp"]);

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (SKIP.has(name)) continue;
		const full = join(dir, name);
		const info = statSync(full);
		if (info.isDirectory()) walk(full, out);
		else out.push(full);
	}
	return out;
}

const files = walk(projectRoot).filter((file) => TEXT_EXT.has(extname(file)));
const webScripts = files.filter((file) => file.startsWith(wwwDir) && file.endsWith(".js"));
const webMarkup = join(wwwDir, "index.html");
const manifest = join(projectRoot, "android", "app", "src", "main", "AndroidManifest.xml");
const capacitor = join(projectRoot, "capacitor.config.json");

function read(file) {
	return readFileSync(file, "utf8");
}

test("shipped web scripts contain no dynamic code execution", () => {
	for (const file of webScripts) {
		const code = read(file);
		const name = relative(projectRoot, file);
		assert.equal(/(^|[^.\w])eval\s*\(/.test(code), false, name + " uses eval()");
		assert.equal(/new\s+Function\s*\(/.test(code), false, name + " uses new Function()");
		assert.equal(/document\.write\s*\(/.test(code), false, name + " uses document.write()");
	}
});

test("the page declares a restrictive Content-Security-Policy", () => {
	const html = read(webMarkup);
	const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
	assert.ok(match, "CSP meta tag is missing");
	const policy = match[1];
	for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
		assert.ok(policy.includes(directive), "CSP must include " + directive);
	}
	assert.equal(/script-src[^;]*\*/.test(policy), false, "script-src must not use a wildcard");
	assert.ok(policy.includes("frame-src https://www.youtube.com"), "the music iframe needs an explicit frame-src");
});

test("no cleartext or unexpected remote origins are loaded", () => {
	for (const file of files) {
		if (file.startsWith(wwwDir) && !file.endsWith(".html") && !file.endsWith(".js")) continue;
		if (!file.startsWith(wwwDir)) continue;
		const text = read(file);
		assert.equal(/src\s*=\s*["']http:\/\//i.test(text), false, "cleartext script source in " + relative(projectRoot, file));
	}
	const html = read(webMarkup);
	const remote = Array.from(html.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)).map((m) => m[1]);
	for (const url of remote) {
		assert.ok(url.startsWith("https://www.youtube.com/"), "unexpected remote script: " + url);
	}
});

test("the Android manifest keeps the app offline-first and non-exported", () => {
	const xml = read(manifest);
	assert.ok(xml.includes('android:allowBackup="false"'), "backups must stay off");
	assert.ok(xml.includes('android:usesCleartextTraffic="false"'), "cleartext traffic must stay off");
	const permissions = Array.from(xml.matchAll(/<uses-permission[^>]+android:name="([^"]+)"/g)).map((m) => m[1]);
	assert.deepEqual(permissions, ["android.permission.INTERNET"]);
	const activities = Array.from(xml.matchAll(/<activity[\s\S]*?>/g)).map((m) => m[0]);
	assert.equal(activities.length, 1, "exactly one activity expected");
	assert.ok(activities[0].includes('android:exported="true"'), "the launcher activity must be exported");
	assert.ok(activities[0].includes('android:screenOrientation="portrait"'));
	const providers = Array.from(xml.matchAll(/<provider[\s\S]*?>/g)).map((m) => m[0]);
	for (const provider of providers) {
		assert.ok(provider.includes('android:exported="false"'), "providers must not be exported");
	}
});

test("Capacitor keeps mixed content disabled", () => {
	const config = JSON.parse(read(capacitor));
	assert.equal(config.android.allowMixedContent, false);
	assert.equal(config.webDir, "www");
});

test("the repository contains no obvious credentials", () => {
	const patterns = [
		/AIza[0-9A-Za-z_-]{35}/,
		/gh[pousr]_[A-Za-z0-9]{36}/,
		/github_pat_[A-Za-z0-9_]{22,}/,
		/sk-[A-Za-z0-9]{20,}/,
		/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
		/AKIA[0-9A-Z]{16}/
	];
	for (const file of files) {
		const text = read(file);
		for (const pattern of patterns) {
			assert.equal(pattern.test(text), false, "possible secret in " + relative(projectRoot, file) + " (" + pattern + ")");
		}
	}
});

test("imported deck files are bounded before they are parsed", async () => {
	const rules = await import("../www/rules.js");
	const limits = rules.default || rules;
	assert.ok(limits.MAX_DECK_JSON <= 64 * 1024, "deck JSON limit must stay small");
	assert.ok(limits.MAX_IMPORT_CARDS <= 200);
});
