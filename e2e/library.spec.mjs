import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { smartQuotes } from "../lib/html.js";
import { instagramCode } from "../lib/videos.js";
import { startSite, tagNames, videos } from "./helpers.mjs";

let site;
before(async () => { site = await startSite(); });
after(async () => { await site?.close(); });

const video = videos.find((item) => item.instagram);
const shownTitle = smartQuotes(video.title);
const seriesTag = videos.find((item) => item.series)?.series;
const seriesVideos = videos.filter((item) => item.tags.includes(seriesTag));
const partOrder = [...seriesVideos].sort((a, b) => a.part - b.part).map((item) => item.id);
const videoPath = `/videos/${video.id}/`;
const cards = (page) => page.locator("[data-video-list]").getByRole("listitem");
const shownIds = async (page) => cards(page).getByRole("link").evaluateAll((links) =>
    links.map((link) => new URL(link.href).pathname.split("/").filter(Boolean).at(-1)));
const ids = async (page) => (await shownIds(page)).sort();
const expectedIds = (items) => items.map((item) => item.id).sort();

test("home lists every video and its total", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/");
    assert.deepEqual(await ids(page), expectedIds(videos));
    assert.equal(await page.locator("[data-results]").textContent(), `${videos.length} videos`);
});

test("typing filters, updates the address, and Enter focuses the heading", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/");
    const expected = await cards(page).evaluateAll((items) => items.filter((item) =>
        item.dataset.search.split(" ").some((word) => word.startsWith("portfolio"))).length);
    assert.ok(expected > 0 && expected < videos.length);
    const input = page.getByRole("searchbox", { name: "Search videos" });
    await input.pressSequentially("portfolio");
    assert.equal(await cards(page).count(), expected);
    assert.equal(await page.locator("[data-results]").textContent(), `${expected} of ${videos.length} videos match “portfolio”`);
    assert.equal(new URL(page.url()).searchParams.get("q"), "portfolio");
    await input.press("Enter");
    assert.equal(await page.locator("#listing-heading").evaluate((node) => node === document.activeElement), true);
});

test("deep links restore search and order through directory redirects", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/?q=portfolio&sort=oldest");
    assert.equal(await page.getByRole("searchbox").inputValue(), "portfolio");
    assert.equal(await page.getByRole("combobox", { name: "Sort" }).inputValue(), "oldest");
    const order = await cards(page).evaluateAll((items) => items.map((item) => Number(item.dataset.order)));
    assert.ok(order.length > 1 && order.length < videos.length);
    assert.deepEqual(order, [...order].sort((a, b) => b - a));

    // The series tag page opens oldest first, so ?sort=oldest is its plain address.
    await page.goto(`/tags/${seriesTag}?sort=oldest`);
    assert.equal(new URL(page.url()).pathname, `/tags/${seriesTag}/`);
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.getByRole("combobox", { name: "Sort" }).inputValue(), "oldest");
    assert.deepEqual(await shownIds(page), partOrder);

    await page.goto(`/tags/${seriesTag}?sort=newest`);
    assert.equal(new URL(page.url()).pathname, `/tags/${seriesTag}/`);
    assert.equal(new URL(page.url()).search, "?sort=newest");
    assert.equal(await page.getByRole("combobox", { name: "Sort" }).inputValue(), "newest");
    assert.deepEqual(await shownIds(page), [...partOrder].reverse());
});

test("the series tag page starts at Part 1 with and without JavaScript", async (t) => {
    for (const javaScriptEnabled of [true, false]) {
        const { page } = await site.page(t, { javaScriptEnabled });
        await page.goto(`/tags/${seriesTag}/`);
        assert.deepEqual(await shownIds(page), partOrder, `JavaScript ${javaScriptEnabled ? "on" : "off"}`);
        assert.equal(new URL(page.url()).search, "");
    }
});

test("clearing the input and the empty-results link restore all videos", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/?q=portfolio");
    const input = page.getByRole("searchbox");
    await input.fill("");
    assert.deepEqual(await ids(page), expectedIds(videos));
    assert.equal(new URL(page.url()).searchParams.has("q"), false);
    await input.fill("zzzz-no-matching-video");
    assert.equal(await cards(page).count(), 0);
    await page.locator("[data-clear-search]").click();
    assert.equal(await input.inputValue(), "");
    assert.deepEqual(await ids(page), expectedIds(videos));
    assert.equal(await page.locator("[data-results]").textContent(), `${videos.length} videos`);
    assert.equal(new URL(page.url()).searchParams.has("q"), false);
});

test("without JavaScript every video remains linked and search stays hidden", async (t) => {
    const { page } = await site.page(t, { javaScriptEnabled: false });
    await page.goto("/");
    assert.deepEqual(await ids(page), expectedIds(videos));
    assert.equal(await page.locator("[data-search-form]").isVisible(), false);
});

test("tag index includes every tag and count, and Career Quest has exactly its videos", async (t) => {
    const { page } = await site.page(t);
    const tags = [...new Set(videos.flatMap((item) => item.tags))];
    await page.goto("/tags/");
    const main = page.getByRole("main");
    assert.equal(await main.getByRole("link").count(), tags.length);
    for (const slug of tags) {
        const name = tagNames[slug] ?? slug[0].toUpperCase() + slug.slice(1).replaceAll("-", " ");
        const link = main.getByRole("link", { name, exact: true });
        assert.equal(await link.getAttribute("href"), `${slug}/`);
        const count = videos.filter((item) => item.tags.includes(slug)).length;
        const row = main.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });
        assert.match(await row.textContent(), new RegExp(`\\b${count} video${count === 1 ? "" : "s"}\\b`));
    }
    assert.ok(seriesVideos.length > 0);
    assert.equal((await page.goto(`/tags/${seriesTag}/`)).status(), 200);
    assert.deepEqual(await ids(page), expectedIds(seriesVideos));
});

test("Instagram embed expands as a modal and Escape restores focus", async (t) => {
    const { page } = await site.page(t);
    await page.goto(`${videoPath}?source=instagram`);
    const code = instagramCode(video.instagram);
    const frame = page.getByTitle(`${shownTitle} (Instagram)`, { exact: true });
    const embed = new URL(await frame.getAttribute("src"));
    assert.equal(embed.hostname, "www.instagram.com");
    assert.equal(embed.pathname, `/p/${code}/embed/`);
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    assert.equal(await page.getByRole("dialog", { name: shownTitle }).getAttribute("aria-modal"), "true");
    assert.equal(await page.locator("[data-copy-status]").evaluate((node) => node.closest("[inert]") !== null), true);
    for (let step = 0; step < 3; step++) {
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => {
            const focused = document.activeElement;
            return focused === null || focused === document.body || document.querySelector("[data-player]").contains(focused);
        }), true, "focus reached the page behind the open player");
    }
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator("[data-player]").getAttribute("aria-modal"), null);
    assert.equal(await page.locator("[data-copy-status]").evaluate((node) => node.closest("[inert]") !== null), false);
    const expand = page.getByRole("button", { name: "Expand", exact: true });
    assert.equal(await expand.evaluate((node) => node === document.activeElement), true);

    await expand.click();
    await page.locator("[data-player]").click({ position: { x: 4, y: 4 } });
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await expand.evaluate((node) => node === document.activeElement), true);
});

test("Copy link writes the current URL and announces success", async (t) => {
    const { page } = await site.page(t, { permissions: ["clipboard-read", "clipboard-write"] });
    await page.goto(`${videoPath}?source=instagram`);
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("[data-copy-status]").textContent === "Link copied");
    assert.equal(await page.locator("[data-copy-status]").textContent(), "Link copied");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), page.url());
});

test("on a phone the link button opens the share sheet, and closing it copies nothing", async (t) => {
    const { page } = await site.page(t, { isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
        window.shareCalls = [];
        window.copied = [];
        window.shareAnswer = "cancel";
        Object.defineProperty(navigator, "share", {
            configurable: true,
            value: async (data) => {
                window.shareCalls.push(data);
                if (window.shareAnswer === "cancel") {
                    throw new DOMException("Share canceled", "AbortError");
                }
            }
        });
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: async (text) => { window.copied.push(text); } }
        });
    });
    await page.goto("/?q=portfolio");
    const button = page.locator("[data-copy-link]");
    const status = page.locator("[data-copy-status]");
    assert.equal(await button.textContent(), "Share");

    await button.click();
    await page.waitForFunction(() => window.shareCalls.length === 1);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    assert.deepEqual(await page.evaluate(() => window.copied), []);
    assert.equal(await button.textContent(), "Share");
    assert.equal(await status.textContent(), "");

    await page.evaluate(() => { window.shareAnswer = "share"; });
    await button.click();
    await page.waitForFunction(() => document.querySelector("[data-copy-status]").textContent === "Link shared");
    assert.equal(await button.textContent(), "Link shared");
    const shared = await page.evaluate(() => window.shareCalls.map((call) => call.url));
    assert.deepEqual(shared, [page.url(), page.url()]);
    assert.equal(new URL(page.url()).searchParams.get("q"), "portfolio");
    assert.deepEqual(await page.evaluate(() => window.copied), []);
});

test("the back link returns to the search that led to the video, even after the skip link", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/?q=portfolio");
    const results = page.url();
    await cards(page).first().getByRole("link").click();
    await page.waitForURL(/\/videos\/[\w-]+\/$/);
    const back = page.locator("[data-back]");
    assert.equal(await back.textContent(), "Back to results");
    const length = await page.evaluate(() => history.length);

    // A plain click goes back in the history rather than adding a page.
    await back.click();
    await page.waitForURL(results);
    assert.equal(await page.evaluate(() => history.length), length);
    assert.equal(await page.getByRole("searchbox").inputValue(), "portfolio");

    // The skip link adds #main to the history; going back from there would
    // only drop the #main, so the link is followed instead.
    await page.goForward();
    await page.getByRole("link", { name: "Skip to content" }).press("Enter");
    await page.waitForURL(/#main$/);
    await back.click();
    await page.waitForURL(results);
    assert.equal(await page.getByRole("searchbox").inputValue(), "portfolio");
});

test("a second click on the back link while leaving goes back only once", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/tags/");
    await page.goto("/?q=portfolio");
    const results = page.url();
    await cards(page).first().getByRole("link").click();
    await page.waitForURL(/\/videos\/[\w-]+\/$/);
    await page.locator("[data-back]").evaluate((link) => {
        link.click();
        link.click();
    });
    await page.waitForURL(results);
    await page.waitForLoadState();
    assert.equal(page.url(), results);
});

test("the back link names the tag page it returns to, and links home when opened directly", async (t) => {
    const { page } = await site.page(t);
    await page.goto(`/tags/${seriesTag}/`);
    await page.locator(`[data-video-list] a[href$="/videos/${partOrder[0]}/"]`).click();
    await page.waitForURL(`**/videos/${partOrder[0]}/`);
    const back = page.locator("[data-back]");
    assert.equal(await back.textContent(), `Back to ${tagNames[seriesTag]}`);
    assert.equal(await back.evaluate((link) => link.href), `${site.origin}/tags/${seriesTag}/`);

    await page.goto(videoPath);
    assert.equal(await back.textContent(), "All videos");
    assert.equal(await back.evaluate((link) => link.href), `${site.origin}/`);
});

test("a Cmd or Ctrl+click on the back link opens it in a new tab and leaves this one", async (t) => {
    const { page, context } = await site.page(t);
    await page.goto("/?q=portfolio");
    const results = page.url();
    await cards(page).first().getByRole("link").click();
    await page.waitForURL(/\/videos\/[\w-]+\/$/);
    const here = page.url();
    const length = await page.evaluate(() => history.length);

    const opened = context.waitForEvent("page", { timeout: 5000 });
    await page.locator("[data-back]").click({ modifiers: ["ControlOrMeta"] });
    const tab = await opened;
    await tab.waitForLoadState();
    assert.equal(tab.url(), results);
    assert.equal(page.url(), here);
    assert.equal(await page.evaluate(() => history.length), length);
});

test("a video opened in a new tab from the results links back to them", async (t) => {
    const { page, context } = await site.page(t);
    await page.goto("/?q=portfolio");
    const results = page.url();
    const opened = context.waitForEvent("page", { timeout: 5000 });
    await cards(page).first().getByRole("link").click({ modifiers: ["ControlOrMeta"] });
    const tab = await opened;
    tab.setDefaultTimeout(5000);
    await tab.waitForURL(/\/videos\/[\w-]+\/$/);
    const back = tab.locator("[data-back]");
    assert.equal(await back.textContent(), "Back to results");

    // The new tab has nothing to go back to, so the link is followed.
    await back.click();
    await tab.waitForURL(results);
    assert.equal(await tab.getByRole("searchbox").inputValue(), "portfolio");
});

test("a blocked Instagram player says so above the frame, with a link to the reel", async (t) => {
    const { page } = await site.page(t);
    await page.clock.install();
    await page.goto(videoPath);
    const status = page.locator("[data-player-status]");
    const frame = page.getByTitle(`${shownTitle} (Instagram)`, { exact: true });
    assert.equal(await status.count(), 0);

    // Instagram is blocked in these tests, so no message comes within 10 seconds.
    await page.clock.fastForward(10_500);
    await status.waitFor({ state: "visible" });
    assert.match(await status.textContent(), /may be blocked/);
    assert.equal(await status.evaluate((node) =>
        Boolean(node.compareDocumentPosition(document.querySelector("[data-player] iframe")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    const [statusBox, frameBox] = [await status.boundingBox(), await frame.boundingBox()];
    assert.ok(statusBox.y + statusBox.height <= frameBox.y, "the message sits above the video");
    assert.ok(statusBox.y + statusBox.height <= page.viewportSize().height, "the message is on the first screen");
    const link = new URL(await status.getByRole("link", { name: "Watch on Instagram" }).getAttribute("href"));
    assert.equal(link.href, `https://www.instagram.com/p/${instagramCode(video.instagram)}/`);
    assert.equal(await frame.count(), 1);
});

test("Instagram messages sent before the page's script runs still reach the player", async (t) => {
    const { page, context } = await site.page(t);
    // Instagram's player posts its height as soon as it loads...
    await context.route("https://www.instagram.com/**", (route) => route.fulfill({
        contentType: "text/html",
        body: "<script>parent.postMessage(JSON.stringify({ type: \"MEASURE\", details: { height: 640 } }), \"*\");</script>"
    }));
    // ...and the page's player script arrives only after that message.
    await context.route("**/js/player.js", async (route) => {
        await page.waitForFunction(() => window.instagramMessages?.length > 0, null, { polling: 50 }).catch(() => {});
        await route.continue();
    });
    await page.goto(videoPath);
    await page.waitForFunction(() => document.querySelector("[data-player]").dataset.state === "ready");
    assert.equal(await page.locator("[data-player] iframe").evaluate((frame) => frame.style.height), "640px");
});

test("unknown paths serve the 404 page with a working home link", async (t) => {
    const { page } = await site.page(t);
    const response = await page.goto("/missing/nested/page");
    assert.equal(response.status(), 404);
    assert.equal(await page.getByRole("heading", { name: "Page not found" }).count(), 1);
    await page.getByRole("link", { name: "See all videos", exact: true }).click();
    assert.equal(page.url(), `${site.origin}/`);
});

for (const route of ["/", "/tags/", `/tags/${seriesTag}/`, videoPath]) {
    test(`no page or console errors on ${route}`, async (t) => {
        const { page, aborted } = await site.page(t);
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "error" && !(aborted.has(message.location().url)
                && /net::ERR_FAILED|net::ERR_ABORTED/.test(message.text()))) {
                errors.push(message.text());
            }
        });
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        assert.deepEqual(errors, []);
    });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    for (const route of ["/", "/tags/", videoPath]) {
        test(`no horizontal overflow at ${viewport.width}x${viewport.height} on ${route}`, async (t) => {
            const { page } = await site.page(t, { viewport });
            await page.goto(route);
            await page.evaluate(() => document.fonts.ready);
            const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
            assert.ok(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions));
        });
    }
}
