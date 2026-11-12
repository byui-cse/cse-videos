/**
 * The calm motion on the home page, on top of a page that is complete
 * without it: the series boards fade up together once, as their row comes
 * into view, and not under reduced motion. The load fade and the headline's
 * rise are CSS (src/css/utilities/motion.css). Nothing here needs a library:
 * an IntersectionObserver and the Web Animations API, neither of which a
 * style-src policy blocks.
 *
 * Where the boards are a swipe row, the keyboard brings each board it
 * reaches fully into the row's view, under reduced motion too.
 */
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

const initReveal = () => {
    const boards = document.querySelector("[data-quest-boards]");

    // Boards already on screen stay as they are; so does a browser without
    // the observer.
    if (!boards || !("IntersectionObserver" in window) || boards.getBoundingClientRect().top < window.innerHeight) {
        return;
    }

    boards.classList.add("is-waiting");

    const reveal = () => {
        observer.disconnect();

        if (!boards.classList.contains("is-waiting")) {
            return;
        }

        for (const board of boards.children) {
            board.animate(
                [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
                { duration: 450, easing: EASE, fill: "backwards" }
            );
        }

        boards.classList.remove("is-waiting");
    };

    const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            reveal();
        }
    }, { rootMargin: "0px 0px -15% 0px" });

    observer.observe(boards);
    // Tabbing into the row, or jumping to it, shows it at once.
    boards.addEventListener("focusin", () => {
        observer.disconnect();
        boards.classList.remove("is-waiting");
    });
};

/**
 * The browser scrolls a focused link only until some of it shows, which in
 * the swipe row can leave a board almost entirely off its edge. A board that
 * takes the keyboard's focus lines up with the row's start instead. A tap or
 * a click leaves the row where the finger or pointer put it.
 */
const initBoardFocus = () => {
    const boards = document.querySelector("[data-quest-boards]");
    // Safari before 15.4 can't match :focus-visible and throws; there every
    // focus counts.
    const byKeyboard = (target) => {
        try {
            return target.matches(":focus-visible");
        } catch {
            return true;
        }
    };

    boards?.addEventListener("focusin", (event) => {
        const target = /** @type {Element} */ (event.target);
        const board = target.closest(".board");

        if (!board || boards.scrollWidth <= boards.clientWidth || !byKeyboard(target)) {
            return;
        }

        board.scrollIntoView({ block: "nearest", inline: "start" });
    });
};

export const initMotion = () => {
    initBoardFocus();

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    initReveal();
};
