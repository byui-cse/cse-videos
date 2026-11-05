/**
 * The still that was clicked travels into the next page's player. The CSS
 * gives the player and the clicked still one view-transition name (see
 * src/css/utilities/motion.css); this marks which still that is, and takes
 * the name off this page's own player so the name stays unique.
 */
import { isPlainClick } from "./state.js";

export const initReelTransition = () => {
    const root = document.documentElement;

    const clear = () => {
        root.classList.remove("is-reel-leaving");

        for (const element of document.querySelectorAll(".is-reel")) {
            element.classList.remove("is-reel");
        }
    };

    // A page restored from the back-forward cache starts clean.
    window.addEventListener("pageshow", clear);

    // A transition the browser skips (a name it can't match, a page hidden
    // mid-way) rejects its promises; that is not an error worth reporting.
    const quiet = (event) => {
        event.viewTransition?.ready.catch(() => {});
        event.viewTransition?.finished.catch(() => {});
    };

    window.addEventListener("pagereveal", quiet);
    window.addEventListener("pageswap", quiet);

    document.addEventListener("click", (event) => {
        const link = event.target instanceof Element ? event.target.closest("[data-reel-link]") : null;

        if (!link || !isPlainClick(event)) {
            return;
        }

        clear();
        const still = link.querySelector("[data-reel]");

        if (still) {
            root.classList.add("is-reel-leaving");
            still.classList.add("is-reel");
        }
    });
};
