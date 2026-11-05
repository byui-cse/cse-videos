import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { relatedVideos, seriesNeighbors, seriesParts } from "../lib/related.js";

const video = (id, tags, overrides = {}) => ({
    id,
    title: id,
    datePosted: "2026-10-01",
    tags,
    ...overrides
});

describe("seriesParts", () => {
    it("returns an empty list when the video has no series", () => {
        const standalone = video("standalone", ["jobs"]);
        assert.deepEqual(seriesParts(standalone, [standalone]), []);
    });

    it("returns only the same series in part order without changing the input", () => {
        const first = video("first", ["jobs"], { series: "career-quest", part: 1 });
        const second = video("second", ["jobs"], { series: "career-quest", part: 2 });
        const other = video("other", ["jobs"], { series: "another-series", part: 1 });
        const videos = [second, other, first];

        assert.deepEqual(seriesParts(first, videos), [first, second]);
        assert.deepEqual(videos, [second, other, first]);
    });
});

describe("seriesNeighbors", () => {
    const first = video("first", ["jobs"], { series: "career-quest", part: 1 });
    const middle = video("middle", ["jobs"], { series: "career-quest", part: 2 });
    const last = video("last", ["jobs"], { series: "career-quest", part: 3 });
    const videos = [last, first, middle];

    it("finds neighbors from part order", () => {
        assert.deepEqual(seriesNeighbors(middle, videos), { previous: first, next: last });
    });

    it("uses null at the first and last parts", () => {
        assert.deepEqual(seriesNeighbors(first, videos), { previous: null, next: middle });
        assert.deepEqual(seriesNeighbors(last, videos), { previous: middle, next: null });
    });

    it("uses null for a video without a series", () => {
        assert.deepEqual(seriesNeighbors(video("standalone", ["jobs"]), videos), { previous: null, next: null });
    });
});

describe("relatedVideos", () => {
    it("ranks a rare shared tag ahead of a common one", () => {
        const target = video("target", ["common", "rare"]);
        const common = video("common", ["common"], { datePosted: "2026-12-01" });
        const rare = video("rare", ["rare"], { datePosted: "2026-01-01" });
        const videos = [target, common, rare, video("more-common", ["common"])];

        assert.deepEqual(relatedVideos(target, videos), [rare, common, videos[3]]);
    });

    it("breaks score ties by posted date, created date, then title", () => {
        const target = video("target", ["jobs"]);
        const old = video("old", ["jobs"], { datePosted: "2026-09-01" });
        const alpha = video("alpha", ["jobs"], { title: "Alpha" });
        const beta = video("beta", ["jobs"], { title: "Beta" });
        const madeLater = video("made-later", ["jobs"], { dateCreated: "2026-09-30" });

        assert.deepEqual(relatedVideos(target, [old, beta, target, alpha, madeLater, video("unrelated", ["music"])]),
            [madeLater, alpha, beta, old]);
    });

    it("excludes the current video and every member of its series", () => {
        const target = video("target", ["jobs"], { series: "career-quest", part: 1 });
        const sibling = video("sibling", ["jobs"], { series: "career-quest", part: 2 });
        const other = video("other", ["jobs"]);

        assert.deepEqual(relatedVideos(target, [target, sibling, other, video("unrelated", ["music"])]), [other]);
    });

    it("excludes zero scores and does not pad the result", () => {
        const target = video("target", ["jobs"]);
        const unrelated = video("unrelated", ["music"]);
        assert.deepEqual(relatedVideos(target, [target, unrelated]), []);

        const same = video("same", ["jobs"]);
        assert.deepEqual(relatedVideos(target, [target, same]), []);
    });

    it("uses the default limit of six and accepts a smaller limit", () => {
        const target = video("target", ["jobs"]);
        const matches = Array.from({ length: 7 }, (_, index) =>
            video(`match-${index}`, ["jobs"], { datePosted: `2026-10-${String(index + 2).padStart(2, "0")}` }));
        const videos = [target, ...matches, video("unrelated", ["music"])];

        assert.deepEqual(relatedVideos(target, videos), matches.slice(1).reverse());
        assert.deepEqual(relatedVideos(target, videos, { limit: 2 }), matches.slice(-2).reverse());
        assert.deepEqual(relatedVideos(target, videos, { limit: 0 }), []);
    });
});
