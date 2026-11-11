(() => {
  if (window.__y2mateAutomationStarted) return;
  window.__y2mateAutomationStarted = true;

  const INPUT_XPATH =
    "/html/body/div[1]/section[1]/div/div/form/input";

  const DOWNLOAD_SELECTOR =
    'button.y2link-download[data-format="mp3"][data-note="320"]';

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function getJob() {
    return browser.runtime.sendMessage({
      type: "GET_JOB"
    });
  }

  async function update(status, stage) {
    console.log("[Y2Mate]", status);

    const reply = await browser.runtime.sendMessage({
      type: "UPDATE_JOB",
      status,
      stage
    });

    if (!reply?.ok) {
      throw new Error("Job is no longer active. Start a new download.");
    }
  }

  function byXPath(xpath) {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }

  // Do not depend on one absolute XPath: the site's markup can change.
  function findUrlInput() {
    const selectors = [
      'input#url', 'input#txt-url', 'input#txturl',
      'input[name="url"]', 'input[name="query"]',
      'form input[type="url"]',
      'form input[type="text"]',
      'form input:not([type])'
    ];

    for (const selector of selectors) {
      for (const input of document.querySelectorAll(selector)) {
        if (input instanceof HTMLInputElement &&
            !input.disabled && !input.readOnly &&
            input.getClientRects().length > 0) {
          return input;
        }
      }
    }

    const fallback = byXPath(INPUT_XPATH);
    return fallback instanceof HTMLInputElement &&
      !fallback.disabled && !fallback.readOnly &&
      fallback.getClientRects().length > 0 ? fallback : null;
  }

  async function pasteAndSubmit(job) {
    await update("Finding the URL input...");

    const deadline = Date.now() + 30000;
    let input = null;

    while (Date.now() < deadline) {
      const candidate = findUrlInput();

      if (
        candidate instanceof HTMLInputElement &&
        !candidate.disabled
      ) {
        input = candidate;
        break;
      }

      await sleep(500);
    }

    if (!input) {
      throw new Error("URL input not found.");
    }

    input.focus();

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    ).set;

    setter.call(input, job.url);

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await update("Link pasted. Preparing conversion...");
    await sleep(2000);

    const form = input.form || input.closest("form");

    if (!form) {
      throw new Error("Conversion form not found.");
    }

    const submitButton = [...form.querySelectorAll(
      'button[type="submit"], button:not([type]), input[type="submit"]'
    )].find(element =>
      !element.disabled &&
      element.getClientRects().length > 0
    );

    // Save the stage before submission or iframe loading.
    await update(
      "Submitting link. Waiting for the download iframe...",
      "download"
    );

    if (submitButton) {
      submitButton.click();
    } else {
      HTMLFormElement.prototype.requestSubmit.call(form);
    }

    // The iframe script handles the download from here.
  }

  async function downloadInsideFrame() {
    const deadline = Date.now() + 180000;
    let reportedWaiting = false;

    while (Date.now() < deadline) {
      const job = await getJob();

      if (!job || ["done", "error"].includes(job.stage)) {
        return;
      }

      if (job.stage === "download") {
        if (!reportedWaiting) {
          await update("Download iframe connected. Finding MP3 320...");
          reportedWaiting = true;
        }

        const button = [...document.querySelectorAll(
          DOWNLOAD_SELECTOR
        )].find(element =>
          !element.disabled &&
          element.getAttribute("aria-disabled") !== "true" &&
          element.getClientRects().length > 0
        );

        if (button) {
          button.scrollIntoView({ block: "center" });

          await update("Clicking MP3 320...");
button.click();

await update("Waiting for the final download link...");

const FINAL_DOWNLOAD_XPATH =
  "/html/body/div[1]/div/div[2]/div/div[2]/div[2]/div/a";

const finalDeadline = Date.now() + 120000;

while (Date.now() < finalDeadline) {
  const finalLink = byXPath(FINAL_DOWNLOAD_XPATH);

  if (
    finalLink instanceof HTMLAnchorElement &&
    finalLink.getAttribute("href") &&
    finalLink.getAttribute("href") !== "#" &&
    finalLink.getClientRects().length > 0 &&
    getComputedStyle(finalLink).visibility !== "hidden" &&
    finalLink.getAttribute("aria-disabled") !== "true"
  ) {
    finalLink.scrollIntoView({ block: "center" });

    // Mark the job before clicking to prevent repeat downloads.
    await update("Clicking the final download link...", "done");

    finalLink.click();

    console.log("[Y2Mate] Final download click sent:", finalLink);

    await update(
      "Final download link clicked. Check your browser downloads.",
      "done"
    );

    return;
  }

  await sleep(500);
}

throw new Error("Final download link did not appear within 120 seconds.");
        }
      }

      await sleep(500);
    }

    throw new Error("MP3 320 button did not become available in the iframe.");
  }

  async function main() {
    const job = await getJob();

    if (!job || ["done", "error"].includes(job.stage)) return;

    if (
      location.protocol === "https:" &&
      /^((v\d+)\.)?www-y2mate\.com$/.test(location.hostname) &&
      window.top === window
    ) {
      if (job.stage === "paste") {
        await pasteAndSubmit(job);
      }

      return;
    }

    if (
      location.origin === "https://iframe.y2meta-uk.com" &&
      window.top !== window
    ) {
      await downloadInsideFrame();
    }
  }

  main().catch(async error => {
    console.error("[Y2Mate]", error);

    try {
      await update(`ERROR: ${error.message}`, "error");
    } catch (_) {}
  });
})();