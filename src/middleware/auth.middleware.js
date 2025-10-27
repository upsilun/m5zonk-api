const { db, admin } = require('../config/firebase');
const AppError = require('../utils/customError');
const logger = require('../utils/logger');

const firestore = admin.firestore;

/**
 * Middleware to validate the session token.
 * Attaches `req.auth` with { adminId, userId } if valid.
 */
const protect = async (req, res, next) => {
  try {
    // 1. Get token from header
    const token = req.headers['x-session-token'];

    if (!token) {
      return next(new AppError('No token provided. You are not authorized.', 401));
    }

    // 2. Find the session in Firestore
    const sessionQuery = await db
      .collection('sessions')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (sessionQuery.empty) {
      return next(new AppError('Invalid session token.', 401));
    }

    const sessionDoc = sessionQuery.docs[0];
    const sessionData = sessionDoc.data();

    // 3. Check if session is expired
    const now = firestore.Timestamp.now();
    if (sessionData.expiresAt.toMillis() < now.toMillis()) {
      logger.warn(`Expired token used for admin: ${sessionData.adminId}`);
      // We can also delete the expired session here
      // sessionDoc.ref.delete().catch(err => logger.error('Failed to delete expired session:', err));
      return next(new AppError('Session has expired. Please log in again.', 401));
    }

    // 4. Attach auth data to the request object for later use
    req.auth = {
      adminId: sessionData.adminId,
      userId: sessionData.userId,
      sessionId: sessionDoc.id,
    };

    // 5. Update 'lastSeenAt' (async, don't wait for it)
    sessionDoc.ref
      .update({ lastSeenAt: now })
      .catch((err) => logger.error(`Failed to update lastSeenAt for session ${sessionDoc.id}:`, err));

    // 6. Grant access
    next();
  } catch (error) {
    next(new AppError('Authentication failed.', 500));
  }
};

module.exports = { protect };