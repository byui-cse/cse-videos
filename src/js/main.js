/**
 * Loads the video list and shows it on the page.
 */
const status = document.getElementById("video-status");
const list = document.getElementById("video-list");

const render = (videos) => {
    if (videos.length === 0) {
        status.textContent = "No videos yet.";
        return;
    }

    status.textContent = `${videos.length} ${videos.length === 1 ? "video" : "videos"}`;

    for (const video of videos) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = video.youtube ?? video.instagram;
        link.textContent = video.title;
        item.append(link);
        list.append(item);
    }
};

try {
    const response = await fetch("data/videos.json");

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    render(await response.json());
} catch (error) {
    status.textContent = "The videos could not be loaded. Try refreshing the page.";
    console.error(error);
}
