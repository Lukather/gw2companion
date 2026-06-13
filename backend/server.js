const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const keyRoutes = require('./routes/key');
const charactersRoutes = require('./routes/characters');
const inventoryRoutes = require('./routes/inventory');
const analyzeRoutes = require('./routes/analyze');
const debugRoutes = require('./routes/debug');
const materialsRoutes = require('./routes/materials');
const achievementsRoutes = require('./routes/achievements');
const storyRoutes = require('./routes/story');
const buildsRoutes = require('./routes/builds');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow all origins for local use
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// API routes
app.use('/api', keyRoutes);
app.use('/api', charactersRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', analyzeRoutes);
app.use('/api', debugRoutes);
app.use('/api', materialsRoutes);
app.use('/api', achievementsRoutes);
app.use('/api', storyRoutes);
app.use('/api', buildsRoutes);

// Serve frontend static files in production
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  // Don't catch API routes
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Global error handler for uncaught exceptions in routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize DB and start server
initDb();

app.listen(PORT, () => {
  console.log(`GW2 Companion server running at http://localhost:${PORT}`);
  console.log(`API endpoints: http://localhost:${PORT}/api/`);
});
