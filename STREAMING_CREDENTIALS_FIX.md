# Streaming Credentials Fix Required

## Current Status
- Environment still shows old App ID: `36411769f91e457a88f142921fbf5c93`
- Streaming will continue to fail until this is updated
- Certificate appears updated but App ID is critical

## Required Action

**Please follow these exact steps:**

1. **Open Replit Secrets Panel**
   - Click the lock icon (🔒) in the left sidebar
   - Or go to the "Secrets" tab in your project settings

2. **Update VITE_AGORA_APP_ID**
   - Find the `VITE_AGORA_APP_ID` entry
   - Click "Edit" or the pencil icon
   - Replace the current value with your correct Agora App ID
   - Click "Save"

3. **Verify the New Value**
   - The new App ID should NOT be `36411769f91e457a88f142921fbf5c93`
   - It should be your actual App ID from console.agora.io

4. **Restart the Repl**
   - Stop the current workflow
   - Start it again to load the new environment variables

## Once Fixed
The streaming will work immediately and you'll see:
- ✅ Creator can start streaming without authentication errors
- ✅ Viewers can join streams and see video
- ✅ Real-time chat and token system working
- ✅ All platform features fully functional

## Test Command
After fixing, this should return a token with your new App ID:
```bash
curl -X POST http://localhost:5000/api/agora/token \
  -H "Content-Type: application/json" \
  -d '{"channelName": "test", "uid": 12345, "role": "host"}'
```