import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countText, listUrl, measuredHeight, playerUrl, plural, readListParams, requestedSource } from "../src/js/state.js";

describe("list address", () => {
    it("reads the search and order, falling back to newest first", () => {
        assert.deepEqual(readListParams("?q=%20portfolio%20&sort=oldest"), { query: "portfolio", order: "oldest" });
        assert.deepEqual(readListParams("?sort=OLDEST"), { query: "", order: "newest" });
        assert.deepEqual(readListParams("?sort=foo&q="), { query: "", order: "newest" });
        assert.deepEqual(readListParams(""), { query: "", order: "newest" });
    });

    it("writes only what isn't the default and keeps other parameters", () => {
        assert.equal(listUrl("https://x.org/?q=old", "", "newest"), "https://x.org/");
        assert.equal(listUrl("https://x.org/", "c++ & c#", "oldest"), "https://x.org/?q=c%2B%2B+%26+c%23&sort=oldest");
        assert.equal(listUrl("https://x.org/tags/ai/?ref=mail", "", "oldest"), "https://x.org/tags/ai/?ref=mail&sort=oldest");
    });

    it("words the results count", () => {
        assert.equal(countText(36, 36, ""), "36 videos");
        assert.equal(countText(1, 1, ""), "1 video");
        assert.equal(countText(5, 36, "port"), "5 of 36 videos match “port”");
        assert.equal(countText(0, 36, "zzz"), "No videos match “zzz”");
        assert.equal(plural(2, "tag"), "2 tags");
    });
});

describe("player address", () => {
    it("honors ?source= only for a player this video has", () => {
        assert.equal(requestedSource("?source=instagram", ["youtube", "instagram"]), "instagram");
        assert.equal(requestedSource("?source=youtube", ["instagram"]), null);
        assert.equal(requestedSource("?source=evil", ["youtube", "instagram"]), null);
        assert.equal(requestedSource("?source=constructor", ["youtube"]), null);
        assert.equal(requestedSource("", ["youtube"]), null);
    });

    it("leaves the default player out of the address", () => {
        assert.equal(playerUrl("https://x.org/videos/a/", "instagram", "youtube"), "https://x.org/videos/a/?source=instagram");
        assert.equal(playerUrl("https://x.org/videos/a/?source=instagram", "youtube", "youtube"), "https://x.org/videos/a/");
    });

    it("reads Instagram's height message and nothing else", () => {
        assert.equal(measuredHeight('{"details":{"height":583.2},"type":"MEASURE"}'), 584);
        assert.equal(measuredHeight({ type: "MEASURE", details: { height: 700 } }), 700);
        assert.equal(measuredHeight('{"details":{"height":583},"type":"LOADING"}'), null);
        assert.equal(measuredHeight('{"details":{"height":99999},"type":"MEASURE"}'), null);
        assert.equal(measuredHeight('{"details":{"height":"tall"},"type":"MEASURE"}'), null);
        assert.equal(measuredHeight("not json"), null);
        assert.equal(measuredHeight(null), null);
    });
});
