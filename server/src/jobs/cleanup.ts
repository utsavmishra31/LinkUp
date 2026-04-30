import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Fix #4: Seen Profiles (rejects) table TTL cleanup ───────────────────────
// Problem: "rejects" table grows indefinitely. User who swiped left 2 months ago
// should be eligible to appear again (they may have updated their profile).
// 
// Solution: Delete rejects older than 30 days via a scheduled job.
// This runs once per day at midnight server time.
//
// Postgres equivalent (can also be run as pg_cron):
//   DELETE FROM rejects WHERE created_at < NOW() - INTERVAL '30 days';

export function startCleanupJobs() {
    // Run immediately on startup (catches any backlog)
    runRejectCleanup();

    // Then schedule daily at midnight (86400000ms = 24h)
    setInterval(runRejectCleanup, 86_400_000);
}

async function runRejectCleanup() {
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { error, count } = await supabase
            .from('rejects')
            .delete({ count: 'exact' })
            .lt('created_at', cutoff);

        if (error) {
            console.error('❌ Reject cleanup error:', error.message);
        } else {
            console.log(`🧹 Reject cleanup: removed ${count ?? 0} rows older than 30 days`);
        }
    } catch (err) {
        console.error('❌ Reject cleanup failed:', err);
    }
}
