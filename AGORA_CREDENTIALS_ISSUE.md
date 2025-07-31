# Agora Credentials Issue - Troubleshooting Guide

## Current Problem
The StreamVibe platform is experiencing streaming authentication failures due to outdated Agora credentials in the Replit environment.

### Error Details
- **Error**: `AgoraRTCError CAN_NOT_GET_GATEWAY_SERVER: invalid token, authorized failed`
- **Root Cause**: Environment variables still showing old App ID: `36411769f91e457a88f142921fbf5c93`
- **Impact**: All streaming attempts fail with authentication errors

### Current Environment Status
```
VITE_AGORA_APP_ID=36411769f91e457a88f142921fbf5c93 (OLD - NEEDS UPDATE)
AGORA_APP_CERTIFICATE=8eae2748977f41049650071d91eac819 (UPDATED)
```

### Attempted Solutions
1. ✅ Updated secrets through Replit Secrets panel
2. ✅ Restarted workflow multiple times
3. ✅ Forced bash restart
4. ❌ Environment variables not reflecting new App ID

### Recommended Solutions (in order of preference)

#### Option 1: Manual Repl Restart
1. Click the "Stop" button in Replit console
2. Wait 10 seconds
3. Click "Run" to restart the entire Repl
4. Check if new credentials load properly

#### Option 2: Verify Secrets Panel
1. Go to Replit Secrets (lock icon in sidebar)
2. Check if `VITE_AGORA_APP_ID` shows the new value
3. If still old, delete and re-add the secret
4. Restart the Repl completely

#### Option 3: Direct Environment Override
If secrets still not working, we can temporarily hardcode the correct credentials in the server code for testing.

### Testing Once Fixed
Run this command to verify:
```bash
curl -X POST http://localhost:5000/api/agora/token \
  -H "Content-Type: application/json" \
  -d '{"channelName": "test-new-creds", "uid": 12345, "role": "host"}'
```

Should return token with new App ID instead of `36411769f91e457a88f142921fbf5c93`.

### Next Steps
1. Fix the credential loading issue (try Option 1 first)
2. Test streaming functionality
3. Verify both creator and viewer connections work
4. Update documentation once resolved