import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notFoundPage, tagPage, tagsPage } from "../lib/render.js";
import { MISSING_TOPICS } from "../lib/pages/not-found.js";
import { EAGER_TOPICS, FEW_VIDEOS } from "../lib/pages/tags.js";

const video = (id, tags, extra = {}) => ({
    id,
    title: `Video ${id}`,
    instagram: `https://www.instagram.com/reel/${id.toUpperCase()}/`,
    datePosted: "2026-10-01",
    length: "0:30",
    tags,
    ...extra
});

const siteOf = (videos, siteUrl = null) => {
    const counts = new Map();

    for (const item of videos) {
        for (const slug of item.tags) {
            counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
    }

    return {
        videos,
        tags: [...counts].map(([slug, count]) => ({ slug, name: slug[0].toUpperCase() + slug.slice(1), count })),
        names: {},
        covers: new Map(videos.map((item) => [item.id, { width: 480, height: 750 }])),
        siteUrl
    };
};

const tiles = (page) => [...page.matchAll(/<li class="(tile[^"]*)" data-id="([\w-]+)"/g)].map((match) => ({ id: match[2], lead: match[1].includes("tile--lead") }));

describe("a topic's page", () => {
    it("keeps its list heading for screen readers, with the order the menu shows", () => {
        const videos = ["a", "b", "c"].map((id, index) => video(id, ["jobs"], { datePosted: `2026-10-0${index + 1}` }));
        const page = tagPage(siteOf(videos), { slug: "jobs", name: "Jobs", count: 3 });

        assert.match(page, /<div class="visually-hidden"><h2 class="section-title section-title--small" id="listing-heading" tabindex="-1" data-heading-newest="Newest first" data-heading-oldest="Oldest first">Newest first<\/h2><\/div>/);
        assert.match(page, /data-sort/);
        assert.match(page, /<p class="tag-hero__count" data-results>3 videos, 1 minute 30 seconds<\/p>/);
        // Three or more videos are drawn as ordinary tiles.
        assert.ok(tiles(page).every((item) => !item.lead));
    });

    it("draws a topic with a few videos at the newest video's size", () => {
        for (let count = 1; count <= FEW_VIDEOS; count += 1) {
            const videos = Array.from({ length: count }, (_, index) => video(`v${index}`, ["rare"]));
            const page = tagPage(siteOf(videos), { slug: "rare", name: "Rare", count });
            const shown = tiles(page);

            assert.equal(shown.length, count);
            assert.ok(shown.every((item) => item.lead), `${count}`);
            assert.match(page, /sizes="\(max-width: 699px\) 92vw, \(max-width: 1099px\) 46vw, 432px"/);
        }

        const single = tagPage(siteOf([video("solo", ["rare"])]), { slug: "rare", name: "Rare", count: 1 });
        assert.match(single, /<h2 class="visually-hidden" id="listing-heading" tabindex="-1">1 video<\/h2>/);
        assert.ok(!single.includes("data-sort"));
    });

    it("lays a series out a column per part and starts it at Part 1, whatever the posting order", () => {
        const parts = [
            video("quest-part-2", ["quest"], { series: "quest", part: 2, datePosted: "2026-10-20" }),
            video("quest-part-1", ["quest"], { series: "quest", part: 1, datePosted: "2026-10-21" }),
            video("quest-part-3", ["quest"], { series: "quest", part: 3, datePosted: "2026-10-22" })
        ];
        const page = tagPage(siteOf(parts), { slug: "quest", name: "Quest", count: 3 });

        assert.match(page, /<section class="index index--tag index--series" aria-labelledby="listing-heading">/);
        assert.match(page, /<a class="button button--light" href="\.\.\/\.\.\/videos\/quest-part-1\/">Start with Part 1<\/a>/);
        assert.match(page, /<h2 class="visually-hidden" id="listing-heading" tabindex="-1">In part order<\/h2>/);
        assert.ok(tiles(page).every((item) => !item.lead));
        // Three columns under 1100 px draw each still wider than a tile.
        const sizes = new Set([...page.matchAll(/<source [^>]*sizes="([^"]+)"/g)].map((match) => match[1]));
        assert.deepEqual([...sizes], ["(max-width: 699px) 46vw, (max-width: 1099px) 31vw, 256px"]);
    });

    it("leaves the series start out of a topic that isn't a series", () => {
        const page = tagPage(siteOf([video("a", ["jobs"]), video("b", ["jobs"])]), { slug: "jobs", name: "Jobs", count: 2 });

        assert.ok(!page.includes("Start with Part"));
        assert.ok(!page.includes("index--series"));
    });
});

describe("the topics page", () => {
    it("heads the page in two halves and lists every topic, the most used first", () => {
        const videos = [video("a", ["jobs", "ai"]), video("b", ["jobs"]), video("c", ["jobs", "faith"])];
        const page = tagsPage(siteOf(videos));

        assert.match(page, /<div class="container page-band__inner">\s*<h1 class="page-band__title" id="page-title">Topics<\/h1>\s*<p class="page-band__meta">3 topics across 3 videos, the most used first\./);
        const order = [...page.matchAll(/<a class="topic__link" href="([\w-]+)\/">/g)].map((match) => match[1]);
        assert.deepEqual(order, ["jobs", "ai", "faith"]);
        assert.match(page, /<li class="topic topic--wide">/);
        assert.match(page, /<section class="topics" aria-label="Every topic">/);
    });

    it("loads the first screen's cards at once, and the first card's stills first of all", () => {
        const slugs = Array.from({ length: EAGER_TOPICS + 2 }, (_, index) => `topic-${String.fromCharCode(97 + index)}`);
        // Each topic is used once more than the next, so the order is fixed.
        const videos = slugs.flatMap((slug, rank) => Array.from({ length: slugs.length - rank }, (_, index) => video(`${slug}-${index}`, [slug])));
        const page = tagsPage(siteOf(videos));
        const cards = page.split('<li class="topic').slice(1).map((card) => [...card.matchAll(/<img [^>]*>/g)].map((match) => match[0]));

        assert.equal(cards.length, slugs.length);

        cards.forEach((images, index) => {
            assert.ok(images.length > 0, `${index}`);

            for (const image of images) {
                assert.match(image, index < EAGER_TOPICS ? /loading="eager"/ : /loading="lazy"/, `${index}`);
                assert.equal(image.includes('fetchpriority="high"'), index === 0, `${index}`);
            }
        });

        // The first card is a wide one, with two stills.
        assert.equal(cards[0].length, 2);
    });
});

describe("the missing page", () => {
    const videos = Array.from({ length: 12 }, (_, index) => video(`v${index}`, [`topic-${String.fromCharCode(97 + index)}`, ...(index < 6 ? ["popular"] : [])]));
    const site = siteOf(videos, "https://example.org/cse-videos/");

    it("says what happened in the site's words, never calling a topic a tag", () => {
        const page = notFoundPage(site);
        const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));

        assert.match(page, /<h1 class="missing__title" id="page-title">Page not found<\/h1>/);
        assert.match(main, /This address doesn’t go to a video or a topic\./);
        assert.match(page, /<meta name="description" content="This address doesn’t go to a video or a topic\.">/);
        assert.doesNotMatch(main.replace(/<[^>]+>/g, " "), /\btags?\b/i);
    });

    it("searches the home page's list from the site's root path, and links every video", () => {
        const page = notFoundPage(site);

        assert.match(page, /<form class="search" role="search" action="\/cse-videos\/" method="get" data-needs-js hidden>/);
        assert.match(page, /<label class="visually-hidden" for="missing-search">Search videos<\/label>/);
        assert.match(page, /<input class="search__input" id="missing-search" name="q" type="search"/);
        // The home page's list script looks for its own field only.
        assert.ok(!page.includes("data-search-input"));
        assert.match(page, /<a class="button button--light" href="\/cse-videos\/">See all videos<\/a>/);
    });

    it("lists the most used topics from the site's root path, with a link to the rest", () => {
        const page = notFoundPage(site);
        const rows = [...page.matchAll(/<a class="topic-row__link" href="([^"]+)">([^<]+)<\/a>/g)].map((match) => match[1]);

        assert.equal(rows.length, MISSING_TOPICS);
        assert.equal(rows[0], "/cse-videos/tags/popular/");
        assert.ok(rows.every((href) => href.startsWith("/cse-videos/tags/")));
        assert.match(page, new RegExp(`The ${MISSING_TOPICS} most used of 13 topics\\. <a href="/cse-videos/tags/">See them all</a>`));
        assert.match(page, /<img src="\/cse-videos\/covers\//);
    });

    it("lists every topic when there are only a few, and none when there are none", () => {
        const few = notFoundPage(siteOf([video("a", ["jobs"]), video("b", ["ai"])]));
        assert.match(few, /All 2 topics, the most used first\./);
        assert.ok(!few.includes("See them all"));

        const empty = notFoundPage(siteOf([]));
        assert.ok(!empty.includes('class="topics"'));
        assert.match(empty, /Page not found/);
    });
});
