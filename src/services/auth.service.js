const { db, admin } = require('../config/firebase');
const crypto = require('crypto');
const AppError = require('../utils/customError');

const firestore = admin.firestore;

class AuthService {
  /**
   * Creates a new admin, owner user, default warehouse, and settings.
   */
  async signup(email, password, businessName) {
    // 1. Check if user email already exists in /users
    const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!userQuery.empty) {
      throw new AppError('An account with this email already exists.', 409); // 409 Conflict
    }

    const now = firestore.FieldValue.serverTimestamp();

    // 2. Create all documents in a single transaction
    try {
      let adminId;
      let defaultWarehouseId;

      await db.runTransaction(async (transaction) => {
        // --- Create Admin ---
        const adminRef = db.collection('admins').doc();
        adminId = adminRef.id;
        transaction.set(adminRef, {
          email,
          businessName,
          password, // Storing plain text as requested for MVP
          createdAt: now,
        });

        // --- Create User (Owner) ---
        const userRef = db.collection('users').doc();
        transaction.set(userRef, {
          adminId: adminId,
          email,
          password, // Storing plain text as requested for MVP
          role: 'owner',
          createdAt: now,
          loginCount: 0,
          lastLoginAt: null,
        });

        // --- Create Default Warehouse ---
        const warehouseRef = db.collection('admins').doc(adminId).collection('warehouses').doc();
        defaultWarehouseId = warehouseRef.id;
        transaction.set(warehouseRef, {
          name: 'Default',
          active: true,
          createdAt: now,
        });

        // --- Create Admin Settings ---
        const settingsRef = db.collection('admins').doc(adminId).collection('adminSettings').doc('config');
        transaction.set(settingsRef, {
          maxProducts: 5000,
          maxOrders: 50000,
          maxWarehouses: 5,
          currency: 'SAR',
          defaultWarehouseId: defaultWarehouseId, // Link to the new warehouse
          idPolicy: {
            defaultProductIdLen: 4,
            productIdMinLen: 4,
            orderIdMinLen: 4,
          },
        });

        // --- Seed Packaging Presets ---
        const presets = [
          { name: 'Small Package', price: 2 },
          { name: 'Medium Package', price: 5 },
          { name: 'Large Package', price: 10 },
        ];
        presets.forEach((preset) => {
          const presetRef = db.collection('admins').doc(adminId).collection('packagingPresets').doc();
          transaction.set(presetRef, { ...preset, active: true });
        });
      });

      return { adminId, message: 'Signup successful.' };
    } catch (error) {
      console.error('Signup Transaction Error:', error);
      throw new AppError('Signup failed. Please try again.', 500);
    }
  }

  /**
   * Logs in a user and creates a long-lived session.
   */
  async login(email, password, ip, country) {
    // 1. Find user by email
    const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userQuery.empty) {
      throw new AppError('Invalid email or password.', 401); // 401 Unauthorized
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // 2. Check password (plain text check for MVP)
    if (userData.password !== password) {
      throw new AppError('Invalid email or password.', 401); // 401 Unauthorized
    }

    const now = new Date();
    const createdAt = firestore.Timestamp.fromDate(now);

    // 3. Create Session (5 months expiry)
    const expiresAtDate = new Date(now.setMonth(now.getMonth() + 5));
    const expiresAt = firestore.Timestamp.fromDate(expiresAtDate);

    // Purge 7 days after expiry
    const purgeAfterDate = new Date(expiresAtDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const purgeAfter = firestore.Timestamp.fromDate(purgeAfterDate);

    const token = crypto.randomBytes(32).toString('hex'); // 64-char string

    const sessionRef = db.collection('sessions').doc();
    await sessionRef.set({
      userId: userDoc.id,
      adminId: userData.adminId,
      token,
      createdAt,
      expiresAt,
      purgeAfter,
      lastSeenAt: createdAt,
    });

    // 4. Update user's login stats (don't wait for this)
    const userUpdateData = {
      loginCount: firestore.FieldValue.increment(1),
      lastLoginAt: createdAt,
      lastLoginIP: ip || null,
      lastLoginCountry: country || null,
    };
    userDoc.ref.update(userUpdateData).catch(err => console.error("Failed to update user login stats:", err));

    // 5. Return session info
    return {
      token,
      adminId: userData.adminId,
      userId: userDoc.id,
      role: userData.role,
      expiresAt: expiresAtDate.toISOString(),
    };
  }

  // --- NEW FUNCTION ---
  /**
   * Deletes a session document from Firestore.
   * @param {string} sessionId The document ID of the session to delete.
   */
  async logout(sessionId) {
    if (!sessionId) {
      throw new AppError('Invalid session ID.', 400);
    }
    
    try {
      const sessionRef = db.collection('sessions').doc(sessionId);
      await sessionRef.delete();
      return { message: 'Session deleted.' };
    } catch (error) {
      console.error('Logout error:', error);
      throw new AppError('Failed to logout.', 500);
    }
  }
  // --- END NEW FUNCTION ---
}

module.exports = new AuthService();