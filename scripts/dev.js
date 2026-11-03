/**
 * Local development: builds the site, serves dist/, and rebuilds whenever
 * something in src/ or data/ changes. Run with `npm run dev`, then refresh
 * the browser after saving.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { build, DATA_FILE, DIST, plural, SRC } from "./build.js";

const PORT = Number(process.env.PORT) || 5190;

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
};

// Builds run one after another, so a quick second save can't overlap the first.
let queue = Promise.resolve();

const rebuild = () => {
    queue = queue.then(async () => {
        try {
            const { videos } = await build();
            console.log(`Built at ${new Date().toLocaleTimeString()} (${plural(videos, "video")})`);
        } catch (error) {
            console.error(error.message);
        }
    });
};

let timer;

const scheduleRebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
};

const send = (response, status, body, type = "text/plain; charset=utf-8") => {
    response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
    response.end(body);
};

const server = http.createServer(async (request, response) => {
    let pathname;

    try {
        pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
        return send(response, 400, "Bad request");
    }

    let file = path.join(DIST, pathname);

    if (file !== DIST && !file.startsWith(DIST + path.sep)) {
        return send(response, 403, "Forbidden");
    }

    try {
        if ((await fs.promises.stat(file)).isDirectory()) {
            // Match GitHub Pages: folders need a trailing slash so relative links resolve.
            if (!pathname.endsWith("/")) {
                response.writeHead(301, { Location: `${pathname}/` });
                return response.end();
            }

            file = path.join(file, "index.html");
        }

        const body = await fs.promises.readFile(file);
        send(response, 200, body, TYPES[path.extname(file)] ?? "application/octet-stream");
    } catch {
        send(response, 404, "Not found");
    }
});

rebuild();
await queue;

fs.watch(SRC, { recursive: true }, scheduleRebuild);
fs.watch(path.dirname(DATA_FILE), { recursive: true }, scheduleRebuild);

server.listen(PORT, "127.0.0.1", () => {
    console.log(`CSE Videos is running at http://localhost:${PORT}`);
});
