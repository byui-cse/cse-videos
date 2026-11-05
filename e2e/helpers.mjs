import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { build } from "../scripts/build.js";

const types = {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
    ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png",
    ".svg": "image/svg+xml", ".woff2": "font/woff2"
};

export const videos = JSON.parse(await readFile(new URL("../data/videos.json", import.meta.url)));
export const tagNames = JSON.parse(await readFile(new URL("../data/tags.json", import.meta.url)));

/** Build and serve the real site with directory redirects and a custom 404. */
export const startSite = async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "cse-browser-"));
    const outDir = path.join(directory, "site");
    let browser;
    let server;
    const close = async () => {
        try {
            await browser?.close();
        } finally {
            if (server?.listening) {
                await new Promise((resolve, reject) => {
                    server.close((error) => error ? reject(error) : resolve());
                    server.closeAllConnections();
                });
            }
            await rm(directory, { recursive: true, force: true });
        }
    };
    try {
        await build({ outDir, siteUrl: "" });
        server = createServer(async (request, response) => {
            try {
                const url = new URL(request.url, "http://localhost");
                let file = path.resolve(outDir, `.${decodeURIComponent(url.pathname)}`);
                if (!file.startsWith(`${outDir}${path.sep}`) && file !== outDir) {
                    response.writeHead(400).end();
                    return;
                }
                let status = 200;
                try {
                    if ((await stat(file)).isDirectory()) {
                        if (!url.pathname.endsWith("/")) {
                            response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
                            return;
                        }
                        file = path.join(file, "index.html");
                    }
                    await stat(file);
                } catch (error) {
                    if (!["ENOENT", "ENOTDIR"].includes(error.code)) {
                        throw error;
                    }
                    file = path.join(outDir, "404.html");
                    status = 404;
                }
                const body = await readFile(file);
                response.writeHead(status, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
                response.end(body);
            } catch {
                response.writeHead(500).end("Server error");
            }
        });
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });
        const origin = `http://127.0.0.1:${server.address().port}`;
        browser = await chromium.launch({ headless: true });
        return {
            origin,
            close,
            async page(t, options = {}) {
                const context = await browser.newContext({
                    viewport: { width: 1280, height: 800 },
                    baseURL: origin,
                    serviceWorkers: "block",
                    ...options
                });
                t.after(() => context.close());
                const aborted = new Set();
                await context.route("**/*", async (route) => {
                    if (new URL(route.request().url()).origin !== origin) {
                        aborted.add(route.request().url());
                        await route.abort();
                    } else {
                        await route.continue();
                    }
                });
                const page = await context.newPage();
                page.setDefaultTimeout(5000);
                return { page, context, aborted };
            }
        };
    } catch (error) {
        await close();
        throw error;
    }
};
