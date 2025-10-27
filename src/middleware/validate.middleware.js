const AppError = require('../utils/customError');

/**
 * Joi validation middleware
 * @param {import('joi').Schema} schema - The Joi schema
 * @param {'body' | 'query' | 'params'} [source='body'] - The request source to validate
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error } = schema.validate(req[source]); // Validate req.body or req.query

  if (error) {
    const errorMessage = error.details.map((detail) => detail.message).join(', ');
    return next(new AppError(errorMessage, 400));
  }

  return next();
};

module.exports = validate;