// Twitter Block Search - Оптимизированная версия
// Добавляет кнопку поиска двусторонней переписки с заблокировавшим пользователем

// Флаг подробного логирования
const TBS_DEBUG = true;

function tbsLog(...args) {
  if (TBS_DEBUG) console.log('Twitter Block Search:', ...args);
}

function tbsWarn(...args) {
  if (TBS_DEBUG) console.warn('Twitter Block Search:', ...args);
}

// Получить SVG иконку лупы
function getSearchIcon() {
  return `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"/>
    </svg>
  `;
}

function createStatusDot() {
  const dot = document.createElement('span');
  dot.className = 'twitter-block-search-status hidden';
  dot.title = 'Проверка результатов поиска...';
  return dot;
}



// Функция для добавления кнопки поиска
async function addSearchButton() {
  // Проверяем, есть ли уже кнопка на странице
  if (document.querySelector('.twitter-block-search-btn')) {
    tbsLog('Button already exists, skipping add');
    return;
  }
  
  // Ищем элементы в порядке приоритета
  const selectors = ['h1', 'h2', 'h3', 'span', 'div'];
  let targetElement = null;
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent && 
          element.offsetParent !== null && // элемент видим
          !element.querySelector('.twitter-block-search-btn')) { // кнопка еще не добавлена
        
        const text = element.textContent.trim();
        const match = text.match(/@(\w+)\s+has blocked you/);
        
        if (match) {
          tbsLog('Found blocked text in element', { selector, text });
          targetElement = element;
          break;
        }
      }
    }
    if (targetElement) break;
  }
  
  // Если нашли подходящий элемент, добавляем кнопку
  if (targetElement) {
    const text = targetElement.textContent;
    const match = text.match(/@(\w+)\s+has blocked you/);
    
    if (match) {
      const blockedUsername = match[1];
      const currentUser = getCurrentUsername();
      
      if (!currentUser) {
        tbsWarn('Cannot determine current user, skipping button');
        return;
      }
      
      // Создаем кнопку с временной иконкой загрузки
      const searchButton = document.createElement('button');
      searchButton.className = 'twitter-block-search-btn loading';
      searchButton.innerHTML = `<span style="font-size: 12px;">⏳</span>`;
      searchButton.title = 'Проверяем наличие переписки...';
      searchButton.disabled = true;
      
      // ВАЖНО: Добавляем обработчик клика сразу, чтобы он работал всегда
      searchButton.addEventListener('click', handleSearchClick);
      
      // Добавляем кнопку сразу
      const statusDot = createStatusDot();

      targetElement.style.display = 'inline-flex';
      targetElement.style.alignItems = 'center';
      targetElement.style.gap = '8px';
      targetElement.appendChild(searchButton);
      targetElement.appendChild(statusDot);
      
      // Просто показываем лупу - проверка результатов поиска технически невозможна
      searchButton.className = 'twitter-block-search-btn';
      searchButton.disabled = false;
      searchButton.innerHTML = getSearchIcon();
      searchButton.title = `Найти переписку между @${currentUser} и @${blockedUsername}`;
      tbsLog('Search button added for @' + blockedUsername);

      // Фоновая проверка: есть ли результаты поиска
      checkSearchResults(currentUser, blockedUsername, statusDot);
    }
  }
}

// Обработчик клика по кнопке поиска
function handleSearchClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Извлекаем имя заблокированного пользователя из title кнопки
  const title = e.currentTarget.title;
  const match = title.match(/@(\w+)$/);
  if (!match) return;
  
  const blockedUsername = match[1];
  const currentUser = getCurrentUsername();
  
  if (!currentUser) {
    console.error('Twitter Block Search: Не удалось определить имя пользователя');
    showUserFriendlyError('Не удалось определить ваше имя пользователя. Пожалуйста, убедитесь, что вы авторизованы в Twitter/X.');
    return;
  }
  
  // Валидация никнеймов
  if (!isValidUsername(currentUser) || !isValidUsername(blockedUsername)) {
    console.error('Twitter Block Search: Некорректные никнеймы', { currentUser, blockedUsername });
    showUserFriendlyError('Обнаружены некорректные никнеймы. Попробуйте обновить страницу.');
    return;
  }
  
  const searchUrl = buildSearchUrl(currentUser, blockedUsername);
  
  tbsLog('Opening search', {
    currentUser,
    blockedUser: blockedUsername,
    searchUrl
  });
  
  // Открываем в новом окне
  try {
    window.open(searchUrl, '_blank');
  } catch (error) {
    console.error('Twitter Block Search: Ошибка при открытии поиска', error);
    showUserFriendlyError('Не удалось открыть поиск. Попробуйте еще раз.');
  }
}

function buildSearchUrl(currentUser, blockedUsername) {
  const searchQuery = `(from:${currentUser} to:${blockedUsername}) OR (from:${blockedUsername} to:${currentUser})`;
  return `https://x.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query&f=live`;
}

function checkSearchResults(currentUser, blockedUsername, statusDot) {
  if (!statusDot) return;

  statusDot.classList.remove('hidden', 'status-red', 'status-green');
  statusDot.classList.add('status-pending');
  statusDot.classList.add('hidden');

  const searchUrl = buildSearchUrl(currentUser, blockedUsername);
  const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const button = statusDot.parentElement?.querySelector('.twitter-block-search-btn');
  if (button) {
    button.classList.add('checking');
  }

  tbsLog('Starting background check', { currentUser, blockedUsername, searchUrl, requestId });

  chrome.runtime.sendMessage(
    { type: 'TBS_CHECK_SEARCH', searchUrl, requestId },
    (response) => {
      statusDot.classList.remove('status-pending');
      if (button) {
        button.classList.remove('checking');
      }

      if (!response || !response.ok || response.requestId !== requestId) {
        tbsWarn('Background check failed', response);
        statusDot.classList.add('hidden');
        return;
      }

      tbsLog('Background check response', response);

      if (response.status === 'no_results' || (response.hasNoResults && !response.hasResults)) {
        statusDot.classList.add('hidden');
        statusDot.title = 'Ничего не найдено';

        if (button) {
          button.classList.add('no-results');
          button.innerHTML = '<span class="tbs-clown">🤡</span>';
          button.title = 'Ничего не найдено';
        }
        return;
      }

      if (response.status === 'results' || response.hasResults) {
        statusDot.classList.add('hidden');
        statusDot.title = 'Найдены результаты';

        if (button) {
          button.classList.remove('no-results');
          button.innerHTML = getSearchIcon();
          button.title = button.title || 'Открыть поиск';
        }
        return;
      }

      statusDot.classList.add('hidden');
    }
  );
}

// Функция для получения текущего имени пользователя с кэшированием
function getCurrentUsername() {
  // Проверяем кэш (5 минут)
  if (getCurrentUsername._cache && getCurrentUsername._cacheTime && 
      Date.now() - getCurrentUsername._cacheTime < 300000) {
    tbsLog('Using cached username', getCurrentUsername._cache);
    return getCurrentUsername._cache;
  }
  
  // Приоритетные селекторы для определения вашего аккаунта
  const selectors = [
    '[data-testid="SideNav_AccountSwitcher_Button"] img[alt*="@"]',
    '[data-testid="UserAvatar-Container"] img[alt*="@"]',
    'nav a[href*="/profile"]',
    '[data-testid="AppTabBar_Profile_Link"]',
    'a[href*="/home"]',
    'a[href*="/notifications"]',
    'a[href*="/messages"]',
    'a[href*="/bookmarks"]',
    'a[href*="/lists"]',
    'meta[property="og:url"]',
    'meta[name="twitter:site"]'
  ];
  
  // Ищем никнейм в приоритетных селекторах
  for (const selector of selectors) {
    const username = extractUsernameFromElement(selector);
    if (username) {
      // Кэшируем результат
      getCurrentUsername._cache = username;
      getCurrentUsername._cacheTime = Date.now();
      tbsLog('Username found (priority selector)', { selector, username });
      return username;
    }
  }
  
  // Fallback селекторы
  const fallbackSelectors = [
    '[data-testid="SideNav_AccountSwitcher_Button"] img',
    '[data-testid="UserAvatar-Container"] img',
    'a[href*="/profile"] img[alt*="@"]',
    '[data-testid="UserName"] span'
  ];
  
  for (const selector of fallbackSelectors) {
    const username = extractUsernameFromElement(selector);
    if (username) {
      getCurrentUsername._cache = username;
      getCurrentUsername._cacheTime = Date.now();
      tbsLog('Username found (fallback selector)', { selector, username });
      return username;
    }
  }

  tbsWarn('Username not found');
  return null;
}

// Извлечь никнейм из элемента
function extractUsernameFromElement(selector) {
  const element = document.querySelector(selector);
  if (!element) return null;
  
  // Проверяем alt атрибут
  if (element.alt && element.alt.includes('@')) {
    const match = element.alt.match(/@(\w+)/);
    if (match) return match[1];
  }
  
  // Проверяем текст элемента
  if (element.textContent && element.textContent.includes('@')) {
    const match = element.textContent.match(/@(\w+)/);
    if (match) return match[1];
  }
  
  // Проверяем content мета-тегов
  if (element.content && element.content.includes('/')) {
    const match = element.content.match(/\/(\w+)$/);
    if (match) return match[1];
  }
  
  // Проверяем href ссылок (исключаем системные страницы)
  if (element.href && element.href.includes('/')) {
    const match = element.href.match(/\/(\w+)(?:\/|$)/);
    if (match && !isSystemPage(match[1])) {
      return match[1];
    }
  }
  
  return null;
}

// Проверить, является ли страница системной
function isSystemPage(pageName) {
  const systemPages = [
    'home', 'explore', 'search', 'notifications', 
    'messages', 'settings', 'bookmarks', 'lists',
    'profile', 'compose', 'i', 'intent'
  ];
  return systemPages.includes(pageName.toLowerCase());
}

// Оптимизированный наблюдатель DOM с debouncing
function observeDOM() {
  let timeoutId = null;
  let isProcessing = false;
  
  const debouncedAddButton = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      if (!isProcessing) {
        isProcessing = true;
        await addSearchButton();
        isProcessing = false;
      }
    }, 300);
  };
  
  const observer = new MutationObserver((mutations) => {
    // Быстрая проверка - если кнопка уже есть или идет обработка, не обрабатываем
    if (document.querySelector('.twitter-block-search-btn') || isProcessing) {
      return;
    }
    
    // Оптимизированная проверка мутаций
    const hasRelevantChanges = mutations.some(mutation => {
      if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
        return false;
      }
      
      return Array.from(mutation.addedNodes).some(node => {
        return node.nodeType === Node.ELEMENT_NODE && 
               node.textContent && 
               node.textContent.includes('has blocked you');
      });
    });
    
    if (hasRelevantChanges) {
      tbsLog('Relevant DOM changes detected, scheduling addSearchButton');
      debouncedAddButton();
    }
  });
  
  // Оптимизированные настройки наблюдения
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false, // Не отслеживаем изменения текста
    attributes: false     // Не отслеживаем изменения атрибутов
  });
  
  return observer;
}

// Глобальная переменная для наблюдателя
let domObserver = null;

// Инициализация расширения
async function init() {
  tbsLog('Initializing...');
  
  // Останавливаем предыдущий наблюдатель, если есть
  if (domObserver) {
    domObserver.disconnect();
  }
  
  // Добавляем кнопки сразу
  await addSearchButton();
  
  // Начинаем наблюдение за изменениями DOM
  domObserver = observeDOM();
  
  tbsLog('Initialized successfully');
}

// Очистка ресурсов
function cleanup() {
  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
  tbsLog('Cleaned up');
}

// Валидация никнейма Twitter (1-15 символов, буквы, цифры, подчеркивания)
function isValidUsername(username) {
  return username && typeof username === 'string' && /^[a-zA-Z0-9_]{1,15}$/.test(username);
}

// Показать пользователю дружелюбное сообщение об ошибке
function showUserFriendlyError(message) {
  // Можно заменить на более элегантное уведомление
  alert(message);
}



// Очистка кэша при смене URL (для SPA навигации)
function setupNavigationHandler() {
  let currentUrl = window.location.href;
  
  // Проверяем изменения URL каждые 2 секунды
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      tbsLog('URL changed, clearing cache');
      
      // Очищаем кэш никнейма
      if (getCurrentUsername._cache) {
        getCurrentUsername._cache = null;
        getCurrentUsername._cacheTime = null;
      }
      
      // Добавляем кнопки на новой странице с небольшой задержкой
      setTimeout(() => addSearchButton(), 500);
    }
  }, 2000);
}

// Запуск после загрузки страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await init();
    setupNavigationHandler();
  });
} else {
  init().then(() => setupNavigationHandler());
}

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', cleanup);
