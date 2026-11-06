import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));
export const projectRoot = join(here, "..", "..");
export const wwwDir = join(projectRoot, "www");

/* Load order must match index.html: rules.js comes before portrait.js, the
   leader picker after portrait-ui.js. */
export const SCRIPTS = [
	"ru.js",
	"common.js",
	"cards.js",
	"decks.js",
	"abilities.js",
	"factions.js",
	"rules.js",
	"portrait.js",
	"gwent.js",
	"portrait-ui.js",
	"leader-picker.js"
];

/* Classic scripts share one global scope. Top-level const/class bindings live
   in the global lexical environment, so the page must be evaluated once;
   separate evals would each get a private scope. */
const BRIDGE = [
	"",
	";(function () {",
	"	window.__gwent = {",
	"		GwentRules: GwentRules,",
	"		Card: Card,",
	"		Row: Row,",
	"		Player: Player,",
	"		DeckMaker: DeckMaker,",
	"		Controller: Controller,",
	"		ControllerAI: ControllerAI,",
	"		board: board,",
	"		weather: weather,",
	"		ui: ui,",
	"		game: game,",
	"		dm: dm,",
	"		card_dict: card_dict,",
	"		ability_dict: ability_dict,",
	"		factions: factions,",
	"		Settings: Settings,",
	"		get me() { return player_me; },",
	"		set me(value) { player_me = value; },",
	"		get op() { return player_op; },",
	"		set op(value) { player_op = value; }",
	"	};",
	"})();",
	""
].join("\n");

function stubMedia(window) {
	const proto = window.HTMLMediaElement.prototype;
	proto.play = function () { return Promise.resolve(); };
	proto.pause = function () {};
	proto.load = function () {};
	if (typeof window.Audio !== "function") {
		window.Audio = function () {
			return window.document.createElement("audio");
		};
	}
}

/* Boots the real page (index.html + every script) inside jsdom. Animations and
   sound are stubbed so a test can drive the game logic synchronously. */
export function boot(options = {}) {
	const html = readFileSync(join(wwwDir, "index.html"), "utf8");
	const dom = new JSDOM(html, {
		url: "http://localhost/",
		pretendToBeVisual: true,
		runScripts: "outside-only"
	});
	const window = dom.window;

	stubMedia(window);
	window.alert = options.alert || (() => {});
	window.confirm = options.confirm || (() => true);
	window.scrollTo = () => {};
	window.document.documentElement.classList.add("gwent-portrait");

	// The real iframe API never loads inside jsdom.
	window.YT = window.YT || {};
	window.YT.PlayerState = { PLAYING: 1, PAUSED: 2, ENDED: 0 };
	window.YT.Player = window.YT.Player || function () {
		this.playVideo = function () {};
		this.pauseVideo = function () {};
		this.getPlayerState = function () { return 0; };
	};
	window.onYouTubeIframeAPIReady = () => {};

	const source = SCRIPTS
		.map((file) => "/* ==== " + file + " ==== */\n" + readFileSync(join(wwwDir, file), "utf8"))
		.join("\n;\n") + "\n" + BRIDGE;

	try {
		window.eval(source);
	} catch (err) {
		const wrapped = new Error("page boot failed: " + String(err && err.stack || err));
		wrapped.cause = err;
		throw wrapped;
	}

	// Animations: no waiting, no layout math in jsdom.
	window.sleep = () => Promise.resolve();
	window.translateTo = async () => {};
	if (window.AudioManager) {
		window.AudioManager.play = async () => {};
		window.AudioManager.playSFX = async () => {};
		window.AudioManager.init = () => {};
	}

	return { dom, window, page: window.__gwent };
}
