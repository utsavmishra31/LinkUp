import { Router } from 'express';
import { getDiscoveryFeed, heartbeat } from '../controllers/discovery.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

// Protect the route
router.use(authenticateUser);

// GET /api/discovery
router.get('/', getDiscoveryFeed);

// POST /api/discovery/heartbeat — Fix #5: app pings every 30s to keep presence alive
// Prevents ghost-online users (app crash = key auto-expires in 60s)
router.post('/heartbeat', heartbeat);

export default router;
