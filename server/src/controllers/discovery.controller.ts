import { Request, Response } from 'express';
import { supabase } from '../config/database';
import { redis } from '../utils/redis';

// ─── Fix #5: Presence TTL = 60s (not 5min) ───────────────────────────────────
// App sends a heartbeat every 30s. If app crashes, key auto-expires in 60s.
// This prevents "ghost online" users from showing as online indefinitely.
const PRESENCE_TTL_SEC = 60;

export const getDiscoveryFeed = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { limit = 20, cursor_last_active = null, cursor_id = null } = req.query;

        // Fix #5: Short-lived presence key (60s), refreshed by client heartbeat every 30s
        try {
            await redis.set(`user:${userId}:online`, Date.now().toString(), 'EX', PRESENCE_TTL_SEC);
        } catch (e) {
            supabase.rpc('update_last_active', { p_user_id: userId }).then();
        }

        const { data, error } = await supabase.rpc('get_discovery_users', {
            p_user_id: userId,
            p_limit: Number(limit),
            p_cursor_last_active: cursor_last_active,
            p_cursor_id: cursor_id
        });

        if (error) {
            console.error('DB Error:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        // Inject online status (lightweight Redis signal only)
        const processedData = await Promise.all(
            (data || []).map(async (row: any) => {
                try {
                    const onlineTs = await redis.get(`user:${row.profile_data?.id}:online`);
                    const isOnline = onlineTs && (Date.now() - parseInt(onlineTs)) < PRESENCE_TTL_SEC * 1000;
                    return { ...row, isOnline: !!isOnline };
                } catch {
                    return { ...row, isOnline: false };
                }
            })
        );

        res.json(processedData);
    } catch (error) {
        console.error('Discovery Feed Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ─── Fix #5: Heartbeat endpoint (called by app every 30s while open) ─────────
// Keeps the presence key alive without hitting Postgres at all
export const heartbeat = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        await redis.set(`user:${userId}:online`, Date.now().toString(), 'EX', PRESENCE_TTL_SEC);
        res.json({ ok: true });
    } catch (e) {
        // Redis down — silently ignore, user just won't appear online
        res.json({ ok: false });
    }
};

// ─── Helpers used by Socket.IO (connect / disconnect) ────────────────────────
export const setUserOnline = async (userId: string) => {
    try {
        await redis.set(`user:${userId}:online`, Date.now().toString(), 'EX', PRESENCE_TTL_SEC);
    } catch { }
};

export const setUserOffline = async (userId: string) => {
    try {
        await redis.del(`user:${userId}:online`);
    } catch { }
};
