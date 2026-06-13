import { writable } from 'svelte/store';

// Whether the user has a valid API key stored
export const hasKey = writable(false);

// Inventory items loaded from the server
export const inventory = writable([]);

// Analysis results
export const analysis = writable([]);

// Loading state
export const loading = writable(false);

// Error state
export const error = writable(null);

// Currently selected character (set from Home page)
export const selectedChar = writable(null);

// Check if key exists on app load
export async function checkKey() {
  try {
    const res = await fetch('/api/key');
    const data = await res.json();
    hasKey.set(data.hasKey);
    return data.hasKey;
  } catch (e) {
    console.error('Failed to check key:', e);
    return false;
  }
}
