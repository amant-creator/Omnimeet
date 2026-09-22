// Deprecated: Socket.io is now hosted directly via server.js on the root HTTP server.
export default function handler(req, res) {
  res.status(200).json({ status: 'Socket.io is managed via server.js' });
}
