const ui = {
  title: document.getElementById("video-title"),
  connection: document.getElementById("connection"),
  play: document.getElementById("play-pause"),
  next: document.getElementById("next"),
  volume: document.getElementById("volume"),
  volumeValue: document.getElementById("volume-value"),
  copy: document.getElementById("copy-link"),
  refresh: document.getElementById("refresh"),
  remoteStatus: document.getElementById("remote-status"),
  download: document.getElementById("download"),
  status: document.getElementById("status")
};

let targetTabId = null;
let currentUrl = "";
let syncing = false;
let volumeEditing = false;
let volumeTimer;

function setControls(enabled) {
  ui.play.disabled = !enabled;
  ui.next.disabled = !enabled;
  ui.volume.disabled = !enabled;
}

function render(state) {
  ui.title.textContent = state.title || "YouTube";
  ui.connection.textContent = state.hasVideo
    ? "Connected • controls work from any tab"
    : "Open a video or song in this tab";

  ui.play.textContent = state.paused ? "▶ Play" : "❚❚ Pause";

  currentUrl = state.url || "";
  ui.copy.disabled = !currentUrl;

  setControls(state.hasVideo);

  if (!volumeEditing) {
    const volume = state.muted ? 0 : Math.round(state.volume * 100);
    ui.volume.value = volume;
    ui.volumeValue.textContent = `${volume}%`;
  }
}

async function findTarget() {
  const tabs = await browser.tabs.query({
    url: "*://*.youtube.com/*"
  });

  const candidates = tabs.filter(tab => {
    const url = new URL(tab.url);
    return url.pathname === "/watch" ||
           url.pathname.startsWith("/shorts/") ||
           url.hostname === "music.youtube.com";
  });

  const target =
    candidates.find(tab => tab.audible) ||
    candidates.find(tab => tab.id === targetTabId) ||
    candidates.find(tab => tab.active) ||
    [...candidates].sort(
      (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
    )[0];

  targetTabId = target?.id ?? null;
  return target;
}

async function send(action, extra = {}) {
  if (targetTabId === null) {
    throw new Error("Open a YouTube video or YouTube Music song first.");
  }

  let response;

  try {
    response = await browser.tabs.sendMessage(targetTabId, {
      type: "YT_REMOTE",
      action,
      ...extra
    });
  } catch (_) {
    throw new Error("Refresh the YouTube tab once, then reopen this popup.");
  }

  if (!response?.ok) {
    throw new Error(response?.error || "The YouTube player did not respond.");
  }

  return response.state;
}

async function sync() {
  if (syncing) return;
  syncing = true;

  try {
    const target = await findTarget();

    if (!target) {
      currentUrl = "";
      ui.title.textContent = "No YouTube player found";
      ui.connection.textContent = "Open a video or song first";
      ui.copy.disabled = true;
      setControls(false);
      return;
    }

    render(await send("STATE"));
  } catch (error) {
    setControls(false);
    ui.connection.textContent = error.message;
  } finally {
    syncing = false;
  }
}

async function command(action, extra = {}) {
  try {
    render(await send(action, extra));
    ui.remoteStatus.textContent = "";
  } catch (error) {
    ui.remoteStatus.textContent = error.message;
  }
}

ui.play.addEventListener("click", () => command("TOGGLE"));
ui.next.addEventListener("click", () => command("NEXT"));

ui.refresh.addEventListener("click", () => {
  targetTabId = null;
  ui.remoteStatus.textContent = "";
  sync();
});

ui.volume.addEventListener("input", () => {
  volumeEditing = true;
  ui.volumeValue.textContent = `${ui.volume.value}%`;

  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => {
    command("VOLUME", {
      value: Number(ui.volume.value) / 100
    });
  }, 80);
});

ui.volume.addEventListener("change", async () => {
  clearTimeout(volumeTimer);

  await command("VOLUME", {
    value: Number(ui.volume.value) / 100
  });

  volumeEditing = false;
});

ui.copy.addEventListener("click", async () => {
  try {
    if (!currentUrl) throw new Error("No video link available.");

    await navigator.clipboard.writeText(currentUrl);
    ui.remoteStatus.textContent = "Link copied!";
  } catch (error) {
    ui.remoteStatus.textContent = `Copy failed: ${error.message}`;
  }
});

// Existing MP3 downloader.
browser.storage.local.get("status")
  .then(data => {
    if (data.status) ui.status.textContent = data.status;
  })
  .catch(console.error);

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.status) {
    ui.status.textContent = changes.status.newValue;
  }
});

ui.download.addEventListener("click", async () => {
  ui.download.disabled = true;
  ui.status.textContent = "Starting...";

  try {
    const result = await browser.runtime.sendMessage({
      type: "START"
    });

    if (!result?.ok) {
      throw new Error(result?.error || "No response from background.js.");
    }
  } catch (error) {
    ui.status.textContent = `Error: ${error.message}`;
  } finally {
    ui.download.disabled = false;
  }
});

sync();
const poll = setInterval(sync, 1000);

window.addEventListener("unload", () => {
  clearInterval(poll);
  clearTimeout(volumeTimer);
});