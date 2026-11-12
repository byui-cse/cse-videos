import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { addressParts } from "../lib/pages/video.js";
import { build } from "../scripts/build.js";
import { startSite, videos } from "./helpers.mjs";

let site;
before(async () => { site = await startSite(); });
after(async () => { await site?.close(); });

const reel = videos.find((item) => item.instagram && !item.youtube && !item.series);
const reelPath = `/videos/${reel.id}/`;
const middlePart = videos.find((item) => item.series && item.part === 3);
const box = (page, selector) => page.locator(selector).first().evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
});
// A stand-in for Instagram's player with nothing to focus inside it, so Tab
// passes through the frame the way it does through the real one.
const emptyEmbed = (page) => page.route("https://www.instagram.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Reel</title>" }));

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
    // The whole player already shows at the screen's width, so there is nothing to expand.
    assert.equal(await page.getByRole("button", { name: "Expand" }).isVisible(), false);
});

test("on a 360 px phone Instagram's player gets the 20.5rem it needs", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    await page.goto(reelPath);
    assert.ok((await box(page, ".player__iframe")).width >= 328);
});

test("a phone held sideways keeps a reel to Instagram's 20.5rem, in line with the title, and offers Expand", async (t) => {
    const viewport = { width: 667, height: 375 };
    const { page } = await site.page(t, { viewport, isMobile: true, hasTouch: true });
    await page.goto(reelPath);
    await page.evaluate(() => document.fonts.ready);
    const [title, button, frame] = [await box(page, "h1"), await box(page, "[data-copy-link]"), await box(page, ".player__frame")];

    assert.equal(frame.width, 328);
    assert.equal(frame.left, title.left);
    assert.ok(button.bottom <= frame.top, "the link button still comes before the video");
    assert.equal(await page.getByRole("button", { name: "Expand", exact: true }).isVisible(), true);
});

// 1280x1024 and 1366x768 at 400 percent zoom, and a short window 360 px wide,
// where the reel's own column is wider than the space between the gutters.
for (const viewport of [{ width: 320, height: 256 }, { width: 341, height: 192 }, { width: 360, height: 400 }]) {
    test(`at ${viewport.width}x${viewport.height} the page doesn't scroll sideways and the player and Expand are whole on screen`, async (t) => {
        const { page } = await site.page(t, { viewport });
        await page.goto(reelPath);
        await page.evaluate(() => document.fonts.ready);
        const [frame, expand] = [await box(page, ".player__frame"), await box(page, "[data-expand]")];
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

        assert.equal(sideways, 0);
        assert.ok(frame.left >= 0 && frame.right <= viewport.width, JSON.stringify(frame));
        assert.ok(frame.width >= Math.min(328, viewport.width), `the frame is ${frame.width} px wide`);
        assert.ok(expand.left >= 0 && expand.right <= viewport.width, JSON.stringify(expand));
    });
}

for (const viewport of [{ width: 1920, height: 1080 },{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
    test(`at ${viewport.width}x${viewport.height} the whole Instagram player is on the first screen, its top level with the back link`, async (t) => {
        const { page } = await site.page(t, { viewport });
        await page.goto(reelPath);
        await page.evaluate(() => document.fonts.ready);
        const [frame, title, back] = [await box(page, ".player__frame"), await box(page, "h1"), await box(page, ".player-band__back")];

        assert.ok(frame.bottom <= viewport.height, `the frame ends at ${frame.bottom}`);
        assert.ok(frame.width >= 328);
        assert.equal(Math.round(back.top), Math.round(frame.top));
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

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
    test(`at ${viewport.width}x${viewport.height} Tab runs down the column beside the player, into the video, then on to the record`, async (t) => {
        const { page } = await site.page(t, { viewport, hasTouch: viewport.height < 500 });
        await emptyEmbed(page);
        await page.goto(`/videos/${middlePart.id}/`);
        await page.evaluate(() => document.fonts.ready);
        const frame = await box(page, ".player__frame");
        await page.locator("[data-back]").focus();

        const stops = [];
        for (let step = 0; step < 30; step++) {
            const stop = await page.evaluate(() => {
                const node = document.activeElement;
                if (!node?.closest(".player-band")) {
                    return null;
                }
                const rect = node.getBoundingClientRect();
                return { name: node.tagName === "IFRAME" ? "the video" : node.textContent.trim(), top: rect.top + scrollY, left: rect.left };
            });
            if (!stop) {
                break;
            }
            if (stops.at(-1)?.name !== stop.name) {
                stops.push(stop);
            }
            await page.keyboard.press("Tab");
        }

        const names = stops.map((stop) => stop.name);
        assert.deepEqual(names.slice(0, 2), ["All videos", "Career Quest"]);
        assert.equal(names.indexOf("Copy link") + 1, names.indexOf("Open on Instagram"), names.join(" / "));
        assert.equal(names.indexOf("Open on Instagram") + 1, names.indexOf("Expand"), names.join(" / "));
        assert.equal(names.indexOf("Expand") + 1, names.indexOf("the video"), names.join(" / "));
        assert.match(names[names.indexOf("the video") + 1], /^Previous: Part 2/);

        const column = stops.filter((stop) => stop.name !== "the video");
        for (const [index, stop] of column.entries()) {
            assert.ok(stop.left >= frame.right, `${stop.name} sits beside the player`);
            assert.ok(index === 0 || stop.top >= column[index - 1].top, `${stop.name} comes after ${column[index - 1]?.name} on the page`);
        }
    });
}

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

test("a narrow window too short for the whole player at its width offers Expand, and the expanded player fits it", async (t) => {
    const viewport = { width: 680, height: 1000 };
    const { page } = await site.page(t, { viewport });
    await page.goto(reelPath);
    assert.ok((await box(page, ".player__frame")).height > viewport.height);

    await page.getByRole("button", { name: "Expand", exact: true }).click();
    const frame = await box(page, ".player__frame");
    assert.ok(frame.top >= 0 && frame.bottom <= viewport.height, JSON.stringify(frame));
});

test("Close stays on screen when a phone turns upright with the player open, and closing leaves focus on the video", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 844, height: 390 }, hasTouch: true });
    await page.goto(reelPath);
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });

    const close = page.getByRole("button", { name: "Close", exact: true });
    assert.equal(await close.isVisible(), true);
    const closeBox = await close.boundingBox();
    assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= 844 && closeBox.x + closeBox.width <= 390, JSON.stringify(closeBox));

    await close.click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Expand" }).isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), "IFRAME");
});

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

describe("the address to send, as the published page writes it", () => {
    // The other tests build without the public address, where the page shows
    // the one it was opened at. This builds the pages as they are published
    // and serves them in place of the test build's.
    const PUBLIC = "https://byui-cse.github.io/cse-videos/";
    const longest = [...videos].sort((a, b) => b.id.length - a.id.length).slice(0, 6);
    const published = new Map();
    let directory;

    before(async () => {
        directory = await mkdtemp(path.join(tmpdir(), "cse-published-"));
        await build({ outDir: path.join(directory, "site"), siteUrl: PUBLIC });
        for (const item of longest) {
            published.set(item.id, await readFile(path.join(directory, "site", "videos", item.id, "index.html"), "utf8"));
        }
    });
    after(async () => { await rm(directory, { recursive: true, force: true }); });

    const openPublished = async (page, id) => {
        await page.route(`**/videos/${id}/`, (route) => route.fulfill({ contentType: "text/html", body: published.get(id) }));
        await page.goto(`/videos/${id}/`);
        await page.evaluate(() => document.fonts.ready);
    };

    for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 854 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
        test(`breaks only after a slash at ${viewport.width}x${viewport.height}`, async (t) => {
            const { page } = await site.page(t, { viewport });

            for (const item of longest) {
                await openPublished(page, item.id);
                // A piece is an inline block, one box however many lines it
                // takes; its text's own boxes say where it wraps.
                const pieces = await page.locator("[data-page-url] > span").evaluateAll((nodes) => nodes.map((node) => {
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    return { text: node.textContent, lines: new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size };
                }));
                assert.deepEqual(pieces.map((piece) => piece.text), addressParts(`${PUBLIC}videos/${item.id}/`));
                assert.deepEqual(pieces.filter((piece) => piece.lines > 1).map((piece) => piece.text), [], item.id);
            }
        });
    }

    test("on a 480 px phone the docket puts the address under its label, on a line of its own", async (t) => {
        const { page } = await site.page(t, { viewport: { width: 480, height: 854 } });
        await openPublished(page, longest[0].id);
        const [label, address, docket] = [await box(page, ".docket dt:last-of-type"), await box(page, ".docket dd:last-of-type"), await box(page, ".docket")];
        assert.equal(address.left, label.left);
        assert.ok(address.top >= label.bottom);
        assert.equal(address.width, docket.width);
    });
});

describe("YouTube players", () => {
    // The real data has no YouTube links yet: a 16:9 talk and a Short.
    const youtubeVideos = [
        { id: "a-talk", title: "A talk from the department", youtube: "https://www.youtube.com/watch?v=abcdefghijk", datePosted: "2026-10-02", tags: ["job-search"] },
        { id: "a-short", title: "A Short", youtube: "https://www.youtube.com/shorts/bcdefghijkl", datePosted: "2026-10-01", tags: ["job-search"] }
    ];
    let dataDir;
    let youtube;

    before(async () => {
        dataDir = await mkdtemp(path.join(tmpdir(), "cse-youtube-"));
        const dataFile = path.join(dataDir, "videos.json");
        await writeFile(dataFile, JSON.stringify(youtubeVideos));
        youtube = await startSite({ dataFile });
    });
    after(async () => {
        await youtube?.close();
        await rm(dataDir, { recursive: true, force: true });
    });

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 844, height: 390 }]) {
        test(`at ${viewport.width}x${viewport.height} a 16:9 player fills its column inside the window, its controls beside it`, async (t) => {
            const { page } = await youtube.page(t, { viewport, hasTouch: viewport.height < 500 });
            await page.goto("/videos/a-talk/");
            const [frame, bar, title] = [await box(page, ".player__frame"), await box(page, ".player__bar"), await box(page, "h1")];

            assert.ok(frame.bottom <= viewport.height, `the frame ends at ${frame.bottom}`);
            assert.ok(frame.width >= 400, `the frame is ${frame.width} px wide`);
            assert.ok(bar.left >= frame.right && title.left >= frame.right);
        });
    }

    test("an expanded Short on a short screen keeps its controls on one line, and all of it fits", async (t) => {
        const viewport = { width: 844, height: 390 };
        const { page } = await youtube.page(t, { viewport, hasTouch: true });
        await page.goto("/videos/a-short/");
        await page.getByRole("button", { name: "Expand", exact: true }).click();
        const [bar, frame] = [await box(page, ".player__bar"), await box(page, ".player__frame")];

        assert.ok(bar.height <= 48, `the controls take ${bar.height} px`);
        assert.ok(frame.top >= bar.bottom && frame.bottom <= viewport.height, JSON.stringify(frame));
    });
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
