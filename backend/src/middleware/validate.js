const Joi = require('joi');

/**
 * Joi şeması ile request body doğrulama middleware'i.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({ error: 'Geçersiz veri', details: messages });
    }
    next();
  };
}

// ==================== ŞEMALAR ====================

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Geçerli bir email adresi giriniz',
    'any.required': 'Email gerekli',
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Şifre en az 6 karakter olmalı',
    'any.required': 'Şifre gerekli',
  }),
  fullName: Joi.string().min(2).max(100).required().messages({
    'any.required': 'İsim gerekli',
  }),
  gender: Joi.string().valid('female', 'male', 'other').optional(),
  birthYear: Joi.number().integer().min(1900).max(new Date().getFullYear()).optional(),
  city: Joi.string().max(100).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const outfitSuggestSchema = Joi.object({
  occasion: Joi.string().valid('gunluk', 'is', 'ozel', 'spor', 'gece').optional(),
  city: Joi.string().max(100).optional(),
});

const outfitFeedbackSchema = Joi.object({
  liked: Joi.boolean().optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
});

const eventSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  eventDate: Joi.string().isoDate().required(),
  occasion: Joi.string().required(),
  dressCode: Joi.string().max(200).optional(),
  notes: Joi.string().max(1000).optional(),
});

const profileUpdateSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional(),
  gender: Joi.string().valid('female', 'male', 'other').optional(),
  birth_year: Joi.number().integer().min(1900).max(new Date().getFullYear()).optional(),
  city: Joi.string().max(100).optional(),
  style_preferences: Joi.array().items(Joi.string()).optional(),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  outfitSuggestSchema,
  outfitFeedbackSchema,
  eventSchema,
  profileUpdateSchema,
};
