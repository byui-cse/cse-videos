import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startSite, videos } from "./helpers.mjs";

let site;
before(async () => { site = await startSite(); });
after(async () => { await site?.close(); });

const seriesTag = videos.find((item) => item.series)?.series;
const smallTag = Object.entries(videos.flatMap((item) => item.tags).reduce((counts, slug) => ({ ...counts, [slug]: (counts[slug] ?? 0) + 1 }), {}))
    .find(([slug, count]) => count === 1 && slug !== seriesTag)?.[0];

const fontSize = (page, selector) => page.locator(selector).first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));

/**
 * The texts in the matched elements that break a line inside a word.
 * @param {import("playwright").Page} page
 * @param {string} selector
 */
const brokenWords = (page, selector) => page.evaluate((selector) => {
    const broken = [];
    const range = document.createRange();

    for (const element of document.querySelectorAll(selector)) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let top = null;
        let previous = "";
        let gap = false;

        while (walker.nextNode()) {
            const node = walker.currentNode;

            for (let index = 0; index < node.length; index += 1) {
                const character = node.data[index];

                if (!character.trim()) {
                    gap = true;
                    continue;
                }

                range.setStart(node, index);
                range.setEnd(node, index + 1);
                const box = range.getClientRects()[0];

                if (!box) {
                    continue;
                }

                if (top !== null && box.top > top + 4 && !gap && /\w/.test(previous) && /\w/.test(character)) {
                    broken.push(element.textContent.trim());
                }

                top = box.top;
                previous = character;
                gap = false;
            }
        }
    }

    return broken;
}, selector);

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`page titles share one size and section titles another at ${viewport.width} px`, async (t) => {
        const { page } = await site.page(t, { viewport });
        const titles = [];

        for (const route of ["/tags/", `/tags/${seriesTag}/`, `/tags/${smallTag}/`, "/missing/page", `/videos/${videos[0].id}/`]) {
            await page.goto(route);
            titles.push(await fontSize(page, "main h1"));
        }

        assert.equal(new Set(titles).size, 1, JSON.stringify(titles));

        await page.goto("/");
        const sections = [];

        for (const id of ["listing-heading", "topics-title", "quest-title"]) {
            sections.push(await fontSize(page, `#${id}`));
        }

        assert.equal(new Set(sections).size, 1, JSON.stringify(sections));
        assert.ok(titles[0] / sections[0] >= 1.3, `${titles[0]} over ${sections[0]}`);
    });
}

for (const width of [320, 360, 390, 414, 520, 700, 1000, 1100, 1180, 1280, 1300, 1440]) {
    test(`no topic name breaks inside a word at ${width} px`, async (t) => {
        const { page } = await site.page(t, { viewport: { width, height: 900 } });
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        assert.deepEqual(await brokenWords(page, ".topic-row__name"), []);
        await page.goto("/tags/");
        await page.evaluate(() => document.fonts.ready);
        assert.deepEqual(await brokenWords(page, ".topic__name"), []);
    });
}

for (const width of [1440, 1024, 390]) {
    test(`a wide topic card's two stills read as one picture, as tall as its row's at ${width} px`, async (t) => {
        const { page } = await site.page(t, { viewport: { width, height: 900 } });
        await page.goto("/tags/");
        const shape = await page.evaluate(() => {
            const wide = document.querySelector(".topic--wide");
            const [left, right] = [...wide.querySelectorAll(".topic__image")].map((node) => node.getBoundingClientRect());
            const single = [...document.querySelectorAll(".topic:not(.topic--wide) .topic__image")]
                .map((node) => node.getBoundingClientRect())
                .find((box) => Math.abs(box.top - left.top) < 1);
            return { gap: right.left - left.right, bottom: left.bottom, singleBottom: single?.bottom ?? null, edge: right.right - wide.getBoundingClientRect().right };
        });

        assert.ok(shape.gap <= 4, JSON.stringify(shape));
        assert.ok(Math.abs(shape.edge) < 1, JSON.stringify(shape));

        if (shape.singleBottom !== null) {
            assert.ok(Math.abs(shape.bottom - shape.singleBottom) < 1, JSON.stringify(shape));
        }
    });
}

for (const options of [{ viewport: { width: 390, height: 844 } }, { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true }, { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" }]) {
    test(`the keyboard brings each Career Quest board fully into the swipe row (${options.viewport.width} px${options.reducedMotion ? ", reduced motion" : ""})`, async (t) => {
        const { page } = await site.page(t, options);
        await page.goto("/");
        const row = page.locator("[data-quest-boards]");
        assert.ok(await row.evaluate((node) => node.scrollWidth > node.clientWidth));
        await page.locator(".quest__page").focus();
        const seen = new Set();

        for (let step = 0; step < 12; step += 1) {
            await page.keyboard.press("Tab");
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const focus = await page.evaluate(() => {
                const active = document.activeElement;
                const board = active?.closest(".board");

                if (!board) {
                    return null;
                }

                const box = active.getBoundingClientRect();
                const frame = board.parentElement.getBoundingClientRect();
                return { board: [...board.parentElement.children].indexOf(board), left: box.left - frame.left, right: frame.right - box.right };
            });

            if (focus) {
                seen.add(focus.board);
                assert.ok(focus.left >= -1 && focus.right >= -1, JSON.stringify(focus));
            }
        }

        assert.equal(seen.size, 5);
    });
}

test("in high contrast mode only the focused Career Quest board has an edge", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 }, forcedColors: "active", reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator(".quest__boards .board__link").nth(1).focus();
    const edges = await page.locator(".board__image").evaluateAll((images) => images.map((image) => getComputedStyle(image).outlineWidth));
    assert.deepEqual(edges, ["0px", "3px", "0px", "0px", "0px"]);
});

test("from 700 to 899 px a mouse gets every Career Quest board on the page", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 800, height: 700 } });
    await page.goto("/");
    const layout = await page.locator("[data-quest-boards]").evaluate((row) => ({
        scrolls: row.scrollWidth > row.clientWidth,
        columns: getComputedStyle(row).gridTemplateColumns.split(" ").length
    }));
    assert.deepEqual(layout, { scrolls: false, columns: 3 });
});

for (const width of [1024, 1280, 1440]) {
    test(`a Career Quest board's date line never strands its separator, and its Copy links line up at ${width} px`, async (t) => {
        const { page } = await site.page(t, { viewport: { width, height: 900 } });
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        const lines = await page.evaluate(() => [...document.querySelectorAll(".board__meta")].map((meta) => {
            const [date, length] = meta.querySelectorAll(":scope > time");
            const dateLines = [...date.getClientRects()];
            const box = length.getBoundingClientRect();
            const frame = meta.getBoundingClientRect();
            const dot = getComputedStyle(length, "::before");
            return {
                sameLine: Math.abs(box.top - dateLines.at(-1).top) < 2,
                startsLine: Math.abs(box.left - frame.left) < 1,
                clips: getComputedStyle(meta).overflow === "hidden",
                separator: getComputedStyle(meta.querySelector(':scope > [aria-hidden="true"]')).display,
                // The dot as drawn: no text, a filled disc, its middle in the
                // middle of the gap after the date.
                dot: {
                    content: dot.content,
                    size: [parseFloat(dot.width), parseFloat(dot.height)],
                    filled: dot.backgroundColor !== "rgba(0, 0, 0, 0)",
                    offCentre: Math.abs(box.left + parseFloat(dot.left) + parseFloat(dot.width) / 2 - (dateLines.at(-1).right + box.left) / 2)
                }
            };
        }));

        for (const line of lines) {
            assert.ok(line.sameLine || (line.startsLine && line.clips), JSON.stringify(line));
            assert.equal(line.separator, "none");
            assert.equal(line.dot.content, '""', JSON.stringify(line));
            assert.ok(line.dot.filled && line.dot.size.every((side) => side >= 3), JSON.stringify(line));

            if (line.sameLine) {
                assert.ok(line.dot.offCentre < 1, JSON.stringify(line));
            }
        }

        const tops = await page.locator(".board__copy").evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().top)));
        assert.equal(new Set(tops).size, 1, JSON.stringify(tops));

        // The dot is drawn, not read: each board's name is its part, title,
        // date and spoken length.
        const snapshot = await page.locator(".quest__boards").ariaSnapshot();
        assert.ok(!snapshot.includes("·"), snapshot);
        assert.match(snapshot, /link "Part 1 .+ [A-Z][a-z]{2} \d{1,2}, \d{4} \d+ seconds"/);
    });
}

/**
 * The tiles in each row of a grid: how many lines the title takes, the gap
 * from the title to the date, and where the date and Copy link sit.
 * @param {import("playwright").Page} page
 * @param {string} selector
 */
const tileRows = (page, selector) => page.locator(selector).evaluateAll((items) => {
    const rows = new Map();

    for (const item of items.filter((node) => node.getClientRects().length > 0)) {
        const top = Math.round(item.getBoundingClientRect().top);
        const title = item.querySelector(".tile__title");
        const range = document.createRange();
        range.selectNodeContents(title);
        const meta = item.querySelector(".tile__meta").getBoundingClientRect();
        rows.set(top, [...(rows.get(top) ?? []), {
            lead: item.classList.contains("tile--lead"),
            lines: new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size,
            gap: Math.round(meta.top - title.getBoundingClientRect().bottom),
            date: Math.round(meta.top),
            copy: Math.round(item.querySelector(".tile__copy").getBoundingClientRect().top)
        }]);
    }

    return [...rows.values()];
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    test(`a row's dates share one line at least 12 px under its longest title, and its Copy links another, at ${viewport.width} px`, async (t) => {
        const { page } = await site.page(t, { viewport });
        const lines = new Set();

        for (const route of ["/", `/tags/${seriesTag}/`]) {
            await page.goto(route);
            await page.evaluate(() => document.fonts.ready);
            await page.locator("[data-show-all]").click({ timeout: 1000 }).catch(() => {});

            for (const row of await tileRows(page, "[data-video-list] > li")) {
                const tiles = row.filter((tile) => !tile.lead);

                if (tiles.length === 0) {
                    continue;
                }

                assert.equal(new Set(tiles.map((tile) => tile.date)).size, 1, `${route} ${JSON.stringify(row)}`);
                assert.equal(new Set(tiles.map((tile) => tile.copy)).size, 1, `${route} ${JSON.stringify(row)}`);
                assert.equal(Math.min(...tiles.map((tile) => tile.gap)), 12, `${route} ${JSON.stringify(row)}`);
                tiles.forEach((tile) => lines.add(tile.lines));
            }
        }

        // Rows with one, two and three line titles were all measured.
        assert.ok([1, 2, 3].every((count) => lines.has(count)), [...lines].join());
    });
}

for (const width of [320, 390]) {
    test(`without its public address, the link to send is the page's own, in pieces that break only after a slash, at ${width} px`, async (t) => {
        const { page } = await site.page(t, { viewport: { width, height: 640 } });
        const long = [...videos].sort((a, b) => b.id.length - a.id.length)[0];
        await page.goto(`/videos/${long.id}/`);
        await page.evaluate(() => document.fonts.ready);
        const address = await page.locator("[data-page-url]").evaluate((node) => {
            // The lines a piece's text runs over; its own box is inline-block,
            // so its client rects alone would always say one.
            const lines = (target) => {
                const range = document.createRange();
                range.selectNodeContents(target);
                return new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size;
            };
            const style = getComputedStyle(node);
            const context = document.createElement("canvas").getContext("2d");
            context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

            return {
                lines: lines(node),
                room: node.parentElement.clientWidth,
                pieces: [...node.children].map((piece) => ({ text: piece.textContent, lines: lines(piece), width: Math.round(context.measureText(piece.textContent).width) }))
            };
        });

        assert.deepEqual(address.pieces.map((piece) => piece.text), [`${site.origin}/`, "videos/", `${long.id}/`]);
        assert.ok(address.lines > 1, JSON.stringify(address));
        // A piece breaks inside itself only where it is wider than the line.
        assert.ok(address.pieces.every((piece) => piece.lines === 1 || piece.width > address.room), JSON.stringify(address));
    });
}

test("the header's search button lands on the field and leaves no #search in the address", async (t) => {
    const { page } = await site.page(t, { viewport: { width: 1440, height: 900 } });
    await page.goto(`/tags/${seriesTag}/`);
    await page.locator("[data-search-button]").click();
    await page.waitForFunction(() => document.activeElement?.id === "search");
    const url = new URL(await page.evaluate(() => window.location.href));
    assert.equal(url.pathname, "/");
    assert.equal(url.hash, "");
    assert.equal(await page.evaluate(() => window.scrollY), 0);

    // A search typed there keeps no hash either.
    await page.getByRole("searchbox", { name: "Search videos" }).fill("portfolio");
    await page.waitForFunction(() => new URL(window.location.href).searchParams.get("q") === "portfolio");
    assert.equal(new URL(await page.evaluate(() => window.location.href)).hash, "");
});

for (const width of [390, 1440]) {
    test(`nothing moves when the web fonts arrive at ${width} px`, async (t) => {
        const heights = {};

        for (const blocked of [true, false]) {
            const { page, context } = await site.page(t, { viewport: { width, height: 900 }, reducedMotion: "reduce" });

            if (blocked) {
                await context.route(/\.woff2$/, (route) => route.abort());
            }

            for (const route of ["/", "/tags/", "/missing/page", `/tags/${seriesTag}/`]) {
                await page.goto(route);
                await page.evaluate(() => document.fonts.ready);
                const faces = await page.evaluate(() => [...document.fonts].filter((face) => face.family.endsWith("Fallback")).map((face) => face.status));

                if (blocked && faces.includes("error")) {
                    t.skip("this computer has no Arial or a font with its metrics");
                    return;
                }

                heights[`${route} ${blocked}`] = await page.evaluate(() => [...document.querySelectorAll("main > section")].map((section) => Math.round(section.getBoundingClientRect().height)));
            }
        }

        for (const route of ["/", "/tags/", "/missing/page", `/tags/${seriesTag}/`]) {
            assert.deepEqual(heights[`${route} true`], heights[`${route} false`], route);
        }
    });
}

test("the missing page's search goes to the home page's results, and its topics go to their pages", async (t) => {
    const { page } = await site.page(t);
    await page.goto("/missing/nested/page");
    const search = page.getByRole("searchbox", { name: "Search videos" });
    await search.fill("portfolio");
    await search.press("Enter");
    await page.waitForURL("**/?q=portfolio");
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.getByRole("searchbox").inputValue(), "portfolio");
    assert.match(await page.locator("[data-results]").textContent(), /of \d+ videos match/);

    await page.goto("/missing/nested/page");
    const topic = page.locator(".topic-row__link").first();
    const name = (await topic.textContent()).trim();
    await topic.click();
    assert.match(new URL(page.url()).pathname, /^\/tags\/[\w-]+\/$/);
    assert.equal(await page.getByRole("heading", { level: 1 }).textContent(), name);
});
