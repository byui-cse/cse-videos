import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { libraryLine } from "../lib/site.js";
import { startSite, videos } from "./helpers.mjs";

let site;
before(async () => { site = await startSite(); });
after(async () => { await site?.close(); });

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const shown = (page) => page.locator("[data-video-list] > li:not([hidden])");
const multiTag = Object.entries(videos.flatMap((video) => video.tags).reduce((counts, tag) => ({ ...counts, [tag]: (counts[tag] ?? 0) + 1 }), {}))
    .find(([tag, count]) => count > 1 && !videos.filter((video) => video.tags.includes(tag)).every((video) => video.series === tag))[0];

for (const reducedMotion of ["reduce", "no-preference"]) {
    test(`on a phone a sent search brings its results on screen (${reducedMotion} motion)`, async (t) => {
        const { page } = await site.page(t, { ...PHONE, reducedMotion });
        await page.goto("/");
        const input = page.getByRole("searchbox", { name: "Search videos" });
        await input.fill("portfolio");
        await input.press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "listing-heading");
        // The first result ends up whole on screen, with the heading above it.
        await page.waitForFunction(() => {
            const first = [...document.querySelectorAll("[data-video-list] > li")].find((item) => !item.hidden);
            const box = first.getBoundingClientRect();
            const heading = document.getElementById("listing-heading").getBoundingClientRect();
            return box.top >= 0 && box.bottom <= innerHeight && heading.top >= 0;
        });
    });
}

test("a sent search leaves the page alone when its first result already shows whole", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await page.goto("/?q=portfolio");
    await page.locator("#all-videos").evaluate((section) => section.scrollIntoView({ block: "start" }));
    const before = await page.evaluate(() => scrollY);
    await page.evaluate(() => document.getElementById("search").focus({ preventScroll: true }));
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "listing-heading");
    assert.equal(await page.evaluate(() => scrollY), before);
});

test("changing the order says the new order, not only the count", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/");
    const order = page.getByRole("combobox", { name: "Order" });
    const announcer = page.locator("[data-announce]");
    await order.selectOption("oldest");
    assert.equal(await announcer.textContent(), `Oldest first, ${libraryLine(videos)}`);
    await order.selectOption("newest");
    assert.equal(await announcer.textContent(), `Newest first, ${libraryLine(videos)}`);
    // The visible count stays the count.
    assert.equal(await page.locator("[data-results]").textContent(), libraryLine(videos));

    // With a search the order comes before the matches.
    await page.getByRole("searchbox", { name: "Search videos" }).fill("portfolio");
    await order.selectOption("oldest");
    assert.match(await announcer.textContent(), /^Oldest first, \d+ of \d+ videos match “portfolio”$/);

    // A topic page says it too.
    await page.goto(`/tags/${multiTag}/`);
    await page.getByRole("combobox", { name: "Order" }).selectOption("oldest");
    assert.match(await page.locator("[data-announce]").textContent(), /^Oldest first, \d+ videos/);
});

test("only the plain list draws its newest video large", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await page.goto("/");
    const newest = [...videos].sort((a, b) => b.datePosted.localeCompare(a.datePosted))[0].id;
    const leads = () => page.locator("[data-video-list] > .tile--lead").evaluateAll((items) => items.map((item) => item.dataset.id));
    assert.deepEqual(await leads(), [newest]);

    await page.getByRole("searchbox", { name: "Search videos" }).fill("resume");
    assert.deepEqual(await leads(), []);
    // Every match asks for the small still.
    assert.equal(await shown(page).locator("source").evaluateAll((sources) => sources.every((source) => source.getAttribute("sizes").endsWith("204px"))), true);

    await page.getByRole("searchbox", { name: "Search videos" }).fill("");
    await page.getByRole("combobox", { name: "Order" }).selectOption("oldest");
    assert.deepEqual(await leads(), []);

    await page.getByRole("combobox", { name: "Order" }).selectOption("newest");
    assert.deepEqual(await leads(), [newest]);
    await page.goto("/?sort=oldest");
    assert.deepEqual(await leads(), []);
});

test("a tile's date sits right under its title, and a row's Copy links share one line", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const rows = await shown(page).evaluateAll((items) => {
        const byRow = new Map();
        for (const item of items) {
            const top = Math.round(item.getBoundingClientRect().top);
            const title = item.querySelector(".tile__title").getBoundingClientRect();
            const meta = item.querySelector(".tile__meta").getBoundingClientRect();
            const copy = item.querySelector(".tile__copy").getBoundingClientRect();
            byRow.set(top, [...(byRow.get(top) ?? []), {
                lead: item.classList.contains("tile--lead"),
                gap: Math.round(meta.top - title.bottom),
                copyTop: Math.round(copy.top)
            }]);
        }
        return [...byRow.values()];
    });
    const gaps = new Set(rows.flat().map((tile) => tile.gap));
    assert.ok([...gaps].every((gap) => gap >= 4 && gap <= 12), [...gaps].join());
    for (const row of rows) {
        const copies = new Set(row.filter((tile) => !tile.lead).map((tile) => tile.copyTop));
        assert.ok(copies.size <= 1, JSON.stringify(row));
    }
});

for (const width of [320, 390, 699]) {
    test(`the header's search button is on a phone at ${width} px and goes to the field`, async (t) => {
        const { page } = await site.page(t, { ...PHONE, viewport: { width, height: 740 } });
        await page.goto(`/tags/${multiTag}/`);
        const button = page.getByRole("link", { name: "Search the videos" });
        assert.equal(await button.isVisible(), true);
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44 && box.x + box.width <= width, JSON.stringify(box));
        // The series link makes room for it; it stays in the footer.
        assert.equal(await page.locator(".site-nav").getByRole("link", { name: "Career Quest" }).isVisible(), false);
        assert.equal(await page.locator(".site-footer").getByRole("link", { name: "Career Quest" }).isVisible(), true);

        await button.tap();
        await page.waitForURL((url) => url.pathname === "/" && url.hash === "#search");
        await page.waitForFunction(() => document.activeElement?.id === "search");
    });
}

test("on the home page the phone's search button focuses the field in place", async (t) => {
    const { page } = await site.page(t, PHONE);
    await page.goto("/?q=interview");
    await page.locator("#all-videos").evaluate((section) => section.scrollIntoView());
    await page.getByRole("link", { name: "Search the videos" }).tap();
    assert.equal(await page.evaluate(() => document.activeElement.id), "search");
    assert.equal(new URL(page.url()).searchParams.get("q"), "interview");
});

for (const width of [320, 390]) {
    test(`every link in the header is a 44 px target on a ${width} px touch screen`, async (t) => {
        const { page } = await site.page(t, { ...PHONE, viewport: { width, height: 740 } });
        await page.goto("/wall/");
        const small = await page.locator(".site-header a").evaluateAll((links) => links
            .filter((link) => link.getClientRects().length > 0 && !link.classList.contains("skip-link"))
            .map((link) => ({ text: link.textContent.trim(), box: link.getBoundingClientRect() }))
            .filter(({ box }) => box.width < 44 || box.height < 44)
            .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`));
        assert.deepEqual(small, []);
    });
}

test("the utility bar's focus ring is drawn inside the bar", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/");
    const bar = await page.locator(".utility").boundingBox();
    // The skip link comes first.
    await page.keyboard.press("Tab");
    for (const name of ["Department site", "Instagram", "YouTube"]) {
        await page.keyboard.press("Tab");
        const link = page.locator(".utility").getByRole("link", { name, exact: true });
        assert.equal(await link.evaluate((node) => node === document.activeElement && node.matches(":focus-visible")), true, name);
        const ring = await link.evaluate((node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            const reach = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
            return { top: box.top - reach, bottom: box.bottom + reach, left: box.left - reach, right: box.right + reach, style: style.outlineStyle };
        });
        assert.notEqual(ring.style, "none");
        assert.ok(ring.top >= bar.y && ring.bottom <= bar.y + bar.height, JSON.stringify({ name, ring, bar }));
        assert.ok(ring.right <= 1440, JSON.stringify({ name, ring }));
    }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    test(`the footer's columns line up and its wordmark stays under the page title at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport });
        for (const route of ["/", "/tags/", `/tags/${multiTag}/`, `/videos/${videos[0].id}/`, "/missing/"]) {
            await page.goto(route);
            await page.evaluate(() => document.fonts.ready);
            const footer = await page.evaluate(() => {
                const size = (node) => parseFloat(getComputedStyle(node).fontSize);
                const mark = document.querySelector(".site-footer__mark");
                // The page title size every page head is set at.
                const probe = document.createElement("h1");
                probe.style.fontSize = "var(--h1)";
                document.body.append(probe);
                const pageTitle = size(probe);
                probe.remove();
                const heads = [...document.querySelectorAll(".site-footer__head")].map((head) => head.getBoundingClientRect());
                return {
                    pageTitle,
                    mark: size(mark),
                    markLines: (() => {
                        const range = document.createRange();
                        range.selectNodeContents(mark.querySelector("a"));
                        return new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size;
                    })(),
                    h1: size(document.querySelector("h1")),
                    headLines: [...document.querySelectorAll(".site-footer__head")].map((head) => Math.round(head.getBoundingClientRect().height / parseFloat(getComputedStyle(head).lineHeight))),
                    sameRow: heads.length === 2 && heads[0].top === heads[1].top,
                    wide: document.documentElement.scrollWidth <= innerWidth
                };
            });
            assert.ok(footer.mark < footer.pageTitle, `${route} ${JSON.stringify(footer)}`);
            if (route.startsWith("/videos/") || route.startsWith("/tags/") || route === "/") {
                assert.ok(footer.mark < footer.h1, `${route} ${JSON.stringify(footer)}`);
            }
            assert.equal(footer.markLines, 1, route);
            assert.deepEqual(footer.headLines, [1, 1], route);
            assert.equal(footer.wide, true, route);
            if (viewport.width >= 360) {
                assert.equal(footer.sameRow, true, route);
            }
        }
    });
}

test("on a wide screen the footer's columns start on the index's column lines", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto("/");
    const lines = await page.evaluate(() => {
        const tiles = [...document.querySelectorAll("[data-video-list] > li")].map((item) => Math.round(item.getBoundingClientRect().left));
        const columns = [...document.querySelectorAll(".site-footer__columns > div")].map((column) => Math.round(column.getBoundingClientRect().left));
        return { tiles: [...new Set(tiles)], columns };
    });
    assert.equal(lines.tiles.includes(lines.columns[0]), true, JSON.stringify(lines));
});

test("the phone's list toolbar keeps the order menu and the link button on one row", async (t) => {
    const { page } = await site.page(t, PHONE);
    await page.goto("/");
    const select = await page.getByRole("combobox", { name: "Order" }).boundingBox();
    const button = await page.getByRole("button", { name: "Copy link to this list" }).boundingBox();
    assert.ok(Math.abs((select.y + select.height / 2) - (button.y + button.height / 2)) <= 2, JSON.stringify({ select, button }));
    assert.ok(button.height >= 44);
});
