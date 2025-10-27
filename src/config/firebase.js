const admin = require('firebase-admin');
const path = require('path'); // <-- 1. Import the 'path' module

// Get the relative path from the environment variable
const relativePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!relativePath) {
  console.error(
    'Error: FIREBASE_SERVICE_ACCOUNT_PATH is not set in .env file.'
  );
  console.error('Please check your .env file in the project root.');
  process.exit(1);
}

// --- THIS IS THE FIX ---
// Create an absolute path from the project root (process.cwd())
// This joins "K:\ProgrammingProjects\WebProjects\m5zonk" + "./serviceAccountKey.json"
const serviceAccountPath = path.resolve(process.cwd(), relativePath);
// --- END FIX ---

// Use a try-catch block for better error handling
try {
  // 2. Use the new absolute 'serviceAccountPath' variable
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();
  console.log('Firebase Admin SDK initialized. Firestore is ready.');

  module.exports = { admin, db };

} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error(`Error: Cannot find service account file at path: ${serviceAccountPath}`);
    console.error('Please make sure your .env file points to the correct location and the file exists.');
  } else {
    console.error('Error loading serviceAccountKey.json:', error.message);
  }
  process.exit(1);
}