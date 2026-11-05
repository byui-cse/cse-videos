import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    backTarget,
    chooseSource,
    countText,
    isPlainClick,
    isSource,
    listUrl,
    measuredHeight,
    onlySource,
    playerState,
    playerUrl,
    plural,
    readListParams,
    requestedSource,
    shareMode
} from "../src/js/state.js";

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

    it("uses an oldest-first page default when reading and writing the address", () => {
        assert.deepEqual(readListParams("", "oldest"), { query: "", order: "oldest" });
        assert.deepEqual(readListParams("?sort=newest", "oldest"), { query: "", order: "newest" });
        assert.deepEqual(readListParams("?sort=oldest", "oldest"), { query: "", order: "oldest" });
        assert.deepEqual(readListParams("?sort=invalid", "oldest"), { query: "", order: "oldest" });
        assert.equal(listUrl("https://x.org/tags/career-quest/", "", "newest", "oldest"), "https://x.org/tags/career-quest/?sort=newest");
        assert.equal(listUrl("https://x.org/tags/career-quest/?sort=oldest", "", "oldest", "oldest"), "https://x.org/tags/career-quest/");
    });

    it("words the results count", () => {
        assert.equal(countText(36, 36, ""), "36 videos");
        assert.equal(countText(1, 1, ""), "1 video");
        assert.equal(countText(5, 36, "port"), "5 of 36 videos match “port”");
        assert.equal(countText(0, 36, "zzz"), "No videos match “zzz”");
        assert.equal(plural(2, "tag"), "2 tags");
    });
});

describe("sharing", () => {
    it("uses the share sheet only when sharing is available on a coarse pointer", () => {
        assert.equal(shareMode({ canShare: true, coarsePointer: true }), "share");
        assert.equal(shareMode({ canShare: true, coarsePointer: false }), "copy");
        assert.equal(shareMode({ canShare: false, coarsePointer: true }), "copy");
        assert.equal(shareMode({ canShare: false, coarsePointer: false }), "copy");
    });
});

describe("back link", () => {
    const here = "https://example.org/videos/portfolio-intro/";

    it("returns to home or a search on home", () => {
        assert.deepEqual(backTarget("https://example.org/", here), { href: "https://example.org/", kind: "home" });
        assert.deepEqual(backTarget("https://example.org/?sort=oldest", here), { href: "https://example.org/?sort=oldest", kind: "home" });
        assert.deepEqual(backTarget("https://example.org/?q=portfolio&sort=oldest", here), {
            href: "https://example.org/?q=portfolio&sort=oldest", kind: "results"
        });
        assert.deepEqual(backTarget("https://example.org/?q=%20", here), { href: "https://example.org/?q=%20", kind: "home" });
    });

    it("returns to a tag page", () => {
        assert.deepEqual(backTarget("https://example.org/tags/career-quest/?sort=oldest", here), {
            href: "https://example.org/tags/career-quest/?sort=oldest", kind: "tag"
        });
        assert.deepEqual(backTarget("https://example.org/tags/career-quest/?q=portfolio", here), {
            href: "https://example.org/tags/career-quest/?q=portfolio", kind: "results"
        });
    });

    it("uses the video path to find a subpath deployment's root", () => {
        assert.deepEqual(backTarget("https://example.org/cse-videos/?q=portfolio", "https://example.org/cse-videos/videos/intro/?source=youtube"), {
            href: "https://example.org/cse-videos/?q=portfolio", kind: "results"
        });
        assert.deepEqual(backTarget("https://example.org/cse-videos/tags/career-quest/", "https://example.org/cse-videos/videos/intro/"), {
            href: "https://example.org/cse-videos/tags/career-quest/", kind: "tag"
        });
        assert.equal(backTarget("https://example.org/", "https://example.org/cse-videos/videos/intro/"), null);
    });

    it("ignores pages that are not a list on this site", () => {
        assert.equal(backTarget("https://other.org/?q=portfolio", here), null);
        assert.equal(backTarget("", here), null);
        assert.equal(backTarget("https://example.org/videos/another/", here), null);
        assert.equal(backTarget("not a URL", here), null);
    });

    it("takes over only a plain click with the main button", () => {
        const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
        assert.equal(isPlainClick(click), true);

        for (const change of [{ button: 1 }, { button: 2 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }]) {
            assert.equal(isPlainClick({ ...click, ...change }), false, JSON.stringify(change));
        }
    });
});

describe("player address", () => {
    it("tracks loading, slow, and ready player states", () => {
        assert.equal(playerState({ source: "instagram", elapsedMs: 0, sawInstagramMessage: false }), "loading");
        assert.equal(playerState({ source: "instagram", elapsedMs: 9999, sawInstagramMessage: false }), "loading");
        assert.equal(playerState({ source: "instagram", elapsedMs: 10000, sawInstagramMessage: false }), "slow");
        assert.equal(playerState({ source: "instagram", elapsedMs: 500, sawInstagramMessage: true }), "ready");
        assert.equal(playerState({ source: "instagram", elapsedMs: 15000, sawInstagramMessage: true }), "ready");
        assert.equal(playerState({ source: "youtube", elapsedMs: 15000, sawInstagramMessage: false }), "ready");
    });

    it("honors ?source= only for a player this video has", () => {
        assert.equal(requestedSource("?source=instagram", ["youtube", "instagram"]), "instagram");
        assert.equal(requestedSource("?source=youtube", ["instagram"]), null);
        assert.equal(requestedSource("?source=evil", ["youtube", "instagram"]), null);
        assert.equal(requestedSource("?source=constructor", ["youtube"]), null);
        assert.equal(requestedSource("", ["youtube"]), null);
    });

    it("knows only YouTube and Instagram as players", () => {
        assert.equal(isSource("youtube"), true);
        assert.equal(isSource("instagram"), true);
        for (const value of ["", "YouTube", "tiktok", "constructor", "toString", null, undefined, 1, {}]) {
            assert.equal(isSource(value), false, String(value));
        }
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

describe("player preference", () => {
    const both = ["youtube", "instagram"];
    const choose = (options) => chooseSource({ requested: null, preferred: null, available: both, fallback: "youtube", ...options });

    it("plays a ?source= request the video has, over the preference", () => {
        assert.equal(choose({ requested: "youtube", preferred: "instagram" }), "youtube");
        assert.equal(choose({ requested: "instagram", preferred: "youtube" }), "instagram");
        assert.equal(choose({ requested: "instagram" }), "instagram");
    });

    it("skips a request the video lacks and uses the preference", () => {
        assert.equal(choose({ requested: "youtube", preferred: "instagram", available: ["instagram"], fallback: "instagram" }), "instagram");
        assert.equal(choose({ requested: "evil", preferred: "instagram" }), "instagram");
    });

    it("uses the preference when the video has it and nothing is requested", () => {
        assert.equal(choose({ preferred: "instagram" }), "instagram");
        assert.equal(choose({ preferred: "youtube", fallback: "instagram" }), "youtube");
    });

    it("falls back to the page's default without a usable preference", () => {
        assert.equal(choose({}), "youtube");
        assert.equal(choose({ preferred: "youtube", available: ["instagram"], fallback: "instagram" }), "instagram");
        assert.equal(choose({ preferred: "instagram", available: ["youtube"] }), "youtube");
        assert.equal(choose({ preferred: "tiktok" }), "youtube");
        assert.equal(choose({ preferred: "constructor", requested: "toString" }), "youtube");
    });

    it("never picks a player the video lacks", () => {
        assert.equal(choose({ available: ["instagram"], fallback: "youtube" }), "instagram");
        assert.equal(choose({ requested: "youtube", preferred: "youtube", available: ["instagram"], fallback: "youtube" }), "instagram");
        assert.equal(choose({ available: ["vimeo", "instagram"], fallback: "vimeo" }), "instagram");
        assert.equal(choose({ requested: "youtube", preferred: "youtube", available: [], fallback: "youtube" }), null);
    });

    it("names the one player a video is on when the viewer prefers the other", () => {
        assert.equal(onlySource({ preferred: "youtube", available: ["instagram"] }), "instagram");
        assert.equal(onlySource({ preferred: "instagram", available: ["youtube"] }), "youtube");
    });

    it("says nothing when the preference was used, is missing, or the video has both", () => {
        assert.equal(onlySource({ preferred: "instagram", available: ["instagram"] }), null);
        assert.equal(onlySource({ preferred: null, available: ["instagram"] }), null);
        assert.equal(onlySource({ preferred: "evil", available: ["instagram"] }), null);
        assert.equal(onlySource({ preferred: "youtube", available: both }), null);
        assert.equal(onlySource({ preferred: "youtube", available: [] }), null);
    });
});
