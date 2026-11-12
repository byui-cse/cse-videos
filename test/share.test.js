import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { addressParts as builtParts } from "../lib/pages/video.js";
import { addressParts } from "../src/js/share.js";

const videos = JSON.parse(await readFile(new URL("../data/videos.json", import.meta.url), "utf8"));

describe("the link to send, in the browser", () => {
    it("breaks into the same pieces as the build writes", () => {
        const sites = ["https://byui-cse.github.io/cse-videos/", "http://localhost:5190/", "http://127.0.0.1:41234/"];

        for (const site of sites) {
            for (const video of videos) {
                const address = `${site}videos/${video.id}/`;
                assert.deepEqual(addressParts(address), builtParts(address), address);
                assert.equal(addressParts(address).join(""), address);
            }
        }
    });

    it("keeps the site whole and gives each folder its own piece", () => {
        assert.deepEqual(addressParts("http://localhost:5222/videos/informational-interviews-what-to-ask/"),
            ["http://localhost:5222/", "videos/", "informational-interviews-what-to-ask/"]);
    });
});
