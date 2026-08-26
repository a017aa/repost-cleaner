(() => {
  if (window.__repostCleanerLoaded) return;
  window.__repostCleanerLoaded = true;
  const PACE_MS = 800;
  const INITIAL_WAIT_MS = 1600;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const clickEl = (el) => {
    if (!el) return false;
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    return true;
  };
  const TILE_SELECTOR = [
    '[data-e2e="user-post-item"] a[href*="/video/"]',
    '[data-e2e="user-post-item"] a[href*="/photo/"]',
    '[class*="DivPlayerContainer"] a[href*="/video/"]',
    '[class*="DivItemContainer"] a[href*="/video/"]',
    '[class*="video-feed-item"] a[href*="/video/"]',
    'a[href*="/video/"]',
    'a[href*="/photo/"]'
  ].join(',');
  const videoIdOf = (href) => {
    const m = (href || '').match(/\/(?:video|photo)\/(\d+)/);
    return m ? m[1] : '';
  };
  function readOwnHandle() {
    try {
      const node = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__') || document.getElementById('SIGI_STATE');
      if (!node) return '';
      const json = JSON.parse(node.textContent || '{}');
      const user = ((json.__DEFAULT_SCOPE__ || {})['webapp.app-context'] || {}).user || {};
      return String(user.uniqueId || '').toLowerCase();
    } catch { return ''; }
  }
  const isRepostLabel = (v) => /reposts?|re-posts?|reshare|reposted|repostlar|yeniden|payla[sş][ıi]m/i.test(v || '');
  const labelFor = (el) => [
    el?.getAttribute?.('aria-label'), el?.getAttribute?.('title'), el?.getAttribute?.('data-e2e'),
    el?.getAttribute?.('data-testid'), el?.getAttribute?.('href'), el?.innerText, el?.textContent
  ].map((x) => x || '').join(' ');

  function findRepostTab() {
    return Array.from(document.querySelectorAll([
      '[class*="PRepost"]', '[data-e2e="profile-repost-tab"]', '[data-e2e*="repost" i]',
      '[data-testid*="repost" i]', '[aria-label*="repost" i]', '[title*="repost" i]',
      'a[href*="repost"]', 'button', '[role="tab"]'
    ].join(','))).filter(visible).find((el) => isRepostLabel(labelFor(el)));
  }
  function scrollTarget() {
    const root = document.scrollingElement || document.documentElement || document.body;
    const scrollables = Array.from(document.querySelectorAll('main, section, div'))
      .filter((el) => {
        const s = getComputedStyle(el);
        return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 100;
      })
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    return scrollables[0] || root;
  }
  async function openRepostsTab() {
    const tab = findRepostTab();
    if (tab) { clickEl(tab); await wait(400); }
    const t = scrollTarget();
    for (const top of [160, 420, 760]) {
      try { t.scrollTo({ top, behavior: 'auto' }); } catch { t.scrollTop = top; }
      window.dispatchEvent(new Event('scroll', { bubbles: true }));
      await wait(260);
    }
    return { tabFound: !!tab };
  }
  async function scrollMore() {
    const t = scrollTarget();
    t.scrollBy({ top: Math.round(innerHeight * 1.35), behavior: 'auto' });
    window.dispatchEvent(new Event('scroll', { bubbles: true }));
  }
  function repostAnchors() {
    const seen = new Set();
    const out = [];
    for (const a of Array.from(document.querySelectorAll(TILE_SELECTOR)).filter(visible)) {
      const href = a.href || a.getAttribute('href') || '';
      const id = videoIdOf(href);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const tile = a.closest('[data-e2e="user-post-item"], [class*="DivPlayerContainer"], [class*="DivItemContainer"], article') || a;
      const caption = norm(a.getAttribute('aria-label') || tile.querySelector('img[alt]')?.alt || tile.innerText || 'Repost')
        .replace(/^(Pinned|Repost|Reposted|Video)\s*/i, '') || 'Repost';
      out.push({ id, anchor: a, url: href, caption: caption.slice(0, 80) });
    }
    return out;
  }
  const rootScroller = () => document.scrollingElement || document.documentElement || document.body;
  function scrollToBottom() {
    const root = rootScroller();
    try { window.scrollTo(0, root.scrollHeight); } catch {}
    try { root.scrollTop = root.scrollHeight; } catch {}
    const t = scrollTarget();
    if (t && t !== root && t !== document.body) { try { t.scrollTop = t.scrollHeight; } catch {} }
    window.dispatchEvent(new Event('scroll', { bubbles: true }));
  }
  async function scanAll(onProgress, onLog, limit) {
    const { tabFound } = await openRepostsTab();
    if (!tabFound) {
      onLog('Could not find your Reposts tab — open your OWN profile (tiktok.com/@you → Reposts) and rescan.');
      return [];
    }
    const byId = new Map();
    let stable = 0, lastHeight = 0;
    for (let i = 0; i < 150 && stable < 4 && byId.size < limit; i++) {
      const beforeCount = byId.size;
      for (const t of repostAnchors()) {
        if (byId.size >= limit) break;
        if (!byId.has(t.id)) byId.set(t.id, t);
      }
      onProgress(byId.size);
      if (i % 5 === 0 && byId.size) onLog(`Scrolling to load reposts… ${byId.size} so far (max ${limit})`);
      const height = rootScroller().scrollHeight;
      const grew = byId.size > beforeCount || height > lastHeight + 4;
      stable = grew ? 0 : stable + 1;
      lastHeight = height;
      scrollToBottom();
      await wait(650);
    }
    if (byId.size >= limit) onLog(`Reached limit of ${limit} reposts.`);
    return Array.from(byId.values());
  }
  const REPOST_BTN_SEL = '[data-e2e="video-share-repost"], button[aria-label*="repost" i], [class*="repost" i] button, button[class*="repost" i]';
  const NEXT_BTN_SEL = '[data-e2e="arrow-right"], [data-e2e="browse-next"], button[aria-label*="next" i], button[aria-label*="next video" i], [class*="arrow-right"] button';
  function findRepostButton() {
    const el = Array.from(document.querySelectorAll(REPOST_BTN_SEL)).find(visible);
    return el ? (el.closest('button, [role="button"]') || el) : null;
  }
  function findNextButton() {
    const el = Array.from(document.querySelectorAll(NEXT_BTN_SEL)).find(visible);
    return el ? (el.closest('button, [role="button"]') || el) : null;
  }
  const isYellowish = (c) => {
    const m = String(c || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const r = +m[1], g = +m[2], b = +m[3];
    return r > 175 && g > 130 && b < 120;
  };
  function repostState(btn) {
    if (!btn) return 'off';
    const p = btn.getAttribute('aria-pressed');
    if (p === 'true') return 'on';
    if (p === 'false') return 'off';
    const svg = btn.querySelector('svg') || btn;
    const cs = getComputedStyle(svg);
    return isYellowish(cs.fill && cs.fill !== 'none' ? cs.fill : cs.color) ? 'on' : 'unknown';
  }
  function currentVideoInfo() {
    const el = document.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"], h1[data-e2e="video-title"]');
    return { caption: norm(el?.textContent || '').slice(0, 80) || 'Repost', url: location.href };
  }
  async function unrepostOpenVideo() {
    let btn = findRepostButton();
    if (!btn) {
      const share = Array.from(document.querySelectorAll('[data-e2e="share-icon"], [data-e2e="browse-more"], button[aria-label*="share" i], button[aria-label*="more" i]')).find(visible);
      if (share) { share.click(); await wait(700); btn = findRepostButton(); }
    }
    if (!btn) return 'notfound';
    const before = repostState(btn);
    if (before === 'off') return 'skipped';
    btn.click();
    for (let i = 0; i < 8; i++) {
      await wait(300);
      const b2 = findRepostButton();
      if (!b2 || repostState(b2) === 'off') return 'removed';
    }
    return before === 'unknown' ? 'removed' : 'skipped';
  }
  async function closeModal() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    const close = Array.from(document.querySelectorAll('button[aria-label*="close" i], button[data-e2e="browse-close"]')).find(visible);
    if (close) clickEl(close);
    await wait(400);
  }
  async function removeAllFast({ total, onLog, onRemoved, onProgress, isPaused, shouldStop }) {
    if (!scanned.length) return 0;
    let removed = 0, skipped = 0, notFoundCount = 0;
    let currentIndex = 0;
    const first = scanned[0];
    onLog(`Opening: ${first.caption}`);
    clickEl(first.anchor);
    await wait(INITIAL_WAIT_MS);
    while (!shouldStop() && currentIndex < total) {
      while (isPaused() && !shouldStop()) await wait(300);
      if (shouldStop()) break;
      const info = currentVideoInfo();
      const caption = info.caption !== 'Repost' ? info.caption : `Repost ${currentIndex + 1}`;
      const result = await unrepostOpenVideo();
      if (result === 'removed') {
        removed++;
        notFoundCount = 0;
        onRemoved({ caption, url: info.url || scanned[currentIndex]?.url });
        onProgress(removed);
        onLog(`✓ Removed (${removed}/${total}): ${caption}`);
      } else if (result === 'notfound') {
        notFoundCount++;
        onLog(`⚠ No repost button for: ${caption}`);
        if (notFoundCount >= 3) {
          onLog('Stopping: no repost button found 3 times consecutively.');
          break;
        }
      } else {
        skipped++;
        onLog(`• Skipped (not a repost or already removed): ${caption}`);
      }
      currentIndex++;
      const nextBtn = findNextButton();
      if (!nextBtn) {
        onLog('No next button found. Ending process.');
        break;
      }
      nextBtn.click();
      await wait(PACE_MS);
    }

    await closeModal();
    return removed;
  }
  const send = (m) => { try { chrome.runtime.sendMessage({ to: 'panel', ...m }); } catch {} };
  const log = (text) => send({ type: 'log', text });
  let running = false, paused = false, stopFlag = false, scanned = [];
  let badge, glow;
  function setActive(on) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'repost-cleaner-badge';
      badge.textContent = 'Repost Cleaner active';
      document.documentElement.appendChild(badge);
      glow = document.createElement('div');
      glow.id = 'repost-cleaner-glow';
      document.documentElement.appendChild(glow);
    }
    badge.hidden = !on;
    glow.hidden = !on;
  }
  async function doScan(limit) {
    if (running) return;
    running = true; stopFlag = false;
    setActive(true);
    send({ type: 'status', text: `Scanning your reposts… (limit ${limit})` });
    log(`Looking for your Reposts tab… (limit ${limit})`);
    let items = [];
    try {
      items = await scanAll((n) => send({ type: 'scanCount', n }), log, limit);
    } catch (e) {
      log('Scan failed — open your own profile and try again.');
      send({ type: 'status', text: 'Scan failed. Open your profile → Reposts.' });
      running = false; setActive(false); return;
    }
    scanned = items;
    log(`Found ${items.length} reposts.`);
    send({ type: 'scanned', count: items.length });
    running = false; setActive(false);
  }
  async function doRemove() {
    if (running || !scanned.length) return;
    running = true; stopFlag = false; paused = false;
    setActive(true);
    const total = scanned.length;
    send({ type: 'status', text: `Processing 0 of ${total}` });
    send({ type: 'progress', removed: 0, total });
    log('Starting fast repost removal…');
    let removed = 0;
    try {
      removed = await removeAllFast({
        total,
        onLog: log,
        onRemoved: (item) => send({ type: 'removed', item }),
        onProgress: (n) => { send({ type: 'progress', removed: n, total }); send({ type: 'status', text: `Processing ${n} of ${total}` }); },
        isPaused: () => paused,
        shouldStop: () => stopFlag
      });
    } catch (e) {
      log(`Error: ${e && e.message ? e.message : e}`);
    }
    send({ type: 'done', removed, stopped: stopFlag });
    log(stopFlag ? `Stopped. Removed ${removed} reposts.` : `Done! Removed ${removed} reposts.`);
    log(`After reloading the page, if the repost button disappears, repost a random video then reload the page.`)
    running = false; setActive(false);
  }
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.to !== 'content') return;
    switch (msg.cmd) {
      case 'ping': sendResponse({ ok: true, handle: readOwnHandle() }); return true;
      case 'scan': doScan(msg.limit || 300); break;
      case 'remove': doRemove(); break;
      case 'pause': paused = true; log('Paused.'); break;
      case 'resume': paused = false; log('Resumed.'); break;
      case 'stop': stopFlag = true; break;
    }
  });
  function sendReady() {
  const handle = readOwnHandle();
  if (handle) {
    send({ type: 'ready', handle });
  } else {
    setTimeout(sendReady, 500);
  }
}
sendReady();
})();