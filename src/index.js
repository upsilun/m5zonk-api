require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mainRouter = require('./routes'); // Will import from ./routes/index.js

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin (just to ensure it's loaded)
require('./config/firebase');

// --- Global Middlewares ---
// Enable Cross-Origin Resource Sharing
app.use(cors());
// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// --- Main API Router ---
// All routes will be prefixed with /api
app.use('/api', mainRouter);

// --- Basic Error Handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something went wrong!', message: err.message });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`M5zonk API listening on http://localhost:${PORT}`);
});