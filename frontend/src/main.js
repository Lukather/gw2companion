import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';

const target = document.getElementById('app');

let app;
try {
  app = mount(App, { target });
} catch (err) {
  if (target) {
    target.innerHTML = `<div style="padding:2rem;color:red;font-family:monospace;"><h2>App failed to mount</h2><pre>${err.message}\n${err.stack}</pre></div>`;
  }
}

export default app;
