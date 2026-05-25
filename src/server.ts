import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { setupSocket } from './config/socket';

async function startServer() {
  // 1. Establish Database Connection
  await connectDB();

  // 2. Create HTTP Server
  const server = http.createServer(app);

  // 3. Initialize Socket.io Server
  setupSocket(server);

  // Initialize due-date checker background scheduler (checks every 5 minutes)
  const { taskService } = require('./services/task.service');
  setTimeout(async () => {
    try {
      await taskService.checkDueDates();
    } catch (err: any) {
      console.error('[Scheduler] Error checking due dates on startup:', err.message);
    }
  }, 5000); // Wait 5 seconds after startup to trigger initial scan

  setInterval(async () => {
    try {
      await taskService.checkDueDates();
    } catch (err: any) {
      console.error('[Scheduler] Error checking due dates:', err.message);
    }
  }, 5 * 60 * 1000);

  // 4. Start listening
  const PORT = env.port;
  server.listen(PORT, () => {
    console.log(`
============================================================
[Server] Starting in "${env.nodeEnv}" mode
[Server] Listening on http://localhost:${PORT}
[Server] Socket.io active on ws://localhost:${PORT}
============================================================
    `);
  });

  // Handle unhandled promise rejections gracefully
  process.on('unhandledRejection', (err: Error) => {
    console.error('[CRITICAL] Unhandled Rejection:', err.message);
    // Keep server running but log error
  });

  process.on('uncaughtException', (err: Error) => {
    console.error('[CRITICAL] Uncaught Exception:', err.message);
    process.exit(1);
  });
}

startServer();
