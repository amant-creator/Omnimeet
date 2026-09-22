/**
 * Health check endpoint.
 * Used by the self-ping mechanism in server.js to keep the
 * Render free-tier service alive (prevents spin-down after 15 min idle).
 *
 * Also useful for uptime monitoring services (UptimeRobot, BetterStack, etc.)
 */
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
