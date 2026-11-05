/**
 * Search and sort for a grid of videos. Everything lives in the address, so a
 * search like ?q=portfolio&sort=oldest can be shared as a link.
 */
import { matches } from "./search.js";
import { countText, listUrl, readListParams } from "./state.js";

export const initList = () => {
    const list = document.querySelector("[data-video-list]");

    if (!list) {
        return;
    }

    const cards = [...list.querySelectorAll(":scope > li")].map((card) => ({
        card,
        words: (card.dataset.search ?? "").split(" "),
        order: Number(card.dataset.order)
    }));
    const input = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-search-input]"));
    const sort = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-sort]"));
    const results = document.querySelector("[data-results]");
    const empty = document.querySelector("[data-empty]");
    const heading = document.getElementById("listing-heading");
    const headingText = heading?.textContent ?? "";
    const baseTitle = document.title;
    let shownOrder = "newest";

    const params = readListParams(window.location.search);

    if (input) {
        input.value = params.query;
    }

    if (sort) {
        sort.value = params.order;
    }

    const announcer = document.querySelector("[data-announce]");
    let announceTimer;

    // The visible count changes right away. The screen reader copy waits for
    // a pause in typing, so it reads one result instead of one per key, and
    // stays quiet when the page first loads.
    const announce = (text, when) => {
        clearTimeout(announceTimer);

        if (results) {
            results.textContent = text;
        }

        if (!announcer || when === "never") {
            return;
        }

        if (when === "now") {
            announcer.textContent = text;
        } else {
            announceTimer = setTimeout(() => {
                announcer.textContent = text;
            }, 700);
        }
    };

    /** @param {{ announce?: "now" | "after-pause" | "never" }} [options] */
    const update = ({ announce: when = "now" } = {}) => {
        const query = input ? input.value.trim() : "";
        const order = sort?.value === "oldest" ? "oldest" : "newest";

        if (order !== shownOrder) {
            const sorted = [...cards].sort((a, b) => (order === "oldest" ? b.order - a.order : a.order - b.order));
            list.append(...sorted.map(({ card }) => card));
            shownOrder = order;
        }

        let shown = 0;

        for (const { card, words } of cards) {
            const show = matches(words, query);
            card.hidden = !show;
            shown += show ? 1 : 0;
        }

        announce(countText(shown, cards.length, query), when);

        if (empty) {
            empty.hidden = shown > 0 || query === "";
        }

        // Only the home page has a search box; its heading follows the search.
        if (input && heading) {
            heading.textContent = query === "" ? headingText : "Search results";
        }

        document.title = query === "" ? baseTitle : `“${query}” | ${baseTitle}`;

        const url = listUrl(window.location.href, query, order);

        if (url !== window.location.href) {
            window.history.replaceState(window.history.state, "", url);
        }
    };

    input?.addEventListener("input", () => update({ announce: "after-pause" }));
    sort?.addEventListener("change", () => update());

    input?.form?.addEventListener("submit", (event) => {
        event.preventDefault();
        update();
        // Moving focus to the results closes the phone keyboard and puts
        // keyboard and screen reader users where the results start.
        heading?.focus();
    });

    for (const link of document.querySelectorAll("[data-clear-search]")) {
        link.addEventListener("click", (event) => {
            if (!input) {
                return;
            }

            event.preventDefault();
            input.value = "";
            update();
            input.focus();
        });
    }

    // A shared search link announces its count; the plain list stays quiet.
    update({ announce: params.query === "" ? "never" : "after-pause" });
};
