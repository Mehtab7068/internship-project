const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { NotFoundError } = require('./utils/errors');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const competitionRoutes = require('./routes/competitionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const referralRoutes = require('./routes/referralRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', limiter);
  app.use(morgan('dev'));
}

// Raw-body capture for Razorpay webhook signature verification (must run
// before the global JSON parser so the exact signed bytes are preserved).
app.use('/api/payments/webhook', express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/reviews', reviewRoutes);

app.use((req, res, next) => {
  next(new NotFoundError(`Cannot find route ${req.originalUrl} on this server`));
});

app.use(errorHandler);

module.exports = app;
