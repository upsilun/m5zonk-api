const authService = require('../services/auth.service');
const logger = require('../utils/logger');

// A helper function to handle async errors
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class AuthController {
  signup = catchAsync(async (req, res) => {
    const { email, password, businessName } = req.body;
    logger.info(`Signup attempt for email: ${email}`);

    const result = await authService.signup(email, password, businessName);

    logger.info(`Signup successful for admin: ${result.adminId}`);
    res.status(201).json({
      message: 'Admin account created successfully.',
      adminId: result.adminId,
    });
  });

  login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    
    const ip = req.ip; 
    const country = req.headers['x-country-code']; // Example header

    logger.info(`Login attempt for email: ${email}`);

    const sessionData = await authService.login(email, password, ip, country);

    logger.info(`Login successful for user: ${sessionData.userId}`);
    res.status(200).json({
      message: 'Login successful.',
      ...sessionData,
    });
  });

  // --- THIS FUNCTION IS UPDATED ---
  logout = catchAsync(async (req, res) => {
    // The 'protect' middleware adds req.auth.sessionId
    const sessionId = req.auth.sessionId;
    
    logger.info(`Logout request for session: ${sessionId}`);
    await authService.logout(sessionId);
    
    // Respond with 200 OK and a success message
    res.status(200).json({ message: 'Logged out successfully.' }); 
  });
  // --- END UPDATE ---
}

module.exports = new AuthController();