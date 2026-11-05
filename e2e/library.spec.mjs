import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { smartQuotes } from "../lib/html.js";
import { startSite, tagNames, videos } from "./helpers.mjs";

let site;
before(async () => { site = await startSite(); });
after(async () => { await site?.close(); });

const video = videos.find((item) => item.instagram);
const shownTitle = smartQuotes(video.title);
const videoPath = `/videos/${video.id}/`;
const cards = (page) => page.locator("[data-video-list]").getByRole("listitem");
const ids = async (page) => cards(page).getByRole("link").evaluateAll((links) =>
    links.map((link) => new URL(link.href).pathname.split("/").filter(Boolean).at(-1)).sort());
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

test("deep links restore search and oldest-first order through directory redirects", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/?q=portfolio&sort=oldest");
    assert.equal(await page.getByRole("searchbox").inputValue(), "portfolio");
    assert.equal(await page.getByRole("combobox", { name: "Sort" }).inputValue(), "oldest");
    const order = await cards(page).evaluateAll((items) => items.map((item) => Number(item.dataset.order)));
    assert.ok(order.length > 1 && order.length < videos.length);
    assert.deepEqual(order, [...order].sort((a, b) => b - a));
    await page.goto("/tags/career-quest?sort=oldest");
    assert.equal(new URL(page.url()).pathname, "/tags/career-quest/");
    assert.equal(new URL(page.url()).search, "?sort=oldest");
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
    await page.goto("/tags/career-quest/");
    assert.deepEqual(await ids(page), expectedIds(videos.filter((item) => item.tags.includes("career-quest"))));
});

test("Instagram embed expands as a modal and Escape restores focus", async (t) => {
    const { page } = await site.page(t);
    await page.goto(`${videoPath}?source=instagram`);
    const code = new URL(video.instagram).pathname.split("/").filter(Boolean)[1];
    const frame = page.getByTitle(`${shownTitle} (Instagram)`, { exact: true });
    const embed = new URL(await frame.getAttribute("src"));
    assert.equal(embed.hostname, "www.instagram.com");
    assert.equal(embed.pathname, `/p/${code}/embed/`);
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    assert.equal(await page.getByRole("dialog", { name: shownTitle }).getAttribute("aria-modal"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator("[data-player]").getAttribute("aria-modal"), null);
    assert.equal(await page.getByRole("button", { name: "Expand", exact: true }).evaluate((node) => node === document.activeElement), true);
});

test("Copy link writes the current URL and announces success", async (t) => {
    const { page } = await site.page(t, { permissions: ["clipboard-read", "clipboard-write"] });
    await page.goto(`${videoPath}?source=instagram`);
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("[data-copy-status]").textContent === "Link copied");
    assert.equal(await page.locator("[data-copy-status]").textContent(), "Link copied");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), page.url());
});

test("unknown paths serve the 404 page with a working home link", async (t) => {
    const { page } = await site.page(t);
    const response = await page.goto("/missing/nested/page");
    assert.equal(response.status(), 404);
    assert.equal(await page.getByRole("heading", { name: "Page not found" }).count(), 1);
    await page.getByRole("link", { name: "See all videos", exact: true }).click();
    assert.equal(page.url(), `${site.origin}/`);
});

for (const route of ["/", "/tags/", "/tags/career-quest/", videoPath]) {
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
