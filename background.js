const WEBSITE = "https://www-y2mate.com/";
const jobKey = tabId => `y2mate-job-${tabId}`;

async function startDownload() {
  let createdTabId;

  try {
    const tabs = await browser.tabs.query({
      url: "https://*.youtube.com/watch*"
    });

    const video =
      tabs.find(tab => tab.active) ||
      tabs.find(tab => tab.audible) ||
      tabs[0];

    if (!video?.url) {
      throw new Error("Open a YouTube video first.");
    }

    // Create a blank tab so the job exists before Y2Mate loads.
    const tab = await browser.tabs.create({
      url: "about:blank",
      active: false
    });

    createdTabId = tab.id;

    await browser.storage.local.set({
      [jobKey(tab.id)]: {
        url: video.url,
        stage: "paste",
        expires: Date.now() + 5 * 60 * 1000
      },
      status: "Opening Y2Mate..."
    });

    await browser.tabs.update(tab.id, {
      url: WEBSITE,
      active: true
    });

    return { ok: true };
  } catch (error) {
    if (createdTabId !== undefined) {
      await browser.storage.local.remove(jobKey(createdTabId));
    }

    await browser.storage.local.set({
      status: `ERROR: ${error.message}`
    });

    return { ok: false, error: error.message };
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "START") {
    if (sender.id !== browser.runtime.id || sender.tab) {
      return Promise.resolve({
        ok: false,
        error: "Start from the extension popup."
      });
    }

    return startDownload();
  }

  if (!sender.tab || sender.id !== browser.runtime.id) return;

  let origin;

  try {
    origin = new URL(sender.url).origin;
  } catch (_) {
    return;
  }

  // Numbered Y2Mate hosts rotate (v40, v41, v42, ...).
  // Trust only the exact www-y2mate.com host and its numbered mirrors.
  const senderHost = new URL(sender.url).hostname;
  const isMainPage =
    /^((v\d+)\.)?www-y2mate\.com$/.test(senderHost) &&
    origin.startsWith("https://") &&
    sender.frameId === 0;

  const isDownloadFrame =
    origin === "https://iframe.y2meta-uk.com" &&
    sender.frameId !== 0;

  if (!isMainPage && !isDownloadFrame) return;

  if (!["GET_JOB", "UPDATE_JOB"].includes(message.type)) return;

  const key = jobKey(sender.tab.id);

  return (async () => {
    const data = await browser.storage.local.get(key);
    const job = data[key];

    if (!job) return null;

    if (Date.now() > job.expires) {
      await browser.storage.local.remove(key);

      await browser.storage.local.set({
        status: "Timed out. Start a new download."
      });

      return null;
    }

    if (message.type === "GET_JOB") {
      return job;
    }

    // Only the main page advances from pasting to downloading.
    if (message.stage === "download") {
      if (!isMainPage || job.stage !== "paste") {
        return { ok: false };
      }

      job.stage = "download";
    }

    // Only the download iframe marks its button click complete.
    if (message.stage === "done") {
      if (
        !isDownloadFrame ||
        !["download", "done"].includes(job.stage)
      ) {
        return { ok: false };
      }

      job.stage = "done";
    }

    if (message.stage === "error") {
      job.stage = "error";
    }

    await browser.storage.local.set({
      [key]: job,
      status: String(message.status || "Working...")
    });

    return { ok: true };
  })();
});


browser.tabs.onRemoved.addListener(tabId => {
  browser.storage.local.remove(jobKey(tabId)).catch(console.error);
});