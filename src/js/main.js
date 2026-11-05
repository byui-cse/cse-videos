/**
 * Every page loads this. The pages are complete without it; it adds search,
 * sorting, the link buttons, the player controls, the choice of player, and
 * the calm motion around the stills.
 */
import { initList } from "./list.js";
import { initPlayer } from "./player.js";
import { initShare } from "./share.js";
import { initBack } from "./back.js";
import { initSourcePreference } from "./source-preference.js";
import { initMotion } from "./motion.js";
import { initReelTransition } from "./transition.js";

for (const element of document.querySelectorAll("[data-needs-js]")) {
    element.hidden = false;
}

initList();
initShare();
initSourcePreference(initPlayer());
initBack();
initMotion();
initReelTransition();
