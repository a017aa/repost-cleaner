# Repost Cleaner

## Task
Removing a large number of TikTok reposts manually is tedious and time‑consuming. TikTok does not provide a built‑in way to bulk remove reposts; you must open each video, click the repost button, close it, and repeat. The challenge is to automate this process safely and efficiently without triggering TikTok's rate limits or accidentally removing your own original posts.

## Description
Repost Cleaner is a Chrome extension that automates the removal of your TikTok reposts. It scans your profile's **Reposts** tab, finds up to a configurable number of reposts (50–300), and then removes them one by one using TikTok's own lightbox navigation. The extension:

- Scans only the Reposts tab, never your own videos.
- Uses the **next arrow** inside TikTok's lightbox to move between videos, avoiding the slow “open‑close‑reopen” loop.
- Includes a selectable scan limit (50, 100, 150, 200, 250, 300) to control batch size.
- Provides a side panel with status, progress, pause/resume/stop controls, and a completion popup.
- Respects TikTok's rate limits by pacing removals (~0.8s between videos).

## Permissions
The extension requires the following permissions for core functionality:

- **activeTab** – to access the currently open TikTok tab when you interact with the side panel.
- **sidePanel** – to open the extension in Chrome's side panel.
- **storage** – to save your selected scan limit preference between sessions.
- **Host permission for `*.tiktok.com`** – required to run the automation script on TikTok pages and detect/remove reposts.

No personal data is collected, stored, or transmitted. All operations happen locally in your browser.

## Installation
1. Download or clone the extension files into a folder (e.g., `repost-cleaner`).
```
git clone https://github.com/a017aa/repost-cleaner
```
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the folder containing the extension files.
5. The extension icon appears in the toolbar. Click it to open the side panel.

> The extension requires no additional dependencies or build steps – just load the folder as an unpacked extension. (It will be available on Chrome Webstore soon.)

## Usage
1. Log in to TikTok and go to your own profile page (e.g., `https://www.tiktok.com/@yourusername`).
2. Click the **Repost Cleaner** icon in the Chrome toolbar to open the side panel.
3. In the side panel, select the desired **Scan limit** (default 300, options from 50 to 300).
4. Click **Scan Reposts**.
   - The extension will automatically switch to your Reposts tab and scroll to load reposts up to the selected limit.
   - The status bar shows scanning progress.
5. Once scanning is complete, the **Remove All** button becomes enabled. Click it to start the removal process.
   - The extension opens the first repost, clicks the repost button, then uses the **next arrow** to move to the next video without closing the lightbox.
   - You can pause, resume, or stop the process at any time.
6. When finished (or stopped), a popup appears: *“The process is done. You need to reload in order to see the changes or continue removing reposts.”* The Remove, Pause, and Stop buttons are disabled until you start a new scan.

### Notes
- The process works on background, you can browse in chrome as long as you keep TikTok open.
- If the Reposts tab is not visible on your profile, repost a random video and reload the page before scanning.
- The extension only removes reposts; it does not delete videos or affect your own original posts.
- TikTok may change its interface; if the extension stops working, the selectors in `content.js` may need updating.

## Support
For issues or feature requests, please open an issue in the repository or contact the developer via https://t.me/a0017aa.

## License
All rights reserved. Made by @a017aa.
