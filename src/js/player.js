/**
 * The video player: switching between YouTube and Instagram, and Expand,
 * which grows the player to fill the window without reloading the video.
 */
import { measuredHeight, playerState, playerUrl, requestedSource } from "./state.js";

const NAMES = { youtube: "YouTube", instagram: "Instagram" };
const INSTAGRAM_ORIGIN = "https://www.instagram.com";

/**
 * Makes everything outside `element` inert, so keyboard and screen reader
 * focus stay in the expanded player. Returns a function that undoes it.
 * @param {Element} element
 * @returns {() => void}
 */
const isolate = (element) => {
    const changed = [];
    let node = element;

    while (node.parentElement && node !== document.body) {
        for (const sibling of node.parentElement.children) {
            if (sibling !== node && !sibling.inert) {
                sibling.inert = true;
                changed.push(sibling);
            }
        }

        node = node.parentElement;
    }

    return () => {
        for (const sibling of changed) {
            sibling.inert = false;
        }
    };
};

export const initPlayer = () => {
    const player = /** @type {HTMLElement | null} */ (document.querySelector("[data-player]"));
    let iframe = /** @type {HTMLIFrameElement | null} */ (player?.querySelector("iframe"));

    if (!player || !iframe) {
        return;
    }

    const title = player.dataset.title ?? "Video";
    const defaultSource = player.dataset.source ?? "youtube";
    const sources = {
        youtube: player.dataset.youtubeSrc,
        instagram: player.dataset.instagramSrc
    };
    const sourceButtons = [...player.querySelectorAll("[data-source-button]")];
    const expandButton = /** @type {HTMLButtonElement | null} */ (player.querySelector("[data-expand]"));
    const frame = iframe.parentElement;
    let status = /** @type {HTMLParagraphElement | null} */ (null);
    let activeSource = "";
    let shownAt = 0;
    let sawInstagramMessage = false;
    let slowTimer;

    /** @param {string} source */
    const updateState = (source) => {
        const state = playerState({ source, elapsedMs: performance.now() - shownAt, sawInstagramMessage });
        player.dataset.state = state;

        if (state === "slow" && !status && frame) {
            status = document.createElement("p");
            status.className = "player__status";
            status.setAttribute("data-player-status", "");
            status.setAttribute("role", "status");
            status.append("The Instagram player hasn't loaded. Instagram may be blocked on this network or by a browser extension. ");

            const link = document.createElement("a");
            const postUrl = new URL(sources.instagram);
            postUrl.pathname = postUrl.pathname.replace(/embed\/?$/, "");
            link.href = postUrl.href;
            link.textContent = "Watch on Instagram";
            status.append(link);
            frame.after(status);
        }

        if (status) {
            status.hidden = state !== "slow";
        }
    };

    /**
     * @param {string} source
     * @param {boolean} rememberInUrl
     */
    const show = (source, rememberInUrl) => {
        const src = sources[source];

        if (!src) {
            return;
        }

        // A new frame rather than a new src on the old one: a new src adds a
        // step to the Back button, and the old player could still send its
        // height to the new one while it unloads.
        if (player.dataset.source !== source) {
            player.dataset.source = source;
            const fresh = /** @type {HTMLIFrameElement} */ (iframe.cloneNode(false));
            fresh.removeAttribute("style");
            fresh.title = `${title} (${NAMES[source]})`;
            fresh.src = src;
            iframe.replaceWith(fresh);
            iframe = fresh;
        }

        if (activeSource !== source) {
            clearTimeout(slowTimer);
            activeSource = source;
            sawInstagramMessage = false;
            shownAt = performance.now();
            updateState(source);

            if (source === "instagram") {
                slowTimer = setTimeout(() => updateState(source), 10000);
            }
        }

        for (const button of sourceButtons) {
            button.setAttribute("aria-pressed", String(button.getAttribute("data-source-button") === source));
        }

        if (rememberInUrl) {
            window.history.replaceState(window.history.state, "", playerUrl(window.location.href, source, defaultSource));
        }
    };

    const requested = requestedSource(window.location.search, Object.keys(sources).filter((key) => sources[key]));

    show(requested ?? defaultSource, false);

    for (const button of sourceButtons) {
        button.addEventListener("click", () => show(button.getAttribute("data-source-button") ?? "", true));
    }

    // Instagram's player posts its height to the page; without it the frame
    // would cut off or leave a gap.
    window.addEventListener("message", (event) => {
        if (event.origin !== INSTAGRAM_ORIGIN
            || event.source !== iframe.contentWindow
            || player.dataset.source !== "instagram") {
            return;
        }

        let message = event.data;

        if (typeof message === "string") {
            try {
                message = JSON.parse(message);
            } catch {
                return;
            }
        }

        if (!message || (message.type !== "LOADING" && message.type !== "MEASURE")) {
            return;
        }

        sawInstagramMessage = true;
        clearTimeout(slowTimer);
        updateState("instagram");

        const height = measuredHeight(message);

        if (height !== null) {
            iframe.style.height = `${height}px`;
        }
    });

    if (!expandButton) {
        return;
    }

    let restore = null;

    /** @param {boolean} expanded */
    const setExpanded = (expanded) => {
        player.classList.toggle("is-expanded", expanded);
        document.documentElement.classList.toggle("has-expanded-player", expanded);
        expandButton.textContent = expanded ? "Close" : "Expand";

        if (expanded) {
            player.setAttribute("role", "dialog");
            player.setAttribute("aria-modal", "true");
            player.setAttribute("aria-label", title);
            restore = isolate(player);
        } else {
            player.removeAttribute("role");
            player.removeAttribute("aria-modal");
            player.removeAttribute("aria-label");
            restore?.();
            restore = null;
        }

        expandButton.focus();
    };

    const isExpanded = () => player.classList.contains("is-expanded");

    expandButton.addEventListener("click", () => setExpanded(!isExpanded()));

    // Escape cannot reach a focused cross-origin frame; Close and the backdrop click remain exits.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isExpanded()) {
            setExpanded(false);
        }
    });

    // A click on the dark area around the video closes it.
    player.addEventListener("click", (event) => {
        if (event.target === player && isExpanded()) {
            setExpanded(false);
        }
    });
};
