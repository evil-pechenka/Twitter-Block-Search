// Background service worker for Twitter Block Search

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'TBS_CHECK_SEARCH') return;

  const { searchUrl, requestId } = message;
  console.log('[TBS] message received', {
    requestId,
    searchUrl,
    senderTabId: sender?.tab?.id,
    senderUrl: sender?.tab?.url
  });
  console.log('[TBS] check search start', { requestId, searchUrl });

  chrome.tabs.create({ url: searchUrl, active: false }, (tab) => {
    if (!tab || !tab.id) {
      console.warn('[TBS] failed to create tab', { requestId });
      sendResponse({ ok: false, requestId, error: 'Failed to create tab' });
      return;
    }

    const tabId = tab.id;
    const timeoutMs = 15000;
    const timeoutId = setTimeout(() => {
      console.warn('[TBS] timeout waiting for results', { requestId });
      chrome.tabs.remove(tabId);
      sendResponse({ ok: false, requestId, error: 'Timeout waiting for search results' });
    }, timeoutMs);

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId !== tabId) return;
      if (info.status !== 'complete') return;

      chrome.tabs.onUpdated.removeListener(onUpdated);

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: () => new Promise((resolve) => {
            const start = Date.now();
            const maxWait = 8000;
            const interval = 300;
            const noResultsPatterns = [
              'ничего не найдено',
              'no results found',
              'no results for'
            ];

            const check = () => {
              const bodyText = (document.body && document.body.innerText)
                ? document.body.innerText.toLowerCase()
                : '';

              const hasNoResults = noResultsPatterns.some((p) => bodyText.includes(p));
              const emptyState = document.querySelector('[data-testid="emptyState"], [data-testid="emptyState-cell"]');
              const results = document.querySelectorAll('article');
              const hasResults = results && results.length > 0;

              if (hasResults) {
                resolve({ status: 'results', hasResults: true, hasNoResults: false });
                return;
              }

              if (hasNoResults || emptyState) {
                resolve({ status: 'no_results', hasResults: false, hasNoResults: true });
                return;
              }

              if (Date.now() - start > maxWait) {
                resolve({ status: 'unknown', hasResults: false, hasNoResults: false });
                return;
              }

              setTimeout(check, interval);
            };

            check();
          })
        },
        (injectionResults) => {
          clearTimeout(timeoutId);
          chrome.tabs.remove(tabId);

          if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
            console.warn('[TBS] injection failed', {
              requestId,
              error: chrome.runtime.lastError?.message || 'Script injection failed'
            });
            sendResponse({ ok: false, requestId, error: chrome.runtime.lastError?.message || 'Script injection failed' });
            return;
          }

          const result = injectionResults[0].result || {};
          console.log('[TBS] check search result', { requestId, result });
          sendResponse({ ok: true, requestId, ...result });
        }
      );
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  });

  return true; // keep the message channel open for async response
});
