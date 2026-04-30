import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { setupSocket } from './socket/chat';
import { startCleanupJobs } from './jobs/cleanup';

const PORT = process.env.PORT || 5000;

// Create HTTP server from Express app
const httpServer = http.createServer(app);

// Attach Socket.io to the HTTP server
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Setup socket handlers
setupSocket(io);

// Fix #4: Start background cleanup jobs (rejects TTL, etc.)
startCleanupJobs();

httpServer.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
    console.log(`🔌 Socket.io ready`);
    console.log(`🧹 Cleanup jobs scheduled`);
});
