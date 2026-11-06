import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./helpers/boot.mjs";

test("every build is signed with the committed key so updates install in place", () => {
	const keystore = join(projectRoot, "android", "keystore", "gwent-debug.keystore");
	const info = statSync(keystore);
	assert.ok(info.size > 1024, "keystore must exist");

	const gradle = readFileSync(join(projectRoot, "android", "app", "build.gradle"), "utf8");
	assert.ok(gradle.includes('storeFile file("../keystore/gwent-debug.keystore")'));
	assert.ok(gradle.includes("signingConfig signingConfigs.debug"));
	assert.ok(gradle.includes('versionCode 8'));
});
