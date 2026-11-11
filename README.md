# YouTube Remote + MP3

A lightweight **Firefox browser extension** for controlling YouTube playback from a popup and initiating an MP3 conversion workflow through Y2Mate.

> **Project status:** Personal/experimental project (v1.2). The YouTube controls are implemented in the supplied content script; the Y2Mate workflow depends on a third-party site's layout and may require updates. This repository is not affiliated with YouTube, Google, Y2Mate, or Y2Meta.

## Features

- **Remote playback controls:** Play/pause the current video, skip to the next available track, and change or mute the volume.
- **Playback information:** Retrieve the current title, page URL, play/pause state, volume, and mute state.
- **YouTube and YouTube Music:** The playback content script matches `*.youtube.com` pages, including `music.youtube.com`.
- **MP3 workflow:** From an open YouTube watch page, launch Y2Mate, fill in the URL, submit it, look for an **MP3 320** option, and try to follow the final download link.
- **Domain-aware automation:** The updated Y2Mate scripts accept numbered `www-y2mate.com` subdomains (such as `v40` or `v42`) instead of assuming one fixed host.
- **Status and error messages:** Keep short-lived conversion state in extension local storage and report workflow errors.

**Note:** The MP3 option is selected from the third-party service when available; this extension does **not** perform audio encoding or guarantee an actual 320 kbps output.

## Project structure

```text
YouTube-Remote-MP3/
├── manifest.json        # Extension configuration and permissions
├── background.js        # Starts MP3 jobs and tracks conversion progress
├── youtube-remote.js    # YouTube playback control content script
├── y2mate.js            # URL entry and download-page automation
├── popup/
│   └── popup.html       # Extension popup (include your existing popup files)
└── README.md
```

> The previously supplied **Y2Mate fix ZIP contains replacement files only** (`manifest.json`, `background.js`, and `y2mate.js`). It is **not** a complete installable extension. Keep `youtube-remote.js` and the existing `popup/` files from your project.

## Installation (Firefox — temporary development install)

1. Clone or download this repository.
2. Make sure `manifest.json`, the JavaScript files, and your complete `popup/` directory are in the extension root.
3. In Firefox, open `about:debugging`.
4. Select **This Firefox** → **Load Temporary Add-on**.
5. Select the `manifest.json` file.
6. Pin or open the extension from the browser toolbar.

Temporary add-ons are removed when Firefox restarts. For persistent distribution, the extension must be packaged and meet Firefox's add-on signing requirements.

### Browser compatibility

This code is currently **Firefox-oriented**. It uses `browser.*` APIs and a Manifest V3 background declaration using `background.scripts`. Do **not** assume the supplied files work unchanged in Chrome/Edge; Chromium MV3 extensions generally require a service-worker background entry and browser API compatibility adjustments.

## Usage

### Control playback

1. Open a video on YouTube or a track on YouTube Music.
2. Open your extension popup.
3. Use the controls provided by your `popup/` implementation to play/pause, skip forward to the next track, or adjust volume.

The content script responds to `YT_REMOTE` messages with the actions `STATE`, `TOGGLE`, `NEXT`, and `VOLUME`.

### Start the MP3 workflow

1. Open a normal YouTube video page (`youtube.com/watch...`).
2. Open the extension popup and activate its MP3/download action.
3. The background script opens Y2Mate in a new tab, and the content script attempts to populate and submit the video URL.
4. If the conversion page offers the expected **MP3 320** option and final download link, the script attempts to click them.
5. Check your browser's downloads panel for any download that starts.

The conversion job expires after **five minutes**. External site changes, navigation redirects, pop-ups, or anti-automation checks can interrupt the process.

## Permissions

| Permission / site access | Purpose |
| --- | --- |
| `tabs` | Find an open YouTube watch tab and open the converter tab. |
| `storage` | Keep temporary job state and status messages. |
| `clipboardWrite` | Declared in the manifest; any use depends on your popup implementation. The provided converter script fills the input directly. |
| `*.youtube.com` | Read and control the current YouTube HTML video player. |
| `www-y2mate.com` and numbered subdomains | Enter the YouTube URL and submit the conversion form. |
| `iframe.y2meta-uk.com` | Detect and interact with the expected download iframe. |

## Troubleshooting

**The YouTube URL does not appear in the Y2Mate search field.**

- Use the updated `background.js`, `y2mate.js`, and `manifest.json` together, then reload the extension in `about:debugging`.
- Make sure Y2Mate opened on a host covered by the manifest's permissions.
- Open the converter tab's developer tools and check the console for `[Y2Mate]` messages.
- The website may have changed its search input or form; selectors in `findUrlInput()` may need maintenance.

**“Open a YouTube video first.”**

- Open a standard video watch URL. The current MP3 job finder searches `https://*.youtube.com/watch*` tabs.

**“Job is no longer active” or a timeout.**

- Start again from the popup. Jobs are tied to the converter tab and expire after five minutes.

**An MP3 button or final link is not found.**

- The converter page may have changed. The script currently expects `button.y2link-download[data-format="mp3"][data-note="320"]` and a specific final-link XPath.
- Confirm that the service actually offers the requested format before adjusting the automation.

**The browser shows an error on Chrome or Edge.**

- The supplied manifest and scripts target Firefox. A Chromium port needs separate compatibility work.

## Limitations

- The extension depends on third-party pages that can change without notice.
- The download routine may fail when the expected option, iframe, or final-link element is missing.
- Playback controls available through the supplied content script are limited to **state, play/pause, next, and volume**; seeking and previous-track control are not implemented there.
- This repository does not include an audio converter, hosted service, or bundled media.
- Automated behavior and downloading may be restricted by third-party terms of service.

## Contributing

Issues and pull requests are welcome, especially for Firefox compatibility, more robust page selectors, error reporting, and UI accessibility. Please test changes locally and avoid including copyrighted media or personal data in bug reports.

## Responsible use

Only download or convert media when you own it or have permission to do so. Follow the applicable copyright laws and the terms of the sites you use.

## License

No license has been specified yet. Add a `LICENSE` file if you want to grant others permission to use, modify, or redistribute this project.
