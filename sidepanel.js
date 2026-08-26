let currentTabId = null;
let pendingReadyMessage = null;
async function getActiveTikTokTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs.find(tab => tab.url && tab.url.includes('tiktok.com'));
}
async function sendCommand(cmd, payload = {}) {
  const tab = await getActiveTikTokTab();
  if (!tab) {
    log('Please open TikTok in the active tab.', 'error');
    return false;
  }
  currentTabId = tab.id;
  try {
    await chrome.tabs.sendMessage(tab.id, { to: 'content', cmd, ...payload });
    return true;
  } catch (e) {
    log('Could not connect to TikTok page. Reload the page and try again.', 'error');
    return false;
  }
}
function setBusy(isBusy) {
  document.getElementById('scanBtn').disabled = isBusy;
  document.getElementById('removeBtn').disabled = isBusy;
  document.getElementById('pauseBtn').disabled = !isBusy;
  document.getElementById('stopBtn').disabled = !isBusy;
  if (!isBusy) {
    document.getElementById('pauseBtn').textContent = 'Pause';
  }
}
function setStatusIcon(type) {
  const icon = document.getElementById('statusIcon');
  if (!icon) return;
  icon.style.animation = '';
  switch (type) {
    case 'ready':
      icon.className = 'ti ti-circle-check';
      icon.style.color = '#5DCAA5';
      break;
    case 'processing':
      icon.className = 'ti ti-loader';
      icon.style.color = '#F0997B';
      icon.style.animation = 'spin 1s linear infinite';
      break;
    case 'error':
      icon.className = 'ti ti-alert-triangle';
      icon.style.color = '#E24B4A';
      break;
    case 'paused':
      icon.className = 'ti ti-player-pause';
      icon.style.color = '#F0997B';
      break;
    case 'stopped':
      icon.className = 'ti ti-player-stop';
      icon.style.color = '#E24B4A';
      break;
    default:
      icon.className = 'ti ti-circle-check';
      icon.style.color = '#5DCAA5';
  }
}
function updateStatus(text, iconType = 'ready') {
  document.getElementById('statusText').textContent = text;
  setStatusIcon(iconType);
}
function updateProgress(removed, total) {
  const container = document.getElementById('progressContainer');
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  if (total > 0) {
    container.hidden = false;
    const percent = Math.round((removed / total) * 100);
    fill.style.width = percent + '%';
    text.textContent = `${removed} / ${total}`;
  } else {
    container.hidden = true;
  }
}
function log(message, type = '') {
  const logContainer = document.getElementById('logContainer');
  const entry = document.createElement('div');
  entry.className = 'log-entry' + (type ? ' ' + type : '');
  entry.textContent = message;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}
function showCompletionModal() {
  document.getElementById('completionModal').hidden = false;
}
function hideCompletionModal() {
  document.getElementById('completionModal').hidden = true;
}
async function init() {
  const tab = await getActiveTikTokTab();
  if (!tab) {
    updateStatus('Open TikTok to begin', 'error');
    return;
  }
  currentTabId = tab.id;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { to: 'content', cmd: 'ping' });
    if (response && response.ok) {
      updateStatus('Ready', 'ready');
      log('Connected to TikTok');
    }
  } catch (e) {
    updateStatus('TikTok page not ready', 'error');
    log('Reload the TikTok page and try again.', 'error');
  }
}
document.getElementById('scanBtn').addEventListener('click', async () => {
  hideCompletionModal();
  const limitSelect = document.getElementById('limitSelect');
  const rawValue = limitSelect.value;
  const limit = parseInt(rawValue, 10);
  if (isNaN(limit) || limit <= 0) {
    log('Please select a valid scan limit from the dropdown.', 'error');
    updateStatus('Invalid scan limit', 'error');
    return;
  }
  log(`Scanning for reposts (limit ${limit})...`);
  setBusy(true);
  updateStatus(`Scanning... (limit ${limit})`, 'processing');
  const success = await sendCommand('scan', { limit });
  if (!success) {
    setBusy(false);
    updateStatus('Scan failed', 'error');
  }
});
document.getElementById('removeBtn').addEventListener('click', async () => {
  log('Starting removal...');
  setBusy(true);
  updateStatus('Removing reposts...', 'processing');
  const success = await sendCommand('remove');
  if (!success) {
    setBusy(false);
    updateStatus('Removal failed', 'error');
  }
});
document.getElementById('pauseBtn').addEventListener('click', async () => {
  const btn = document.getElementById('pauseBtn');
  if (btn.textContent === 'Pause') {
    btn.textContent = 'Resume';
    updateStatus('Paused', 'paused');
    await sendCommand('pause');
  } else {
    btn.textContent = 'Pause';
    updateStatus('Resuming...', 'processing');
    await sendCommand('resume');
  }
});
document.getElementById('stopBtn').addEventListener('click', async () => {
  log('Stopping...', 'error');
  await sendCommand('stop');
  setBusy(false);
  updateStatus('Stopped', 'stopped');
  showCompletionModal();
});
document.getElementById('modalOkBtn').addEventListener('click', hideCompletionModal);
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.to !== 'panel') return;
  switch (message.type) {
    case 'ready':
      if (message.handle && message.handle !== 'unknown') {
        log(`Ready (account: @${message.handle})`);
        log(`If you face a situation where the repost section doesn't show on your profile, repost a random video then reload the page.`);
        updateStatus('Ready', 'ready');
      } else {
        pendingReadyMessage = message;
      }
      break;
    case 'status':
      if (message.text.includes('Scanning') || message.text.includes('Removing') || message.text.includes('Processing')) {
        updateStatus(message.text, 'processing');
      } else {
        updateStatus(message.text, 'ready');
      }
      break;
    case 'scanCount':
      updateStatus(`Scanning... ${message.n} reposts found`, 'processing');
      break;
    case 'scanned':
      document.getElementById('removeBtn').disabled = false;
      setBusy(false);
      updateStatus(`Found ${message.count} reposts`, 'ready');
      break;
    case 'progress':
      updateProgress(message.removed, message.total);
      updateStatus(`Processing ${message.removed} of ${message.total}`, 'processing');
      break;
    case 'removed':
      log(`Removed: ${message.item.caption}`, 'success');
      break;
    case 'done':
      setBusy(false);
      document.getElementById('removeBtn').disabled = true;
      document.getElementById('pauseBtn').disabled = true;
      document.getElementById('stopBtn').disabled = true;
      updateProgress(message.removed, message.removed);
      log(`Finished. Removed ${message.removed} reposts.`, message.stopped ? 'error' : 'success');
      updateStatus(message.stopped ? 'Stopped' : 'Done', message.stopped ? 'stopped' : 'ready');
      showCompletionModal();
      break;
    case 'log':
      log(message.text);
      break;
  }
});
init();