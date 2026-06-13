import { writable } from 'svelte/store';

// Read saved theme or default to 'light'
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('gw2-theme') : null;
const initial = saved === 'dark' ? 'dark' : 'light';

export const theme = writable(initial);

// Apply theme as .dark class on <html> (Tailwind darkMode: 'class')
theme.subscribe(value => {
  if (typeof document !== 'undefined') {
    const html = document.documentElement;
    if (value === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('gw2-theme', value);
  }
});
