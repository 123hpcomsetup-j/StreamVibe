# Quick Role Switching for Testing

Since StreamVibe uses Replit OAuth, you can't create traditional username/password accounts. Instead, use these SQL commands to switch your current user's role for testing:

## Switch to Viewer Role
```sql
UPDATE users SET role = 'viewer' WHERE id = '45438288';
```

## Switch to Creator Role  
```sql
UPDATE users SET role = 'creator' WHERE id = '45438288';
```

## Switch to Admin Role
```sql
UPDATE users SET role = 'admin' WHERE id = '45438288';
```

## After Role Change:
1. Refresh the page or navigate to `/`
2. Check the badge in top-right corner shows your new role
3. Look for role-specific navigation links

## Test Routes by Role:

### Viewer Access:
- `/` - Home page with live streams
- Stream modals with chat and tipping

### Creator Access: 
- `/` - Home page
- `/creator-dashboard` - Stream management and earnings

### Admin Access:
- `/` - Home page  
- `/admin-panel` - Full admin controls

## Quick Test Script:
Run this in the browser console to check current user role:
```javascript
fetch('/api/auth/user')
  .then(r => r.json())
  .then(user => console.log('Current role:', user.role))
```