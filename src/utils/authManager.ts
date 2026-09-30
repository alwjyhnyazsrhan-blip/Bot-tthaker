import { Account } from '../types/bot';

export const AUTH_STORAGE_KEYS = {
  TOKEN: 'webook_bearer_token',
  ACCOUNTS: 'webook_bot_accounts',
  SESSION_TOKEN: 'wbk_access_token',
};

/**
 * Automatically reads the active Bearer Token from the stored Authentication Manager state
 * (saved account credentials in localStorage, active account, or direct bearer token cache).
 */
export function getActiveBearerToken(): string {
  if (typeof window === 'undefined') return '';

  // 1. Direct active token key
  const directToken = localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)?.trim();
  if (directToken) return directToken;

  // 2. Read from stored accounts (saved account credentials)
  try {
    const savedAccounts = localStorage.getItem(AUTH_STORAGE_KEYS.ACCOUNTS);
    if (savedAccounts) {
      const accounts: Account[] = JSON.parse(savedAccounts);
      if (Array.isArray(accounts) && accounts.length > 0) {
        // Priority 1: account marked active/ready with authToken
        const activeAcc = accounts.find((a) => a.authToken && (a.status === 'active' || a.status === 'ready'));
        if (activeAcc?.authToken?.trim()) {
          const t = activeAcc.authToken.trim();
          localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, t);
          return t;
        }
        // Priority 2: any account with authToken
        const anyAccWithToken = accounts.find((a) => a.authToken?.trim());
        if (anyAccWithToken?.authToken?.trim()) {
          const t = anyAccWithToken.authToken.trim();
          localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, t);
          return t;
        }
        // Priority 3: account with webookSessionToken
        const anyWithSession = accounts.find((a) => a.webookSessionToken?.trim());
        if (anyWithSession?.webookSessionToken?.trim()) {
          const t = anyWithSession.webookSessionToken.trim();
          localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, t);
          return t;
        }
      }
    }
  } catch (e) {
    console.error('[AUTH MANAGER] Failed to parse stored accounts', e);
  }

  // 3. Fallback browser storage keys
  const altToken = 
    sessionStorage.getItem('wbk_access_token') || 
    localStorage.getItem('wbk_access_token') || 
    localStorage.getItem('token');
  if (altToken?.trim()) {
    const t = altToken.trim();
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, t);
    return t;
  }

  return '';
}

/**
 * Returns the currently active account matching the active Bearer Token.
 */
export function getActiveAccount(): Account | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedAccounts = localStorage.getItem(AUTH_STORAGE_KEYS.ACCOUNTS);
    if (savedAccounts) {
      const accounts: Account[] = JSON.parse(savedAccounts);
      if (Array.isArray(accounts) && accounts.length > 0) {
        const activeToken = getActiveBearerToken();
        if (activeToken) {
          const matched = accounts.find((a) => a.authToken === activeToken || a.webookSessionToken === activeToken);
          if (matched) return matched;
        }
        const activeAcc = accounts.find((a) => a.status === 'active' || a.status === 'ready');
        if (activeAcc) return activeAcc;
        return accounts[0] || null;
      }
    }
  } catch (e) {
    console.error('[AUTH MANAGER] Error reading active account', e);
  }
  return null;
}

/**
 * Saves and activates a new Bearer Token, synchronizing it with localStorage and the backend server.
 */
export async function setActiveBearerToken(token: string, email?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const clean = token.trim();
  if (clean) {
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, clean);
    try {
      await fetch('/api/webook/auth/set-active-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: clean, email }),
      });
    } catch {
      // Backend sync error is non-blocking
    }
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
  }
}

/**
 * Universal authenticated fetch wrapper that guarantees Authorization: Bearer <token>
 * is automatically injected from the stored Authentication Manager state.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getActiveBearerToken();
  const headers = new Headers(init.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // If payload is JSON and has missing authToken, inject it automatically into body too
  let newBody = init.body;
  if (token && init.body && typeof init.body === 'string' && (init.method === 'POST' || init.method === 'PUT')) {
    try {
      const parsed = JSON.parse(init.body);
      if (typeof parsed === 'object' && parsed !== null && !parsed.authToken) {
        parsed.authToken = token;
        newBody = JSON.stringify(parsed);
      }
    } catch {}
  }

  return fetch(input, {
    ...init,
    headers,
    body: newBody,
  });
}

/**
 * Safely attempts to patch global fetch without throwing if window.fetch has only a getter.
 */
export function installGlobalFetchInterceptor(): void {
  if (typeof window === 'undefined' || (window as any).__AUTH_INTERCEPTOR_INSTALLED__) {
    return;
  }

  try {
    const originalFetch = window.fetch.bind(window);
    const interceptedFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      
      // Automatically inject into all /api/webook routes and webook.com endpoints
      if (urlStr.includes('/api/webook') || urlStr.includes('webook.com')) {
        const token = getActiveBearerToken();
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }

          let newBody = init?.body;
          if (init?.body && typeof init.body === 'string' && (init.method === 'POST' || init.method === 'PUT')) {
            try {
              const parsed = JSON.parse(init.body);
              if (typeof parsed === 'object' && parsed !== null && !parsed.authToken) {
                parsed.authToken = token;
                newBody = JSON.stringify(parsed);
              }
            } catch {}
          }

          if (input instanceof Request) {
            return originalFetch(new Request(input, { ...init, headers, body: newBody }));
          }

          return originalFetch(input, { ...init, headers, body: newBody });
        }
      }

      return originalFetch(input, init);
    };

    // Safely attempt property definition on window or globalThis without throwing if getter-only
    try {
      Object.defineProperty(window, 'fetch', {
        value: interceptedFetch,
        writable: true,
        configurable: true,
      });
      (window as any).__AUTH_INTERCEPTOR_INSTALLED__ = true;
    } catch {
      try {
        (globalThis as any).fetch = interceptedFetch;
        (window as any).__AUTH_INTERCEPTOR_INSTALLED__ = true;
      } catch {
        // window.fetch is getter-only in this iframe sandbox.
        // Components use explicit getActiveBearerToken() headers which guarantees injection.
      }
    }
  } catch (err) {
    // Non-blocking
  }
}
