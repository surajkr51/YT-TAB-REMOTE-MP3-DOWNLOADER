(() => {
  if (window.__youtubeRemoteInstalled) return;
  window.__youtubeRemoteInstalled = true;

  function getState() {
    const video = document.querySelector("video");

    const titleElement =
      document.querySelector("ytmusic-player-bar .title") ||
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("h1.ytd-watch-metadata") ||
      document.querySelector("h1.title");

    const title =
      titleElement?.textContent?.trim() ||
      document.title.replace(/ - YouTube(?: Music)?$/, "");

    return {
      hasVideo: Boolean(video),
      title,
      url: location.href,
      paused: video?.paused ?? true,
      volume: video?.volume ?? 1,
      muted: video?.muted ?? false
    };
  }

  browser.runtime.onMessage.addListener(message => {
    if (message.type !== "YT_REMOTE") return;

    return (async () => {
      try {
        if (message.action === "STATE") {
          return { ok: true, state: getState() };
        }

        const video = document.querySelector("video");

        if (!video) {
          throw new Error("No player found in this YouTube tab.");
        }

        switch (message.action) {
          case "TOGGLE":
            if (video.paused) {
              await video.play();
            } else {
              video.pause();
            }
            break;

          case "NEXT": {
            const nextButton =
              document.querySelector("ytmusic-player-bar .next-button") ||
              document.querySelector(".ytp-next-button");

            if (
              !nextButton ||
              nextButton.disabled ||
              nextButton.getAttribute("aria-disabled") === "true"
            ) {
              throw new Error("No next track is available.");
            }

            nextButton.click();
            break;
          }

          case "VOLUME": {
            const value = Number(message.value);

            if (!Number.isFinite(value)) {
              throw new Error("Invalid volume.");
            }

            video.volume = Math.max(0, Math.min(1, value));
            video.muted = value <= 0;
            break;
          }

          default:
            throw new Error("Unknown remote command.");
        }

        return { ok: true, state: getState() };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    })();
  });
})();