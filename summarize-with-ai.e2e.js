import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * Runs the real userscript in Edge on a page whose CSS is written to break an injected UI.
 * The happy-dom suite can't check this: its cascade lets a parent's !important override a
 * child's own rules, and it doesn't retarget events that leave a shadow root. As there, only
 * the userscript manager (GM.*) and the @require'd Readability are stood in, every request
 * is answered locally, and the page's clock is Playwright's.
 */

const SOURCE = readFileSync(
	path.join(path.dirname(fileURLToPath(import.meta.url)), "summarize-with-ai.user.js"),
	"utf-8",
);
const PAGE_URL = "https://example.com/post";
const UI_FONT =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const ARTICLE_TEXT =
	"Central banks raised rates by 50 basis points as inflation hit 6.2 percent. ".repeat(4);

// A 10px root font, fonts forced with !important on every common tag, a stacking context on
// every body child under a fixed banner, and a page element sharing a UI class name.
const HOSTILE_PAGE = `<!doctype html><html><head><title>Rates rise again</title><style>
	html { font-size: 62.5%; }
	body { font-family: Georgia, serif; font-weight: 300; line-height: 2.5; letter-spacing: 3px;
		color: rgb(200, 0, 0); text-transform: uppercase; }
	p, li, strong, button, input, div, span { font-size: 2.4rem !important;
		font-weight: 300 !important; font-family: Georgia, serif !important; line-height: 3 !important; }
	body > * { position: relative; z-index: 1; }
	.banner { position: fixed; z-index: 5; top: 0; left: 0; right: 0; height: 40px; background: navy; }
</style></head><body>
<div class="banner"></div>
<article><h1>Rates rise again</h1><p>${ARTICLE_TEXT}</p><div class="modal-overlay">The page's own modal</div></article>
</body></html>`;

/** Stands in for the userscript manager and Readability; runs in the page before its scripts. */
function installStandIns() {
	const page = /** @type {any} */ (window);
	const store = new Map([["claude_api_key", "sk-test"]]);
	page.GM = {
		/** @param {string} key @param {unknown} fallback */
		getValue: async (key, fallback) => (store.has(key) ? store.get(key) : fallback),
		/** @param {string} key @param {any} value */
		setValue: async (key, value) => {
			store.set(key, value);
		},
		/** @param {any} details */
		xmlHttpRequest: details => {
			const response =
				details.method === "GET"
					? { data: [{ id: "claude-sonnet-4-6" }] }
					: { content: [{ type: "text", text: "<p>Rates <strong>rose</strong> sharply.</p>" }] };
			setTimeout(() => details.onload({ status: 200, statusText: "", response }), 0);
		},
	};
	/** @param {Node} parent @param {string} tag @param {{ textContent: string }} attributes */
	page.GM_addElement = (parent, tag, attributes) => {
		const element = document.createElement(tag);
		element.textContent = attributes.textContent;
		parent.appendChild(element);
		return element;
	};
	page.Readability = class {
		/** @param {Document} doc */
		constructor(doc) {
			this.doc = doc;
		}
		parse() {
			const text = this.doc.querySelector("article")?.textContent?.trim() ?? "";
			return { title: this.doc.title, content: `<p>${text}</p>`, textContent: text };
		}
	};
	page.isProbablyReaderable = () => true;
}

/** Opens the hostile page with the userscript running on it. @param {import("@playwright/test").Page} page */
async function openHostilePage(page) {
	await page.clock.install();
	// Routes registered later win, so only the page itself is served; nothing leaves the machine.
	await page.route("**/*", route => route.abort());
	await page.route(PAGE_URL, route =>
		route.fulfill({ contentType: "text/html", body: HOSTILE_PAGE }),
	);
	await page.addInitScript(installStandIns);
	await page.goto(PAGE_URL);
	await page.addScriptTag({ content: SOURCE });
	await page.clock.runFor(100);
	await expect(page.locator("#summarize-button")).toBeVisible();
}

/** Clicks the S button and lets the summary arrive. @param {import("@playwright/test").Page} page */
async function summarize(page) {
	await page.locator("#summarize-button").click();
	await page.clock.runFor(1000);
	await expect(page.locator(".summary-content-body strong")).toBeVisible();
}

/** @param {import("@playwright/test").Locator} locator @param {Record<string, string>} styles */
async function expectStyles(locator, styles) {
	for (const [property, value] of Object.entries(styles)) {
		await expect(locator).toHaveCSS(property, value);
	}
}

test.use({ colorScheme: "light" });

test.describe("on a page whose CSS fights injected UI", () => {
	test.beforeEach(async ({ page }) => {
		await openHostilePage(page);
	});

	test("the UI keeps its own text styles", async ({ page }) => {
		const base = { "font-family": UI_FONT, "font-size": "16px", "font-weight": "400" };
		const button = page.locator("#summarize-button");
		await expectStyles(button, base);
		await button.press("ArrowUp");
		await expectStyles(page.locator(".model-item").first(), base);
		await page.keyboard.press("Escape");

		await summarize(page);

		await expectStyles(page.locator(".summary-content-body p"), {
			...base,
			"line-height": "24px",
			"letter-spacing": "normal",
			"text-transform": "none",
			color: "rgb(26, 26, 26)",
		});
		await expectStyles(page.locator(".summary-content-body strong"), {
			"font-weight": "600",
			"line-height": "24px",
		});
		await expectStyles(page.locator("#summarize-close"), { ...base, "line-height": "normal" });
		await expectStyles(page.locator("#summarize-question-input"), { "font-size": "16px" });
	});

	test("the open overlay covers the page's fixed banner", async ({ page }) => {
		await summarize(page);

		const topmost = await page.evaluate(() => document.elementFromPoint(5, 20)?.tagName);
		expect(topmost).toBe("SAI-ROOT");
	});

	test("a long press opens the model menu, and a click outside closes it", async ({ page }) => {
		const box = await page.locator("#summarize-button").boundingBox();
		if (!box) throw new Error("the S button has no layout box");
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.clock.runFor(600);
		await page.mouse.up();

		const menu = page.locator("#model-dropdown");
		await expect(menu).toBeVisible();
		await page.mouse.click(200, 300);
		await expect(menu).toBeHidden();
	});

	test("its rules don't reach a page element that shares a class name", async ({ page }) => {
		await expectStyles(page.locator("article .modal-overlay"), {
			position: "static",
			display: "block",
			"font-family": "Georgia, serif",
		});
	});
});
