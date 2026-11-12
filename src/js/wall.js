/**
 * The two walls' own behaviour.
 *
 * The Video wall names the still under the pointer, or under the focus, in
 * its strip, since the stills are too small to caption well. (The home
 * page's card is a still picture and has no label.)
 *
 * The Video wall page: the search lights the stills that match, echoes
 * included, and dims the rest, and keeps the search in the address so it can
 * be shared. The count says how many match. The videos that don't match also
 * leave the tab order and the accessibility tree while the search is on, so
 * the keyboard and screen readers reach only the matches, as in the index.
 */
import { matches } from "./search.js";
import { countText, listUrl, readListParams } from "./state.js";

export const initWallCaption = () => {
    const label = document.querySelector("[data-wall-caption]");
    const wall = document.querySelector("[data-wall]");

    if (!label || !wall) {
        return;
    }

    // The label names the stills now, so their own captions step aside. On
    // a touch screen, with no pointer to follow, it names the focused still
    // (a keyboard on a tablet, switch control), so no caption spills over
    // the neighbours.
    wall.classList.add("has-label");

    const show = (target) => {
        const still = target instanceof Element ? target.closest("[data-id]") : null;
        const title = still?.querySelector(".wall__caption")?.textContent;

        if (title) {
            label.textContent = title;
            label.classList.add("is-shown");
        }
    };

    const hide = () => {
        label.classList.remove("is-shown");
    };

    wall.addEventListener("pointerover", (event) => show(event.target));
    // Leaving with the pointer goes back to naming the focused still, if any.
    wall.addEventListener("pointerleave", () => {
        if (wall.contains(document.activeElement)) {
            show(document.activeElement);
        } else {
            hide();
        }
    });
    wall.addEventListener("focusin", (event) => show(event.target));
    wall.addEventListener("focusout", (event) => {
        if (!wall.contains(/** @type {Node | null} */ (event.relatedTarget))) {
            hide();
        }
    });
};

export const initWallSearch = () => {
    const wall = document.querySelector("[data-wall-page]");
    const input = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-search-input]"));

    if (!wall || !input) {
        return;
    }

    // Each video's words and its own still (the one with data-search); its
    // echoes share the words and are always hidden from the keyboard.
    const words = new Map();
    const own = new Map();
    const stills = new Map();

    for (const still of wall.querySelectorAll("[data-id]")) {
        const id = still.getAttribute("data-id") ?? "";

        if (still.hasAttribute("data-search")) {
            words.set(id, (still.getAttribute("data-search") ?? "").split(" "));
            own.set(id, still);
        }

        stills.set(id, [...(stills.get(id) ?? []), still]);
    }

    const results = document.querySelector("[data-results]");
    const announcer = document.querySelector("[data-announce]");
    const restText = results?.textContent ?? undefined;
    const baseTitle = document.title;
    let announceTimer;

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

    /** @param {"now" | "after-pause" | "never"} when */
    const update = (when) => {
        const query = input.value.trim();
        let shown = 0;

        for (const [id, list] of stills) {
            const show = matches(words.get(id) ?? [], query);
            const dim = query !== "" && !show;
            shown += show ? 1 : 0;

            for (const still of list) {
                still.classList.toggle("is-match", query !== "" && show);
                still.classList.toggle("is-dim", dim);
            }

            // A dimmed video stays on the wall for the pointer, but leaves the
            // tab order and what a screen reader reads.
            const still = own.get(id);
            const link = still?.querySelector("a");

            if (still && link && dim) {
                still.setAttribute("aria-hidden", "true");
                link.setAttribute("tabindex", "-1");
            } else if (still && link) {
                still.removeAttribute("aria-hidden");
                link.removeAttribute("tabindex");
            }
        }

        announce(countText(shown, own.size, query, restText), when);
        document.title = query === "" ? baseTitle : `“${query}” | ${baseTitle}`;

        const url = listUrl(window.location.href, query, "newest");

        if (url !== window.location.href) {
            window.history.replaceState(window.history.state, "", url);
        }
    };

    input.value = readListParams(window.location.search).query;
    input.addEventListener("input", () => update("after-pause"));
    // Enter goes to the first match, which on a short screen may be below the
    // fold; that also closes a phone's keyboard.
    input.form?.addEventListener("submit", (event) => {
        event.preventDefault();
        update("now");
        [...own.values()].find((still) => still.classList.contains("is-match"))?.querySelector("a")?.focus();
    });

    // A phone gets the shorter hint, so it isn't cut off mid-word.
    const shortHint = input.dataset.placeholderShort;

    if (shortHint && window.matchMedia) {
        const fullHint = input.placeholder;
        const phone = window.matchMedia("(max-width: 699px)");
        const hint = () => {
            input.placeholder = phone.matches ? shortHint : fullHint;
        };

        hint();
        phone.addEventListener("change", hint);
    }

    // The header's search button goes to this page's field.
    for (const button of document.querySelectorAll("[data-search-button]")) {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            input.focus();
        });
    }

    // A shared search link announces its count; the plain wall stays quiet.
    update(input.value === "" ? "never" : "after-pause");
};
