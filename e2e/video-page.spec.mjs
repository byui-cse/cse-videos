import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startSite, videos } from "./helpers.mjs";

let site;
before(async () => { site = await startSite(); });
after(async () => { await site?.close(); });

const reel = videos.find((item) => item.instagram && !item.youtube && !item.series);
const reelPath = `/videos/${reel.id}/`;
const box = (page, selector) => page.locator(selector).first().evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
});

test("on a phone the title and the link button come before the video, and the video runs edge to edge", async (t) => {
    const viewport = { width: 390, height: 844 };
    const { page } = await site.page(t, { viewport, isMobile: true, hasTouch: true });
    await page.goto(reelPath);
    await page.evaluate(() => document.fonts.ready);
    const [title, button, frame] = [await box(page, "h1"), await box(page, "[data-copy-link]"), await box(page, ".player__frame")];

    assert.ok(button.bottom <= viewport.height, `the link button ends at ${button.bottom}`);
    assert.ok(title.bottom <= button.top);
    assert.ok(button.bottom <= frame.top, "the link button sits above the video");
    assert.equal(frame.left, 0);
    assert.equal(frame.width, viewport.width);
    // The player already fills the width, so there is nothing to expand.
    assert.equal(await page.getByRole("button", { name: "Expand" }).isVisible(), false);
});

test("on a 360 px phone Instagram's player gets the 20.5rem it needs", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    await page.goto(reelPath);
    assert.ok((await box(page, ".player__iframe")).width >= 328);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    test(`at ${viewport.width}x${viewport.height} the whole Instagram player is on the first screen, the title level with its top`, async (t) => {
        const { page } = await site.page(t, { viewport });
        await page.goto(reelPath);
        await page.evaluate(() => document.fonts.ready);
        const [frame, title, back, bar] = [await box(page, ".player__frame"), await box(page, "h1"), await box(page, ".player-band__back"), await box(page, ".player__bar")];

        assert.ok(frame.bottom <= viewport.height, `the frame ends at ${frame.bottom}`);
        assert.equal(Math.round(title.top), Math.round(frame.top));
        assert.equal(Math.round(back.top), Math.round(bar.top));
        assert.ok(title.left > frame.right, "the title sits beside the player");
    });
}

test("the record ends level with the foot of the player beside it", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto(reelPath);
    await page.evaluate(() => document.fonts.ready);
    const [frame, docket] = [await box(page, ".player__frame"), await box(page, ".docket")];
    assert.equal(Math.round(docket.bottom), Math.round(frame.bottom));
});

test("on a screen 390 px tall the player starts at the top of the band, with the title beside it", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 844, height: 390 }, hasTouch: true });
    await page.goto(reelPath);
    const [band, frame, title] = [await box(page, ".player-band"), await box(page, ".player__frame"), await box(page, "h1")];
    assert.equal(Math.round(frame.top - band.top), 12);
    assert.ok(title.left > frame.right);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
    test(`at ${viewport.width}x${viewport.height} the expanded player fits the window on an opaque ground, and nothing behind it moves`, async (t) => {
        const { page } = await site.page(t, { viewport });
        await page.goto(reelPath);
        await page.evaluate(() => document.fonts.ready);
        const [title, band] = [await box(page, "h1"), await box(page, ".player-band")];

        await page.getByRole("button", { name: "Expand", exact: true }).click();
        const frame = await box(page, ".player__frame");
        assert.ok(frame.top >= 0 && frame.bottom <= viewport.height, JSON.stringify(frame));
        assert.equal(await page.locator("[data-player]").evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(6, 10, 16)");
        assert.deepEqual(await box(page, "h1"), title);
        assert.equal((await box(page, ".player-band")).height, band.height);

        await page.getByRole("button", { name: "Close", exact: true }).click();
        assert.deepEqual(await box(page, "h1"), title);
        assert.equal(await page.locator(".player-band__inner").evaluate((node) => node.style.minHeight), "");
    });
}

for (const query of ["?source=youtube", "?source=bogus"]) {
    test(`a ${query} the video can't use leaves the address, so Copy link doesn't send it on`, async (t) => {
        const { page } = await site.page(t, { permissions: ["clipboard-read", "clipboard-write"] });
        await page.goto(`${reelPath}${query}#main`);
        await page.waitForFunction(() => !location.search);
        assert.equal(page.url(), `${site.origin}${reelPath}#main`);
        assert.equal(await page.locator("[data-player]").getAttribute("data-source"), "instagram");

        await page.getByRole("button", { name: "Copy link", exact: true }).click();
        await page.waitForFunction(() => document.querySelector("[data-copy-status]").textContent === "Link copied");
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${site.origin}${reelPath}#main`);
    });
}

// The titles with the longest words, beside the player on tablets.
const longestWord = (title) => Math.max(...title.split(/\s+/).map((word) => word.length));
const longWords = [...videos].sort((a, b) => longestWord(b.title) - longestWord(a.title)).slice(0, 6);

for (const viewport of [{ width: 700, height: 900 }, { width: 744, height: 1133 }, { width: 768, height: 1024 }, { width: 320, height: 640 }]) {
    test(`no title breaks inside a word at ${viewport.width}x${viewport.height}`, async (t) => {
        const { page } = await site.page(t, { viewport });

        for (const item of longWords) {
            await page.goto(`/videos/${item.id}/`);
            await page.evaluate(() => document.fonts.ready);
            const broken = await page.locator("h1").evaluate((heading) => {
                const words = [];
                const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
                while (walker.nextNode()) {
                    const text = walker.currentNode;
                    for (const match of text.textContent.matchAll(/\S+/g)) {
                        const range = document.createRange();
                        range.setStart(text, match.index);
                        range.setEnd(text, match.index + match[0].length);
                        if (new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1) {
                            words.push(match[0]);
                        }
                    }
                }
                return words;
            });
            assert.deepEqual(broken, [], item.id);
        }
    });
}

test("the address to send breaks only after a slash", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 390, height: 844 } });
    const long = [...videos].sort((a, b) => b.id.length - a.id.length)[0];
    await page.goto(`/videos/${long.id}/`);
    await page.evaluate(() => document.fonts.ready);
    // These tests build without the public address, so the page shows the
    // one it was opened at; put back the public address in its pieces, as
    // the published page has it (lib/pages/video.js).
    const split = await page.locator("[data-page-url]").evaluate((node, pieces) => {
        node.replaceChildren(...pieces.map((text) => Object.assign(document.createElement("span"), { textContent: text })));
        return [...node.children]
            .filter((piece) => new Set([...piece.getClientRects()].map((rect) => Math.round(rect.top))).size > 1)
            .map((piece) => piece.textContent);
    }, ["https://byui-cse.github.io/", "cse-videos/", "videos/", `${long.id}/`]);
    assert.deepEqual(split, []);
});

test("the docket's links answer a hover", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto(reelPath);
    const link = page.locator(".docket a").first();
    const before = await link.evaluate((node) => getComputedStyle(node).textDecorationThickness);
    await link.hover();
    const after = await link.evaluate((node) => getComputedStyle(node).textDecorationThickness);
    assert.notEqual(after, before);
});
