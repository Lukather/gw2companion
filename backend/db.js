const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'config.json');

let config = {};

function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      console.error('Failed to parse config file, starting fresh:', e.message);
      config = {};
    }
  } else {
    config = {};
    saveConfig();
  }
}

function saveConfig() {
  fs.writeFileSync(DB_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getApiKey() {
  return config.apiKey || null;
}

function setApiKey(key) {
  config.apiKey = key;
  saveConfig();
}

module.exports = { initDb, getApiKey, setApiKey };
