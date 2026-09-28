const app = require('./app');
const connectDB = require('./config/db');
const { startRegistrationExpiryJob } = require('./jobs/registrationExpiryJob');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    if (process.env.NODE_ENV !== 'test') {
      startRegistrationExpiryJob();
    }
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Feedants API Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
