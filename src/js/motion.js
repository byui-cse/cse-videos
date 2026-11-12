/**
 * The calm motion on the home page, on top of a page that is complete
 * without it: the series boards fade up together once, as their row comes
 * into view, and not under reduced motion. The load fade and the headline's
 * rise are CSS (src/css/utilities/motion.css). Nothing here needs a library:
 * an IntersectionObserver and the Web Animations API, neither of which a
 * style-src policy blocks.
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

export const initMotion = () => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    initReveal();
};
