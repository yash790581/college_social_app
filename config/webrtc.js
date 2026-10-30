/**
 * WebRTC Configuration Helper
 * Safely parses ICE Server configuration from environment variables.
 * Falls back to public STUN servers if TURN or custom servers are not defined.
 */

function getIceServers() {
  const envIce = process.env.ICE_SERVERS;
  if (envIce) {
    try {
      const parsed = JSON.parse(envIce);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('⚠️ Warning: Failed to parse ICE_SERVERS environment variable as JSON. Falling back to public STUN servers.');
    }
  }

  // Safe default: Google public STUN servers for NAT discovery.
  // Note: STUN handles NAT discovery. Symmetric NAT or strict campus/cellular firewalls
  // will require a TURN relay server configured via process.env.ICE_SERVERS.
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
}

module.exports = {
  getIceServers
};
