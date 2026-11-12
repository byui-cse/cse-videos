/**
 * Search and sort for a grid of videos. Everything lives in the address, so a
 * search like ?q=portfolio&sort=oldest can be shared as a link, and the grid
 * closes up around what is left. The home page's hero stays as it is: a
 * search changes only the list. On a phone the home page's index opens on
 * its first few videos with a button for the rest; a search always looks
 * through all of them.
 */
import { matches } from "./search.js";
import { countText, listUrl, orderText, readListParams } from "./state.js";

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/**
 * Runs `change`, then slides every card that stayed from where it was to
 * where it is now, and fades in the ones that appeared or changed size.
 * Cards that leave go at once. Under reduced motion, just the change.
 * @param {HTMLElement[]} cards
 * @param {() => void} change
 */
const closeUp = (cards, change) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof Element.prototype.animate !== "function") {
        change();
        return;
    }

    // Measured where they show now, mid-slide included, then put at rest.
    const before = new Map(cards.filter((card) => !card.hidden).map((card) => [card, card.getBoundingClientRect()]));

    for (const card of cards) {
        for (const animation of card.getAnimations()) {
            animation.cancel();
        }
    }

    change();

    for (const card of cards) {
        if (card.hidden) {
            continue;
        }

        const was = before.get(card);
        const now = card.getBoundingClientRect();

        if (!was || Math.abs(was.width - now.width) > 1) {
            card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "linear" });
        } else if (was.left !== now.left || was.top !== now.top) {
            card.animate(
                [{ transform: `translate(${was.left - now.left}px, ${was.top - now.top}px)` }, { transform: "none" }],
                { duration: 240, easing: EASE }
            );
        }
    }
};

export const initList = () => {
    const list = /** @type {HTMLElement | null} */ (document.querySelector("[data-video-list]"));

    if (!list) {
        return;
    }

    const cards = [...list.querySelectorAll(":scope > li")].map((card) => ({
        card: /** @type {HTMLElement} */ (card),
        id: card.getAttribute("data-id") ?? "",
        words: (card.getAttribute("data-search") ?? "").split(" "),
        order: Number(card.getAttribute("data-order"))
    }));
    const input = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-search-input]"));
    const sort = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-sort]"));
    const results = document.querySelector("[data-results]");
    const empty = document.querySelector("[data-empty]");
    const heading = document.getElementById("listing-heading");
    const headingText = heading?.textContent ?? "";
    // What the count says with no search, as the build wrote it.
    const restText = results?.textContent ?? undefined;
    const baseTitle = document.title;
    const defaultOrder = list.dataset.defaultOrder === "oldest" ? "oldest" : "newest";
    // A grid with a lead tile draws its newest video two by two, and gives
    // the browser the bigger size for its still. Only the plain list has one:
    // in a search or the other order the first video isn't the newest.
    const { leadSizes, tileSizes } = list.dataset;
    // The build writes the cards in the list's default order.
    let shownOrder = defaultOrder;
    // How many videos a phone shows before "Show all"; 0 shows them all.
    const foldAt = Number(list.dataset.phoneFold) || 0;
    const showAllRow = document.querySelector("[data-show-all-row]");
    const showAll = document.querySelector("[data-show-all]");
    let unfolded = false;

    const params = readListParams(window.location.search, defaultOrder);

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
    // stays quiet when the page first loads. It can say more than the count,
    // like the new order.
    const announce = (text, when, spoken = text) => {
        clearTimeout(announceTimer);

        if (results) {
            results.textContent = text;
        }

        if (!announcer || when === "never") {
            return;
        }

        if (when === "now") {
            announcer.textContent = spoken;
        } else {
            announceTimer = setTimeout(() => {
                announcer.textContent = spoken;
            }, 700);
        }
    };

    /**
     * @param {boolean} plain no search, and the list's own order
     */
    const markLead = (plain) => {
        if (!leadSizes || !tileSizes) {
            return;
        }

        const lead = plain ? list.querySelector(":scope > li:not([hidden])") : null;

        for (const { card } of cards) {
            const on = card === lead;
            card.classList.toggle("tile--lead", on);

            for (const source of card.querySelectorAll("source")) {
                const sizes = on ? leadSizes : tileSizes;

                if (source.getAttribute("sizes") !== sizes) {
                    source.setAttribute("sizes", sizes);
                }
            }
        }
    };

    /**
     * @param {{ announce?: "now" | "after-pause" | "never", animate?: boolean, reordered?: boolean }} [options]
     */
    const update = ({ announce: when = "now", animate = false, reordered = false } = {}) => {
        const query = input ? input.value.trim() : "";
        // A list without the menu, like a series, keeps its own order.
        const order = sort ? (sort.value === "oldest" ? "oldest" : "newest") : defaultOrder;
        const folded = foldAt > 0 && !unfolded && query === "";
        let shown = 0;

        const change = () => {
            if (order !== shownOrder) {
                const sorted = [...cards].sort((a, b) => (order === "oldest" ? b.order - a.order : a.order - b.order));
                list.append(...sorted.map(({ card }) => card));
                shownOrder = order;
            }

            shown = 0;

            for (const { card, words } of cards) {
                const show = matches(words, query);
                card.hidden = !show;
                shown += show ? 1 : 0;
            }

            // Past the fold the rest wait for "Show all" (CSS hides them on
            // phones only).
            [...list.children].forEach((card, index) => {
                card.classList.toggle("tile--folded", folded && index >= foldAt);
            });

            if (showAllRow) {
                showAllRow.hidden = !folded;
            }

            markLead(query === "" && order === defaultOrder);
        };

        if (animate) {
            closeUp(cards.map(({ card }) => card), change);
        } else {
            change();
        }

        const count = countText(shown, cards.length, query, restText);
        announce(count, when, reordered ? orderText(order, count) : count);

        if (empty) {
            empty.hidden = shown > 0 || query === "";
        }

        // The home page's heading follows the search; a topic page's names
        // the order.
        if (input && heading) {
            heading.textContent = query === "" ? headingText : "Search results";
        } else if (heading?.dataset.headingNewest && heading.dataset.headingOldest) {
            heading.textContent = order === "oldest" ? heading.dataset.headingOldest : heading.dataset.headingNewest;
        }

        document.title = query === "" ? baseTitle : `“${query}” | ${baseTitle}`;

        const url = listUrl(window.location.href, query, order, defaultOrder);

        if (url !== window.location.href) {
            window.history.replaceState(window.history.state, "", url);
        }
    };

    // After a search is sent the results come onto the screen: the heading
    // goes to the top unless the first result already shows whole. On a
    // phone the hero's card sits between the field and the results, so they
    // would otherwise stay below the fold.
    const showResults = () => {
        if (!heading) {
            return;
        }

        // Moving focus to the results closes the phone keyboard and puts
        // keyboard and screen reader users where the results start.
        heading.focus({ preventScroll: true });

        const first = [...list.children].find((card) => !card.hidden && card.getClientRects().length > 0)
            ?? (empty && !empty.hidden ? empty : null);
        const box = first?.getBoundingClientRect();

        if (box && box.top >= 0 && box.bottom <= window.innerHeight) {
            return;
        }

        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        heading.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    };

    input?.addEventListener("input", () => update({ announce: "after-pause", animate: true }));
    sort?.addEventListener("change", () => update({ animate: true, reordered: true }));

    input?.form?.addEventListener("submit", (event) => {
        event.preventDefault();
        update();
        showResults();
    });

    showAll?.addEventListener("click", () => {
        unfolded = true;
        update({ announce: "never" });
        // Keyboard and screen reader users carry on from the first video that appeared.
        list.children[foldAt]?.querySelector("a")?.focus();
    });

    // A narrow field gets the shorter hint, so it isn't cut off mid-word: a
    // phone's, and the hero's beside its card from 800 to 1023 px.
    const shortHint = input?.dataset.placeholderShort;

    if (input && shortHint && window.matchMedia) {
        const fullHint = input.placeholder;
        const phone = window.matchMedia("(max-width: 699px), (min-width: 800px) and (max-width: 1023px)");
        const hint = () => {
            input.placeholder = phone.matches ? shortHint : fullHint;
        };

        hint();
        phone.addEventListener("change", hint);
    }

    for (const control of document.querySelectorAll("[data-clear-search]")) {
        control.addEventListener("click", (event) => {
            if (!input) {
                return;
            }

            event.preventDefault();
            input.value = "";
            update();
            input.focus();
        });
    }

    // The header's search button, and a link to #search, go to the field.
    if (input) {
        for (const button of document.querySelectorAll("[data-search-button]")) {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                input.focus();
            });
        }

        // Once there, the field has focus, so the address drops the #search
        // a reload or a copied link would otherwise jump back to.
        if (window.location.hash === "#search") {
            input.focus();
            window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
        }
    }

    // A shared search link announces its count; the plain list stays quiet.
    update({ announce: params.query === "" ? "never" : "after-pause" });
};
