/**
 * The calm motion on the home page, on top of a page that is complete
 * without it. Two things move, and neither under reduced motion:
 *   the wall drifts as one piece at 0.92 times the scroll, so it reads as a
 *   photograph with a little depth while the hero scrolls away;
 *   the series boards fade up together once, as their row comes into view.
 * The load fade and the line's rise are CSS (src/css/utilities/motion.css).
 * Nothing here needs a library: a scroll listener, an IntersectionObserver
 * and the Web Animations API, none of which a style-src policy blocks.
 */
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const DRIFT = 0.08;

const initDrift = () => {
    const wall = /** @type {HTMLElement | null} */ (document.querySelector("[data-wall]"));
    const hero = wall?.parentElement;

    if (!wall || !hero) {
        return;
    }

    let end = 0;
    let queued = false;

    const measure = () => {
        end = hero.getBoundingClientRect().bottom + window.scrollY;
    };

    const draw = () => {
        queued = false;
        const y = Math.min(Math.max(window.scrollY, 0), end) * DRIFT;
        wall.style.transform = y > 0 ? `translate3d(0, ${y.toFixed(1)}px, 0)` : "";
    };

    const queue = () => {
        if (!queued) {
            queued = true;
            requestAnimationFrame(draw);
        }
    };

    measure();
    draw();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", () => {
        measure();
        queue();
    });
};

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

export const initMotion = () => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    initDrift();
    initReveal();
};
