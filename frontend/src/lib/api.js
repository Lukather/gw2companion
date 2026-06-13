/**
 * Frontend HTTP client for our backend API.
 * All GW2 API calls are proxied through our backend, so the browser
 * never sees the API key.
 */

const BASE = '/api';

async function request(path, options = {}) {
  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      const error = new Error('Request timed out after 30s. The server may be overloaded or stuck.');
      error.status = 0;
      error.isTimeout = true;
      throw error;
    }
    const error = new Error('Backend server unreachable. Is the server running on port 3000?');
    error.status = 0;
    error.isNetworkError = true;
    throw error;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let body = {};
    try {
      body = await res.json();
    } catch (e) {
      // Response wasn't JSON
    }
    const error = new Error(body.error || `Server error (HTTP ${res.status})`);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return res.json();
}

export const api = {
  // Key management
  setKey: (apiKey) => request('/key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  }),
  checkKey: () => request('/key'),
  deleteKey: () => request('/key', { method: 'DELETE' }),

  // Data
  getCharacters: () => request('/characters'),
  getInventory: () => request('/inventory'),
  getAnalysis: (query = '') => request(`/analyze${query}`),

  // Materials
  getMaterials: () => request('/materials'),

  // Builds
  getBuilds: (character) => request(`/builds${character ? `?character=${encodeURIComponent(character)}` : ''}`),
  refreshMetaBuilds: () => request('/builds/refresh-meta', { method: 'POST' }),

  // Achievements
  getAchievements: (query = '') => request(`/achievements${query}`),

  // Story
  getStory: (character) => request(`/story${character ? `?character=${encodeURIComponent(character)}` : ''}`),

  /**
   * Stream analysis progress via Server-Sent Events.
   * @param {object} callbacks - { onStep, onWarn, onError, onDone }
   * @param {object} opts - { includeWiki, maxWiki }
   * @returns {function} cancel function to abort the request
   */
  streamAnalysis(callbacks, opts = {}) {
    const params = new URLSearchParams({ stream: 'true' });
    if (opts.includeWiki) params.set('wiki', 'true');
    if (opts.maxWiki) params.set('maxWiki', opts.maxWiki.toString());

    const url = `${BASE}/analyze?${params.toString()}`;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          callbacks.onError?.(new Error(body.error || `HTTP ${response.status}`));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Process SSE events from a line buffer
        const processLines = (lines) => {
          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                switch (eventType) {
                  case 'step':
                    callbacks.onStep?.(data);
                    break;
                  case 'warn':
                    callbacks.onWarn?.(data.message);
                    break;
                  case 'error':
                    callbacks.onError?.(new Error(data.error));
                    break;
                  case 'done':
                    callbacks.onDone?.(data);
                    break;
                }
              } catch (e) {
                // ignore parse errors in incomplete chunks
              }
              eventType = '';
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();

          // Process any data even if stream is done (buffered proxy case)
          if (value && value.length > 0) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split('\n');
            // Keep the last partial line in the buffer
            buffer = done ? '' : (lines.pop() || '');
            processLines(lines);
          }

          if (done) {
            // Flush any remaining partial data
            if (buffer.trim()) {
              processLines([buffer]);
            }
            break;
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          callbacks.onError?.(err);
        }
      });

    return () => controller.abort();
  },
};
