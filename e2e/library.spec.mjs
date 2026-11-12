import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { smartQuotes } from "../lib/html.js";
import { libraryLine } from "../lib/site.js";
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
    assert.equal(await page.locator("[data-results]").textContent(), libraryLine(videos));
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
    assert.equal(await page.getByRole("combobox", { name: "Order" }).inputValue(), "oldest");
    const order = await cards(page).evaluateAll((items) => items.map((item) => Number(item.dataset.order)));
    assert.ok(order.length > 1 && order.length < videos.length);
    assert.deepEqual(order, [...order].sort((a, b) => b - a));

    // A topic page keeps its order in the address too.
    await page.goto("/tags/portfolio?sort=oldest");
    assert.equal(new URL(page.url()).pathname, "/tags/portfolio/");
    assert.equal(new URL(page.url()).search, "?sort=oldest");
    assert.equal(await page.getByRole("combobox", { name: "Order" }).inputValue(), "oldest");
    assert.equal(await page.getByRole("heading", { level: 2 }).first().textContent(), "Oldest first");

    // The series is always in part order: no order menu, and a ?sort= is dropped.
    for (const sort of ["oldest", "newest"]) {
        await page.goto(`/tags/${seriesTag}?sort=${sort}`);
        assert.equal(new URL(page.url()).pathname, `/tags/${seriesTag}/`);
        assert.equal(new URL(page.url()).search, "", sort);
        assert.equal(await page.getByRole("combobox").count(), 0, sort);
        assert.deepEqual(await shownIds(page), partOrder, sort);
    }
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
    assert.equal(await page.locator("[data-results]").textContent(), libraryLine(videos));
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
    // Close comes before the video, so Tab can leave focus inside the
    // cross-origin frame, where no page sees Escape. Tab on to Close.
    const close = page.getByRole("button", { name: "Close", exact: true });
    for (let step = 0; step < 5 && !(await close.evaluate((node) => node === document.activeElement)); step++) {
        await page.keyboard.press("Tab");
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
    // The new tab starts on about:blank; wait for it to reach the results.
    await tab.waitForURL(results);
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

// Above the frame on a phone; from 700 px under the head's buttons, beside it.
for (const { viewport, place, isMobile = false } of [
    { viewport: { width: 1280, height: 800 }, place: "beside" },
    { viewport: { width: 390, height: 844 }, place: "above", isMobile: true }
]) {
    test(`a blocked Instagram player says so with the controls, ${place} the frame at ${viewport.width}x${viewport.height}, with a link to the reel`, async (t) => {
        const { page } = await site.page(t, { viewport, isMobile, hasTouch: isMobile });
        await page.clock.install();
        await page.goto(videoPath);
        const status = page.locator("[data-player-status]");
        const frame = page.getByTitle(`${shownTitle} (Instagram)`, { exact: true });
        assert.equal(await status.count(), 0);

        // Instagram is blocked in these tests, so no message comes within 10 seconds.
        await page.clock.fastForward(10_500);
        await status.waitFor({ state: "visible" });
        assert.match(await status.textContent(), /may be blocked/);
        assert.equal(await status.evaluate((node) => node.closest(".player__bar") !== null
            && Boolean(node.compareDocumentPosition(document.querySelector("[data-player] iframe")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
        const [statusBox, frameBox] = [await status.boundingBox(), await frame.boundingBox()];
        if (place === "above") {
            assert.ok(statusBox.y + statusBox.height <= frameBox.y, "the message sits above the video");
        } else {
            assert.ok(statusBox.x >= frameBox.x + frameBox.width, "the message sits beside the video");
        }
        assert.ok(statusBox.y + statusBox.height <= viewport.height, "the message is on the first screen");
        const link = new URL(await status.getByRole("link", { name: "Watch on Instagram" }).getAttribute("href"));
        assert.equal(link.href, `https://www.instagram.com/p/${instagramCode(video.instagram)}/`);
        assert.equal(await frame.count(), 1);
    });
}

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
    assert.equal(await page.getByRole("heading", { name: "Page not found", level: 1 }).count(), 1);
    assert.equal(await page.title(), "Page not found | CSE Videos");
    await page.getByRole("link", { name: "See all videos", exact: true }).click();
    assert.equal(page.url(), `${site.origin}/`);
});

for (const route of ["/", "/wall/", "/tags/", `/tags/${seriesTag}/`, videoPath]) {
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

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 320, height: 640 }]) {
    for (const route of ["/", "/wall/", "/tags/", videoPath]) {
        test(`no horizontal overflow at ${viewport.width}x${viewport.height} on ${route}`, async (t) => {
            const { page } = await site.page(t, { viewport });
            await page.goto(route);
            await page.evaluate(() => document.fonts.ready);
            const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
            assert.ok(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions));
        });
    }
}

test("pointing at a still in the hero's card names it under the card, dims the others, and a click opens it", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/");
    const wall = page.locator("[data-wall]");
    assert.equal(await wall.locator("[data-id]:not(.wall__still--echo) a").count(), videos.length);
    const label = page.locator("[data-wall-caption]");
    assert.equal(await label.evaluate((node) => getComputedStyle(node).opacity), "0");
    // A still the card shows whole.
    const slot = await page.evaluate(() => {
        const card = document.querySelector(".hero__card").getBoundingClientRect();
        return [...document.querySelectorAll(".hero__card [data-id]")].findIndex((item) => {
            const box = item.getBoundingClientRect();
            return box.top >= card.top && box.bottom <= card.bottom && box.left >= card.left && box.right <= card.right;
        });
    });
    assert.ok(slot >= 0);
    const still = wall.locator("[data-id]").nth(slot);
    const id = await still.getAttribute("data-id");

    await still.hover();
    await page.waitForFunction((node) => getComputedStyle(node).opacity === "1", await label.elementHandle());
    assert.equal(await label.textContent(), smartQuotes(videos.find((item) => item.id === id).title));
    await page.waitForFunction((node) => getComputedStyle(node).opacity === "0", await still.locator(".wall__veil").elementHandle());
    await page.waitForFunction((node) => getComputedStyle(node).opacity === "1", await still.locator("picture").elementHandle());
    const other = wall.locator("[data-id]").nth(slot === 0 ? 1 : 0).locator("picture");
    await page.waitForFunction((node) => Number(getComputedStyle(node).opacity) < 0.6, await other.elementHandle());

    await page.mouse.move(0, 0);
    await page.waitForFunction((node) => getComputedStyle(node).opacity === "0", await label.elementHandle());
    await still.locator("a").click();
    await page.waitForURL(`**/videos/${id}/`);
});

test("the link under the card opens the video wall", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/");
    const open = page.getByRole("link", { name: "Open the video wall" });
    const card = await page.locator(".hero__card").boundingBox();
    const hero = await page.locator(".hero").boundingBox();
    const box = await open.boundingBox();
    assert.equal(await page.locator(".hero__card .hero__open").count(), 0, "the link is off the card's stills");
    assert.ok(box.y >= card.y + card.height && box.y + box.height <= hero.y + hero.height, "the link sits under the card, in the hero");
    // Its words end at the card's right edge.
    const right = await open.evaluate((node) => node.querySelector(".arrow-icon").getBoundingClientRect().right);
    assert.ok(Math.abs(right - (card.x + card.width)) <= 4, `${right} ${card.x + card.width}`);
    await open.click();
    await page.waitForURL("**/wall/");
    assert.equal(await page.getByRole("heading", { level: 1 }).textContent(), "Video wall");
});

test("the wall stays out of the keyboard's way: tabbing from the search goes to the index", async (t) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const { page } = await site.page(t, { viewport });
        await page.goto("/");
        assert.equal(await page.getByRole("list", { name: /wall/i }).count(), 0);
        assert.equal(await page.locator("[data-wall] a").evaluateAll((links) => links.every((link) => link.tabIndex === -1)), true);

        // From the search, Tab goes to the topics link and the card's button, then
        // into the index, never onto a still.
        await page.getByRole("searchbox", { name: "Search videos" }).focus();
        const stops = [];
        for (let step = 0; step < 3; step++) {
            await page.keyboard.press("Tab");
            stops.push(await page.evaluate(() => document.activeElement.textContent.trim()));
        }
        assert.deepEqual(stops.slice(0, 2), [`${new Set(videos.flatMap((item) => item.tags)).size} topics`, "Open the video wall"], `${viewport.width}`);
        assert.equal(await page.evaluate(() => document.querySelector("#all-videos").contains(document.activeElement)), true, `${viewport.width}: focus left the index`);
        for (let step = 0; step < 6; step++) {
            await page.keyboard.press("Tab");
        }

        assert.equal(await page.locator(".hero__card").evaluate((node) => node.scrollTop), 0, `${viewport.width}`);
        await page.evaluate(() => window.scrollTo(0, 0));
        // The headline, the search and the whole card are on the first screen, and
        // the index starts under them.
        const hero = await page.locator(".hero").boundingBox();
        const title = await page.getByRole("heading", { level: 1 }).boundingBox();
        const search = await page.getByRole("searchbox", { name: "Search videos" }).boundingBox();
        const card = await page.locator(".hero__card").boundingBox();
        for (const [name, box] of [["headline", title], ["search", search], ["card", card]]) {
            assert.ok(box.y >= hero.y && box.y + box.height <= Math.min(hero.y + hero.height, viewport.height) + 1, `${viewport.width}: the ${name} is on screen in the hero`);
        }
        assert.ok(hero.y + hero.height <= viewport.height * 0.8, `${viewport.width}: the hero leaves room for the index`);
    }
});

test("clicking through the site raises no errors, view transitions included", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(`${new URL(page.url()).pathname}: ${error.message}`));
    const settle = () => page.waitForTimeout(450);

    await page.goto("/");
    await page.getByRole("link", { name: "Topics", exact: true }).first().click();
    await page.waitForURL("**/tags/");
    await settle();
    await page.getByRole("main").getByRole("link", { name: tagNames[seriesTag], exact: true }).click();
    await page.waitForURL(`**/tags/${seriesTag}/`);
    await settle();
    await cards(page).first().getByRole("link").click();
    await page.waitForURL(`**/videos/${partOrder[0]}/`);
    await settle();
    await page.locator("[data-back]").click();
    await page.waitForURL(`**/tags/${seriesTag}/`);
    await settle();
    await page.getByRole("link", { name: "CSE Videos" }).first().click();
    await page.waitForURL(`${site.origin}/`);
    await settle();
    await page.locator("[data-wall] a").nth(2).click();
    await page.waitForURL(/\/videos\/[\w-]+\/$/);
    await settle();
    await page.goBack();
    await page.waitForURL(`${site.origin}/`);
    await settle();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Video wall" }).click();
    await page.waitForURL("**/wall/");
    await settle();
    await page.getByRole("list", { name: "Every video" }).getByRole("link").nth(17).click();
    await page.waitForURL(/\/videos\/[\w-]+\/$/);
    await settle();
    await page.goBack();
    await page.waitForURL("**/wall/");
    await settle();
    assert.deepEqual(errors, []);
});

test("on a phone the index opens on thirteen videos, and a search still looks through all of them", async (t) => {
    const viewport = { width: 390, height: 844 };
    const { page } = await site.page(t, { viewport });
    await page.goto("/");
    assert.equal(await cards(page).count(), 13);
    const showAll = page.getByRole("button", { name: `Show all ${videos.length} videos` });
    await showAll.click();
    assert.equal(await cards(page).count(), videos.length);
    assert.equal(await showAll.isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.closest("[data-video-list] > li") === document.querySelectorAll("[data-video-list] > li")[13]), true);

    await page.goto("/");
    const input = page.getByRole("searchbox", { name: "Search videos" });
    assert.equal(await input.getAttribute("placeholder"), "Try portfolio or interviews");
    await input.fill("job");
    const expected = await page.locator("[data-video-list] > li").evaluateAll((items) => items.filter((item) =>
        item.dataset.search.split(" ").some((word) => word.startsWith("job"))).length);
    assert.ok(expected > 13, String(expected));
    assert.equal(await cards(page).count(), expected);
    await input.fill("");
    assert.equal(await cards(page).count(), 13);

    for (const javaScriptEnabled of [false]) {
        const { page: plain } = await site.page(t, { viewport, javaScriptEnabled });
        await plain.goto("/");
        assert.equal(await cards(plain).count(), videos.length);
    }

    const { page: wide } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await wide.goto("/");
    assert.equal(await cards(wide).count(), videos.length);
    assert.equal(await wide.getByRole("button", { name: /^Show all/ }).count(), 0);
    assert.equal(await wide.getByRole("searchbox").getAttribute("placeholder"), "Try portfolio, interviews or internships");
});

test("a search lights its stills on the wall and closes up the index", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/");
    const leadBox = await cards(page).first().boundingBox();
    const tileBox = await cards(page).nth(1).boundingBox();
    await page.getByRole("searchbox", { name: "Search videos" }).fill("portfolio");
    const shown = await shownIds(page);
    assert.ok(shown.length > 0 && shown.length < videos.length);
    const lit = await page.locator("[data-wall] .is-match").evaluateAll((items) => [...new Set(items.map((item) => item.dataset.id))]);
    assert.deepEqual(lit.sort(), [...shown].sort());
    // Every copy of a match in the card is lit, and every other still dimmed.
    const copies = await page.locator("[data-wall] [data-id]").evaluateAll((items, ids) => items.filter((item) => ids.includes(item.dataset.id)).length, shown);
    assert.equal(await page.locator("[data-wall] .is-match").count(), copies);
    assert.equal(await page.locator("[data-wall] .is-dim").count(), await page.locator("[data-wall] [data-id]").count() - copies);
    // Every match is drawn at one size, the first where the newest video was.
    assert.equal(await page.locator("[data-video-list] > .tile--lead").count(), 0);
    await page.waitForFunction(() => document.querySelector("[data-video-list]").getAnimations({ subtree: true }).length === 0);
    const firstBox = await cards(page).first().boundingBox();
    assert.deepEqual([firstBox.x, firstBox.y], [leadBox.x, leadBox.y]);
    assert.deepEqual(await cards(page).evaluateAll((items) => [...new Set(items.map((item) => Math.round(item.getBoundingClientRect().width)))]), [Math.round(tileBox.width)]);
    assert.equal(await page.locator("[data-wall] .is-match .wall__edge").first().evaluate((node) => getComputedStyle(node).opacity), "1");

    // The card brings its matches to its front rows, so every one is on show.
    for (const query of ["portfolio", "robot"]) {
        await page.getByRole("searchbox").fill(query);
        await page.evaluate(() => window.scrollTo(0, 0));
        const hidden = await page.evaluate(() => {
            const card = document.querySelector(".hero__card").getBoundingClientRect();
            return [...document.querySelectorAll("[data-wall] .is-match")].filter((item) => {
                const box = item.getBoundingClientRect();
                return box.top < card.top - 1 || box.top + box.height / 2 > card.bottom || box.left < card.left - 1 || box.right > card.right + 1;
            }).map((item) => item.dataset.id);
        });
        assert.deepEqual(hidden, [], query);
    }

    await page.getByRole("searchbox").fill("");
    assert.equal(await page.locator("[data-wall] .is-match, [data-wall] .is-dim").count(), 0);
});

test("the video wall lights what a search matches, echoes included, and keeps the search in the address", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/wall/");
    assert.equal(await page.getByRole("list", { name: "Every video" }).getByRole("link").count(), videos.length);
    const input = page.getByRole("searchbox", { name: "Search videos" });
    await input.fill("portfolio");
    const expected = await page.locator("[data-wall-page] [data-search]").evaluateAll((items) => items
        .filter((item) => item.dataset.search.split(" ").some((word) => word.startsWith("portfolio")))
        .map((item) => item.dataset.id).sort());
    assert.ok(expected.length > 0 && expected.length < videos.length);
    const lit = await page.locator("[data-wall-page] .is-match").evaluateAll((items) => [...new Set(items.map((item) => item.dataset.id))].sort());
    assert.deepEqual(lit, expected);
    // Every copy of a match is lit, and every other still is dimmed.
    const copies = await page.locator("[data-wall-page] [data-id]").evaluateAll((items, ids) => items.filter((item) => ids.includes(item.dataset.id)).length, expected);
    const stills = await page.locator("[data-wall-page] [data-id]").count();
    assert.ok(copies > expected.length);
    assert.equal(await page.locator("[data-wall-page] .is-match").count(), copies);
    assert.equal(await page.locator("[data-wall-page] .is-dim").count(), stills - copies);
    await page.waitForFunction((node) => getComputedStyle(node).opacity === "1", await page.locator("[data-wall-page] .is-match .wall__edge").first().elementHandle());
    assert.equal(await page.locator("[data-results]").textContent(), `${expected.length} of ${videos.length} videos match “portfolio”`);
    assert.equal(new URL(page.url()).searchParams.get("q"), "portfolio");
    assert.equal(await page.title(), "“portfolio” | Video wall | CSE Videos");
    // Only the matches are left for the keyboard and screen readers.
    const list = page.getByRole("list", { name: "Every video" });
    assert.equal(await list.getByRole("listitem").count(), expected.length);
    await input.focus();
    await page.keyboard.press("Tab");
    assert.ok(expected.includes(await page.evaluate(() => document.activeElement.closest("[data-id]")?.dataset.id)));
    // Enter goes to the first match.
    await input.focus();
    await input.press("Enter");
    const first = await page.evaluate(() => document.activeElement.closest("[data-id]")?.dataset.id);
    assert.ok(expected.includes(first));

    await page.goto("/wall?q=portfolio");
    assert.equal(new URL(page.url()).pathname, "/wall/");
    assert.equal(await input.inputValue(), "portfolio");
    assert.equal(await page.locator("[data-wall-page] .is-match").count(), copies);

    await input.fill("");
    assert.equal(await page.locator("[data-wall-page] .is-match, [data-wall-page] .is-dim").count(), 0);
    assert.equal(await page.locator("[data-results]").textContent(), libraryLine(videos));
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await list.getByRole("listitem").count(), videos.length);
    assert.equal(await page.locator("[data-wall-page] [data-search] a[tabindex]").count(), 0);

    await input.fill("zzzz");
    assert.equal(await page.locator("[data-results]").textContent(), "No videos match “zzzz”");
    assert.equal(await page.locator("[data-wall-page] .is-match").count(), 0);
});

test("on the video wall the search comes first, then a link for every video, captioned when focused", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/wall/");
    const list = page.getByRole("list", { name: "Every video" });
    assert.equal(await list.getByRole("listitem").count(), videos.length);
    assert.equal(await page.locator("[data-wall-page] .wall__still--echo a").evaluateAll((links) => links.every((link) => link.tabIndex === -1)), true);

    await page.getByRole("searchbox", { name: "Search videos" }).focus();
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    assert.equal(await focused.evaluate((node) => node.matches("[data-wall-page] .wall__link")), true);
    const id = await focused.evaluate((node) => node.closest("[data-id]").dataset.id);
    const title = smartQuotes(videos.find((item) => item.id === id).title);
    assert.equal(await list.getByRole("link", { name: title, exact: true }).count(), 1);
    // The strip names the focused still.
    const label = page.locator("[data-wall-caption]");
    await page.waitForFunction((node) => getComputedStyle(node).opacity === "1", await label.elementHandle());
    assert.equal(await label.textContent(), title);

    // The header's search button comes back to this page's field.
    await page.locator("[data-search-button]").click();
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-search-input]")), true);
    assert.equal(new URL(page.url()).pathname, "/wall/");
});

const WALL_VIEWPORTS = [
    { width: 2560, height: 1440 }, { width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1440, height: 2560 },
    { width: 1366, height: 657 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 1024, height: 700 },
    { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 360, height: 640 }, { width: 320, height: 568 }
];

for (const viewport of WALL_VIEWPORTS) {
    test(`the video wall fills its stage and shows every video whole at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport });
        await page.goto("/wall/");
        const result = await page.evaluate(() => {
            const area = document.querySelector(".wall-stage__area").getBoundingClientRect();
            const columns = new Map();
            const cut = [];

            for (const still of document.querySelectorAll("[data-wall-page] > li")) {
                const box = still.getBoundingClientRect();
                const key = Math.round(box.left);
                const column = columns.get(key) ?? { top: Infinity, bottom: -Infinity };
                columns.set(key, { top: Math.min(column.top, box.top), bottom: Math.max(column.bottom, box.bottom) });

                if (!still.classList.contains("wall__still--echo") && (box.top < area.top - 1 || box.bottom > area.bottom + 1)) {
                    cut.push(still.dataset.id);
                }
            }

            return {
                short: [...columns].filter(([, column]) => column.top > area.top + 1 || column.bottom < area.bottom - 1).map(([left]) => left),
                cut
            };
        });
        assert.deepEqual(result.short, [], "columns that stop short of the wall's edges");
        assert.deepEqual(result.cut, [], "videos whose own still is cut off");
    });
}

for (const { viewport, deviceScaleFactor = 1 } of [
    { viewport: { width: 1440, height: 900 } }, { viewport: { width: 1024, height: 768 } }, { viewport: { width: 375, height: 667 } },
    { viewport: { width: 667, height: 375 } }, { viewport: { width: 683, height: 384 }, deviceScaleFactor: 2 }, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 }
]) {
    test(`on the video wall every focused still is whole on screen and clear of the strip at ${viewport.width}x${viewport.height}@${deviceScaleFactor}`, async (t) => {
        const { page } = await site.page(t, { viewport, deviceScaleFactor });
        await page.goto("/wall/");
        const hidden = await page.evaluate(async () => {
            const bad = [];

            for (const link of document.querySelectorAll("[data-wall-page] [data-search] a")) {
                link.focus();
                await new Promise((resolve) => requestAnimationFrame(resolve));
                const box = link.getBoundingClientRect();
                const middle = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

                if (box.top < -1 || box.bottom > innerHeight + 1 || !link.contains(middle)) {
                    bad.push(link.closest("[data-id]").dataset.id);
                }
            }

            return bad;
        });
        assert.deepEqual(hidden, []);
    });
}

test("on a tall portrait screen the video wall ends with its strip, and the page goes on below", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 2560 } });
    await page.goto("/wall/");
    const [stage, strip] = await Promise.all([page.locator(".wall-stage").boundingBox(), page.locator(".band").boundingBox()]);
    assert.ok(Math.abs(stage.y + stage.height - (strip.y + strip.height)) <= 1, JSON.stringify({ stage, strip }));
});

test("tabbing to the video wall's search leaves the page where it is", async (t) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
        const { page } = await site.page(t, { viewport });
        await page.goto("/wall/");
        for (let step = 0; step < 20 && !(await page.evaluate(() => document.activeElement?.id === "search")); step++) {
            await page.keyboard.press("Tab");
        }
        assert.equal(await page.evaluate(() => document.activeElement.id), "search", `${viewport.width}`);
        assert.equal(await page.evaluate(() => window.scrollY), 0, `${viewport.width}`);
    }
});

for (const { viewport, isMobile = false } of [
    { viewport: { width: 844, height: 390 }, isMobile: true }, { viewport: { width: 667, height: 375 }, isMobile: true },
    { viewport: { width: 720, height: 450 } }, { viewport: { width: 640, height: 400 } }
]) {
    test(`on a short screen the video wall's heading and search come first at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport, isMobile, hasTouch: isMobile });
        await page.goto("/wall/");
        const heading = await page.getByRole("heading", { level: 1, name: "Video wall" }).boundingBox();
        const search = await page.getByRole("searchbox", { name: "Search videos" }).boundingBox();
        assert.ok(heading.y >= 0 && search.y + search.height <= viewport.height, JSON.stringify({ heading, search }));
    });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 1024, height: 1366 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 740 }, { width: 320, height: 568 }]) {
    test(`the video wall's docked strip fits the room the wall leaves it at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport });
        await page.goto("/wall/");
        await page.evaluate(() => document.fonts.ready);
        const room = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--strip")));
        const heights = [];
        for (const query of ["", "informational interviews"]) {
            await page.getByRole("searchbox").fill(query);
            heights.push(await page.locator(".band").evaluate((node) => node.getBoundingClientRect().height));
        }
        assert.ok(heights.every((height) => height <= room), `${heights} > ${room}`);
        // On a phone it keeps most of the screen for the wall.
        if (viewport.width < 700) {
            assert.ok(heights[0] / viewport.height <= 0.21, `${heights[0]}`);
        }
    });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 320, height: 568 }]) {
    test(`on a touch screen the strip names the focused still in full, and no caption spills over its neighbours at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport, isMobile: true, hasTouch: true });
        await page.goto("/wall/");
        const input = page.getByRole("searchbox", { name: "Search videos" });
        await input.fill("interview");
        await input.press("Enter");
        const focused = page.locator(":focus");
        const title = await focused.getAttribute("href").then((href) => smartQuotes(videos.find((item) => href.endsWith(`/${item.id}/`)).title));
        const label = page.locator("[data-wall-caption]");
        await page.waitForFunction(([node, text]) => node.textContent === text && getComputedStyle(node).opacity === "1", [await label.elementHandle(), title]);
        const [still, caption] = await Promise.all([focused.boundingBox(), focused.locator(".wall__caption").boundingBox()]);
        assert.ok(caption.height <= 1 || (caption.y >= still.y && caption.y + caption.height <= still.y + still.height + 1), JSON.stringify({ still, caption }));
        assert.ok(still.y >= 0 && still.y + still.height <= viewport.height, JSON.stringify(still));

        // Every title fits the label whole, and the strip keeps to its room.
        const fit = await label.evaluate((node) => {
            const room = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--strip"));
            const cut = [];
            let tallest = 0;

            for (const name of new Set([...document.querySelectorAll("[data-wall-page] .wall__caption")].map((item) => item.textContent))) {
                node.textContent = name;
                if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) {
                    cut.push(name);
                }
                tallest = Math.max(tallest, document.querySelector(".band").getBoundingClientRect().height);
            }

            return { cut, tall: tallest <= room };
        });
        assert.deepEqual(fit, { cut: [], tall: true });
    });
}

test("in forced colours a focused still on the video wall shows its ring over the picture", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 }, forcedColors: "active" });
    await page.goto("/wall/");
    await page.getByRole("searchbox", { name: "Search videos" }).focus();
    await page.keyboard.press("Tab");
    const ring = await page.locator(":focus").evaluate((node) => {
        const after = getComputedStyle(node, "::after");
        return { style: after.outlineStyle, width: after.outlineWidth, opacity: after.opacity };
    });
    assert.deepEqual(ring, { style: "solid", width: "3px", opacity: "1" });
});

for (const path of ["/", "/wall/"]) {
    test(`the search hint fits its field at 320 px on ${path}`, async (t) => {
        const { page } = await site.page(t, { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const fit = await page.evaluate(() => {
            const input = document.querySelector("#search");
            const style = getComputedStyle(input);
            const context = document.createElement("canvas").getContext("2d");
            context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            return { text: context.measureText(input.placeholder).width, room };
        });
        assert.ok(fit.text <= fit.room, JSON.stringify(fit));
    });
}

test("the header's search button on another page lands on the hero with its headline in view", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto(videoPath);
    await page.locator("[data-search-button]").click();
    await page.waitForURL(/#search$/);
    await page.waitForFunction(() => document.activeElement?.id === "search");
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    assert.ok(title.y >= 0);
});

test("the video wall's focus ring shows over the still, and the strip keeps naming the focused still", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/wall/");
    await page.getByRole("searchbox", { name: "Search videos" }).focus();
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    assert.equal(await focused.evaluate((node) => getComputedStyle(node, "::after").opacity), "1");
    const title = await focused.getAttribute("href").then((href) => smartQuotes(videos.find((item) => href.endsWith(`/${item.id}/`)).title));
    const label = page.locator("[data-wall-caption]");
    await page.locator("[data-wall-page] [data-search]").nth(20).hover();
    // Off the wall, onto its strip, which stays on screen however the page scrolled.
    const strip = await page.locator(".band__title").boundingBox();
    await page.mouse.move(strip.x + 5, strip.y + 5);
    await page.waitForFunction(([node, text]) => node.textContent === text && getComputedStyle(node).opacity === "1", [await label.elementHandle(), title]);
});

test("the hero's search shows the short hint where it sits beside the card", async (t) => {
    for (const [width, hint] of [[1440, "Try portfolio, interviews or internships"], [1000, "Try portfolio or interviews"], [900, "Try portfolio or interviews"], [760, "Try portfolio, interviews or internships"], [390, "Try portfolio or interviews"]]) {
        const { page } = await site.page(t, { viewport: { width, height: 900 } });
        await page.goto("/");
        assert.equal(await page.getByRole("searchbox").getAttribute("placeholder"), hint, `${width}`);
    }
});

test("a video opened from the video wall links back to it, and to its search", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/wall/");
    await page.getByRole("list", { name: "Every video" }).getByRole("link").nth(17).click();
    await page.waitForURL(/\/videos\/[\w-]+\/$/);
    const back = page.locator("[data-back]");
    assert.equal(await back.textContent(), "Back to the video wall");
    await back.click();
    await page.waitForURL("**/wall/");

    await page.goto("/wall/?q=portfolio");
    await page.locator("[data-wall-page] [data-search].is-match a").first().click();
    await page.waitForURL(/\/videos\/[\w-]+\/$/);
    assert.equal(await back.textContent(), "Back to results");
    await back.click();
    await page.waitForURL("**/wall/?q=portfolio");
    assert.equal(await page.getByRole("searchbox", { name: "Search videos" }).inputValue(), "portfolio");
});

// The baseline of an element's first line of words, from a probe put before them.
const baseline = (node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();

    while (text && !text.textContent.trim()) {
        text = walker.nextNode();
    }

    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    text.parentNode.insertBefore(probe, text);
    const y = probe.getBoundingClientRect().top;
    probe.remove();
    return y;
};

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 900, height: 800 }, { width: 844, height: 390 }]) {
    test(`the card shares the copy's edges at ${viewport.width}x${viewport.height}`, async (t) => {
        // Reduced motion, so the headline isn't caught rising into place.
        const { page } = await site.page(t, { viewport, bypassCSP: true, reducedMotion: "reduce" });
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        const edges = await page.evaluate((measure) => {
            const box = (selector) => document.querySelector(selector).getBoundingClientRect();
            const read = new Function(`return (${measure})`)();
            const title = document.querySelector(".hero__line");
            const size = parseFloat(getComputedStyle(title).fontSize);
            return {
                // The capitals' top: the first line's baseline less the face's cap height.
                capTop: read(title) - size * 0.655,
                cardTop: box(".hero__card").top,
                cardBottom: box(".hero__card").bottom,
                cardRight: box(".hero__card").right,
                searchBottom: box(".hero .search__input").bottom,
                searchRight: box(".hero .search__input").right,
                titleRight: (() => { const range = document.createRange(); range.selectNodeContents(title); return range.getBoundingClientRect().right; })(),
                factsLine: read(document.querySelector(".hero__facts")),
                openLine: read(document.querySelector(".hero__open")),
                containerRight: box(".hero__inner").right - parseFloat(getComputedStyle(document.querySelector(".hero__inner")).paddingRight)
            };
        }, baseline.toString());
        assert.ok(Math.abs(edges.cardTop - edges.capTop) <= 2, `card top ${edges.cardTop}, capitals ${edges.capTop}`);
        assert.ok(Math.abs(edges.cardBottom - edges.searchBottom) <= 1, `card foot ${edges.cardBottom}, field foot ${edges.searchBottom}`);
        assert.ok(Math.abs(edges.openLine - edges.factsLine) <= 1, `link ${edges.openLine}, facts ${edges.factsLine}`);
        assert.ok(Math.abs(edges.searchRight - edges.titleRight) <= 2, `field ${edges.searchRight}, headline ${edges.titleRight}`);
        assert.ok(Math.abs(edges.cardRight - edges.containerRight) <= 1, `card ${edges.cardRight}, column ${edges.containerRight}`);
    });
}

for (const viewport of [
    { width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1100, height: 900 }, { width: 1024, height: 768 },
    { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 660, height: 900 }, { width: 600, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 640 }
]) {
    test(`the hero's card is filled to every edge at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport });
        await page.goto("/");
        const short = await page.evaluate(() => {
            const card = document.querySelector(".hero__card").getBoundingClientRect();
            const columns = new Map();

            for (const still of document.querySelectorAll(".hero__card [data-id]")) {
                const box = still.getBoundingClientRect();
                const key = Math.round(box.left);
                const column = columns.get(key) ?? { top: Infinity, bottom: -Infinity };
                columns.set(key, { top: Math.min(column.top, box.top), bottom: Math.max(column.bottom, box.bottom) });
            }

            return [...columns].filter(([, column]) => column.top > card.top + 1 || column.bottom < card.bottom - 1).map(([left]) => left);
        });
        assert.deepEqual(short, []);
    });
}

for (const viewport of [{ width: 740, height: 360 }, { width: 812, height: 375 }, { width: 844, height: 390 }, { width: 932, height: 430 }]) {
    test(`on a phone held sideways the headline, the search and the facts are on the first screen at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport, isMobile: true, hasTouch: true });
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        const title = await page.getByRole("heading", { level: 1 }).boundingBox();
        const search = await page.getByRole("searchbox", { name: "Search videos" }).boundingBox();
        const facts = await page.locator(".hero__facts").boundingBox();
        assert.ok(title.y >= 0 && search.y + search.height <= viewport.height && facts.y + facts.height <= viewport.height, JSON.stringify({ title, search, facts }));
    });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    test(`without JavaScript the hero leaves out the line about the search, and its card keeps its height at ${viewport.width}x${viewport.height}`, async (t) => {
        const seen = [];
        for (const javaScriptEnabled of [true, false]) {
            const { page } = await site.page(t, { viewport, javaScriptEnabled });
            await page.goto("/");
            await page.evaluate(() => document.fonts.ready);
            seen.push({ lede: await page.locator(".hero__lede").isVisible(), card: (await page.locator(".hero__card").boundingBox()).height });
        }
        assert.deepEqual(seen.map(({ lede }) => lede), [true, false]);
        assert.ok(Math.abs(seen[0].card - seen[1].card) <= 1, JSON.stringify(seen));
    });
}

for (const viewport of [
    { width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 768 },
    { width: 799, height: 900 }, { width: 768, height: 1024 }, { width: 760, height: 900 }, { width: 600, height: 800 }, { width: 390, height: 844 },
    { width: 375, height: 667 }, { width: 360, height: 740 }, { width: 360, height: 640 }, { width: 320, height: 640 }
]) {
    // A phone is a touch screen, whose utility bar is 44 px for its links.
    const phone = viewport.width < 700;
    test(`the All videos heading is on the first screen at ${viewport.width}x${viewport.height}${phone ? " on a touch screen" : ""}`, async (t) => {
        const { page } = await site.page(t, { viewport, ...(phone && { isMobile: true, hasTouch: true }) });
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        const heading = await page.getByRole("heading", { name: "All videos", level: 2 }).boundingBox();
        assert.ok(heading.y + heading.height <= viewport.height, JSON.stringify(heading));
    });
}

for (const width of [320, 340, 359, 360, 375, 380, 400, 420, 430, 449, 450, 500, 699, 700, 710, 720, 760, 1099, 1100]) {
    test(`the header's links fit on the page in one row, in their keyboard order, at ${width} px`, async (t) => {
        const { page } = await site.page(t, { viewport: { width, height: 800 } });
        await page.goto("/wall/");
        await page.evaluate(() => document.fonts.ready);
        const fit = await page.evaluate(() => {
            const inner = document.querySelector(".masthead__inner").getBoundingClientRect();
            const links = [...document.querySelectorAll(".wordmark, .site-nav__link, .search-button")]
                .filter((link) => link.getClientRects().length > 0)
                .map((link) => link.getBoundingClientRect());
            return {
                scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
                inside: links.every((box) => box.right <= inner.right + 1 && box.left >= inner.left - 1),
                rows: new Set(links.map((box) => Math.round(box.top + box.height / 2))).size,
                inOrder: links.every((box, index) => index === 0 || box.left >= links[index - 1].right)
            };
        });
        assert.deepEqual(fit, { scroll: true, inside: true, rows: 1, inOrder: true });
    });
}

test("the wall holds still as the page scrolls, and Career Quest fades up once, under the page's content security policy", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
        window.violations = [];
        document.addEventListener("securitypolicyviolation", (event) => {
            window.violations.push(`${event.violatedDirective} ${event.blockedURI}`);
        });
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const wall = page.locator("[data-wall]");
    assert.equal(await wall.evaluate((node) => node.style.transform), "");
    const boards = page.locator("[data-quest-boards]");
    assert.equal(await boards.evaluate((node) => node.classList.contains("is-waiting")), true);

    const before = await wall.evaluate((node) => node.getBoundingClientRect().top - document.querySelector(".hero__card").getBoundingClientRect().top);
    await page.mouse.wheel(0, 400);
    await page.waitForFunction(() => window.scrollY > 0);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await wall.evaluate((node) => node.getBoundingClientRect().top - document.querySelector(".hero__card").getBoundingClientRect().top), before);

    await boards.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector("[data-quest-boards]").classList.contains("is-waiting"));
    await page.waitForFunction(() => document.querySelector("[data-quest-boards]").getAnimations({ subtree: true }).length === 0);
    assert.equal(await boards.locator("li").first().evaluate((node) => getComputedStyle(node).opacity), "1");

    assert.deepEqual(await page.evaluate(() => window.violations), []);
    assert.deepEqual(errors, []);
});

test("with reduced motion nothing drifts, waits or zooms, and every still is in place", async (t) => {
    const { page } = await site.page(t, { reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    await page.goto("/");
    await page.mouse.wheel(0, 400);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator("[data-wall]").evaluate((node) => node.style.transform), "");
    assert.equal(await page.locator("[data-quest-boards].is-waiting").count(), 0);
    assert.equal(await page.locator(".wall").evaluate((node) => getComputedStyle(node).animationName), "none");
    const tile = cards(page).nth(1);
    await tile.getByRole("link").hover();
    assert.equal(await tile.locator("img").evaluate((node) => getComputedStyle(node).transform), "none");
    // The fades that answer a pointer or a search stay; only movement goes.
    assert.equal(await page.locator(".wall__veil").first().evaluate((node) => getComputedStyle(node).transitionDuration), "0.18s");
    assert.equal(await page.locator(".wall__caption").first().evaluate((node) => getComputedStyle(node).transform), "none");
});

test("the real data has no video on both players, so the header has no player switch", async (t) => {
    const { page } = await site.page(t);
    for (const route of ["/", videoPath]) {
        await page.goto(route);
        assert.equal(await page.locator("[data-source-preference]").count(), 0, route);
    }
});

describe("player preference", () => {
    // The real data has no YouTube links yet, so these build the site from a
    // small list: two videos on both players, a reel (named after a real cover
    // file, which a reel needs), and a YouTube-only video.
    const mixedVideos = [
        { id: "on-both", title: "On both", youtube: "https://www.youtube.com/watch?v=abcdefghijk", instagram: "https://www.instagram.com/reel/BOTHONE/", datePosted: "2026-10-04", tags: ["job-search"] },
        { id: "also-on-both", title: "Also on both", youtube: "https://www.youtube.com/shorts/bcdefghijkl", instagram: "https://www.instagram.com/reel/BOTHTWO/", datePosted: "2026-10-03", tags: ["job-search"] },
        { id: "career-quest-part-1", title: "Only a reel", instagram: "https://www.instagram.com/reel/REELONLY/", datePosted: "2026-10-02", tags: ["job-search"] },
        { id: "only-youtube", title: "Only on YouTube", youtube: "https://www.youtube.com/watch?v=cdefghijklm", datePosted: "2026-10-01", tags: ["job-search"] }
    ];
    const KEY = "cse-videos:source";
    let dataDir;
    let mixed;

    before(async () => {
        dataDir = await mkdtemp(path.join(tmpdir(), "cse-preference-"));
        const dataFile = path.join(dataDir, "videos.json");
        await writeFile(dataFile, JSON.stringify(mixedVideos));
        mixed = await startSite({ dataFile });
    });
    after(async () => {
        await mixed?.close();
        await rm(dataDir, { recursive: true, force: true });
    });

    const playing = (page) => page.locator("[data-player]").getAttribute("data-source");
    const frameHost = async (page) => new URL(await page.locator("[data-player] iframe").getAttribute("src")).hostname;
    const watchOn = (page, name) => page.getByRole("group", { name: "Watch on" }).getByRole("button", { name, exact: true });
    const playOn = (page, name) => page.getByRole("group", { name: "Play videos on" }).getByRole("button", { name, exact: true });
    const pressed = async (page) => page.getByRole("group", { name: "Play videos on" }).getByRole("button")
        .evaluateAll((buttons) => buttons.map((button) => `${button.textContent} ${button.getAttribute("aria-pressed")}`));
    const note = (page) => page.locator("[data-player-note]");
    const search = (page) => new URL(page.url()).search;

    test("the Watch on buttons save a preference that the next video opens on", async (t) => {
        const { page } = await mixed.page(t);
        await page.goto("/videos/on-both/");
        assert.equal(await playing(page), "youtube");
        assert.deepEqual(await pressed(page), ["YouTube false", "Instagram false"]);

        await watchOn(page, "Instagram").click();
        assert.equal(await playing(page), "instagram");
        assert.equal(await frameHost(page), "www.instagram.com");
        assert.equal(search(page), "?source=instagram");
        assert.deepEqual(await pressed(page), ["YouTube false", "Instagram true"]);
        assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), { [KEY]: "instagram" });

        // The preference itself stays out of the address.
        await page.goto("/videos/also-on-both/");
        assert.equal(await playing(page), "instagram");
        assert.equal(await frameHost(page), "www.instagram.com");
        assert.equal(search(page), "");
        assert.equal(await watchOn(page, "Instagram").getAttribute("aria-pressed"), "true");
        assert.deepEqual(await pressed(page), ["YouTube false", "Instagram true"]);

        await watchOn(page, "YouTube").click();
        assert.equal(search(page), "");
        await page.goto("/videos/on-both/");
        assert.equal(await playing(page), "youtube");
        assert.deepEqual(await pressed(page), ["YouTube true", "Instagram false"]);
    });

    test("the header switch saves a preference, switches the player in place, and the next video opens on it", async (t) => {
        const { page } = await mixed.page(t);
        await page.goto("/");
        assert.equal(await page.getByRole("group", { name: "Play videos on" }).isVisible(), true);
        await playOn(page, "Instagram").click();
        assert.deepEqual(await pressed(page), ["YouTube false", "Instagram true"]);

        await page.goto("/videos/on-both/");
        assert.equal(await playing(page), "instagram");
        assert.equal(search(page), "");

        // On a video with both players it switches without reloading the page.
        await page.evaluate(() => { window.samePage = true; });
        await playOn(page, "YouTube").click();
        assert.equal(await playing(page), "youtube");
        assert.equal(await frameHost(page), "www.youtube-nocookie.com");
        assert.equal(await watchOn(page, "YouTube").getAttribute("aria-pressed"), "true");
        assert.deepEqual(await pressed(page), ["YouTube true", "Instagram false"]);
        assert.equal(await page.evaluate(() => window.samePage), true);
        assert.equal(search(page), "");

        await playOn(page, "Instagram").click();
        assert.equal(await playing(page), "instagram");
        assert.equal(search(page), "?source=instagram");
        assert.equal(await page.evaluate(() => window.samePage), true);

        await page.goto("/videos/also-on-both/");
        assert.equal(await playing(page), "instagram");
    });

    test("a link's ?source= wins over the preference and leaves it as it was", async (t) => {
        const { page } = await mixed.page(t);
        await page.goto("/");
        await playOn(page, "Instagram").click();

        await page.goto("/videos/on-both/?source=youtube");
        assert.equal(await playing(page), "youtube");
        assert.equal(await frameHost(page), "www.youtube-nocookie.com");
        assert.equal(search(page), "?source=youtube");
        assert.deepEqual(await pressed(page), ["YouTube false", "Instagram true"]);

        await page.goto("/videos/on-both/");
        assert.equal(await playing(page), "instagram");

        await playOn(page, "YouTube").click();
        await page.goto("/videos/also-on-both/?source=instagram");
        assert.equal(await playing(page), "instagram");
        assert.deepEqual(await pressed(page), ["YouTube true", "Instagram false"]);
    });

    test("a video on one player plays there and says so when the viewer prefers the other", async (t) => {
        const { page } = await mixed.page(t);

        // With no preference nothing changes.
        await page.goto("/videos/career-quest-part-1/");
        assert.equal(await playing(page), "instagram");
        assert.equal(await note(page).count(), 0);

        await playOn(page, "YouTube").click();
        assert.equal(await playing(page), "instagram");
        assert.equal(search(page), "");
        assert.equal(await note(page).textContent(), "Only on Instagram");
        assert.equal(await note(page).isVisible(), true);

        await page.reload();
        assert.equal(await playing(page), "instagram");
        assert.equal(await note(page).textContent(), "Only on Instagram");
        assert.equal(await note(page).isVisible(), true);
        assert.equal(await note(page).evaluate((node) => node.closest(".player__bar") !== null), true);
        const [noteBox, frameBox] = [await note(page).boundingBox(), await page.locator("[data-player] iframe").boundingBox()];
        assert.ok(noteBox.y + noteBox.height <= frameBox.y || noteBox.x >= frameBox.x + frameBox.width, "the note sits with the controls, clear of the video");

        await playOn(page, "Instagram").click();
        assert.equal(await note(page).isVisible(), false);
        await page.reload();
        assert.equal(await note(page).count(), 0);

        await page.goto("/videos/only-youtube/");
        assert.equal(await playing(page), "youtube");
        assert.equal(await note(page).textContent(), "Only on YouTube");
    });

    test("an unknown stored value counts as no preference", async (t) => {
        const { page } = await mixed.page(t);
        await page.goto("/");
        await page.evaluate((key) => localStorage.setItem(key, "tiktok"), KEY);
        await page.goto("/videos/on-both/");
        assert.equal(await playing(page), "youtube");
        assert.deepEqual(await pressed(page), ["YouTube false", "Instagram false"]);
        await page.goto("/videos/career-quest-part-1/");
        assert.equal(await note(page).count(), 0);
    });

    const blockers = {
        "storage itself throws": () => {
            Object.defineProperty(window, "localStorage", {
                configurable: true,
                get() {
                    throw new DOMException("The operation is insecure.", "SecurityError");
                }
            });
        },
        "reads and writes throw": () => {
            Storage.prototype.getItem = () => {
                throw new DOMException("The operation is insecure.", "SecurityError");
            };
            Storage.prototype.setItem = () => {
                throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
            };
        }
    };

    for (const [name, block] of Object.entries(blockers)) {
        test(`the player and switch still work when ${name}`, async (t) => {
            const { page } = await mixed.page(t);
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.addInitScript(block);

            await page.goto("/videos/on-both/");
            assert.equal(await playing(page), "youtube");
            assert.deepEqual(await pressed(page), ["YouTube false", "Instagram false"]);

            await watchOn(page, "Instagram").click();
            assert.equal(await playing(page), "instagram");
            assert.equal(search(page), "?source=instagram");
            assert.deepEqual(await pressed(page), ["YouTube false", "Instagram true"]);

            await playOn(page, "YouTube").click();
            assert.equal(await playing(page), "youtube");
            assert.equal(search(page), "");
            assert.deepEqual(await pressed(page), ["YouTube true", "Instagram false"]);

            // Nothing could be kept, so the next video opens on its default.
            await page.goto("/videos/also-on-both/");
            assert.equal(await playing(page), "youtube");
            assert.deepEqual(await pressed(page), ["YouTube false", "Instagram false"]);

            await page.goto("/videos/career-quest-part-1/");
            await playOn(page, "YouTube").click();
            assert.equal(await note(page).textContent(), "Only on Instagram");
            assert.deepEqual(errors, []);
        });
    }

    for (const route of ["/", "/videos/on-both/", "/videos/career-quest-part-1/"]) {
        test(`no page or console errors with the switch on ${route}`, async (t) => {
            const { page, aborted } = await mixed.page(t);
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
                if (message.type() === "error" && !(aborted.has(message.location().url)
                    && /net::ERR_FAILED|net::ERR_ABORTED/.test(message.text()))) {
                    errors.push(message.text());
                }
            });
            await page.goto(route);
            await playOn(page, "Instagram").click();
            await page.evaluate(() => document.fonts.ready);
            assert.deepEqual(errors, []);
        });

        for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
            test(`no horizontal overflow with the switch at ${viewport.width}x${viewport.height} on ${route}`, async (t) => {
                const { page } = await mixed.page(t, { viewport });
                await page.goto(route);
                await page.evaluate(() => document.fonts.ready);
                assert.equal(await page.getByRole("group", { name: "Play videos on" }).isVisible(), true);
                const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
                assert.ok(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions));
            });
        }
    }
});
