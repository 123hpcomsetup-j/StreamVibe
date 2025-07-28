# StreamVibe Testing Guide

## Test Accounts

### Viewer Account
- **ID**: `test_viewer`
- **Email**: `viewer@test.com`
- **Role**: `viewer`
- **Wallet**: 100 tokens
- **Access**: Home page, stream viewing, chat, token purchases

### Creator Account
- **ID**: `test_creator` 
- **Email**: `creator@test.com`
- **Role**: `creator`
- **Wallet**: 500 tokens
- **Access**: Creator dashboard, stream management, earnings tracking

### Admin Account
- **ID**: `test_admin`
- **Email**: `admin@test.com`
- **Role**: `admin`
- **Wallet**: 1000 tokens
- **Access**: Admin panel, user management, content moderation

## How to Test Each Role

Since this uses Replit OAuth, you'll need to:
1. Log out from current session: `/api/logout`
2. Clear browser data/use incognito mode
3. Sign in with different Replit accounts
4. Manually update user role in database for testing

### Manual Role Switching
```sql
-- To test as viewer
UPDATE users SET role = 'viewer' WHERE id = '45438288';

-- To test as creator  
UPDATE users SET role = 'creator' WHERE id = '45438288';

-- To test as admin
UPDATE users SET role = 'admin' WHERE id = '45438288';
```

## Features Built & Testing Checklist

### ✅ Core Authentication
- [x] Replit OAuth integration
- [x] Role-based routing
- [x] Session management
- [x] User profile display

### ✅ Viewer Features
- [x] Landing page with StreamVibe branding
- [x] Home dashboard with live streams grid
- [x] Stream browsing by categories
- [x] Mock stream cards with viewer counts
- [x] Token wallet display
- [x] Token purchase modal with UPI integration
- [x] Stream modal with video player simulation
- [x] Live chat widget
- [x] Tipping functionality

### ✅ Creator Features  
- [x] Creator dashboard
- [x] Stream controls (start/stop streaming)
- [x] Stream settings (title, category, pricing)
- [x] Earnings tracking with charts
- [x] Payout request system
- [x] Stream analytics (mock data)
- [x] Wallet management

### ✅ Admin Features
- [x] Admin panel dashboard
- [x] User statistics overview
- [x] Content moderation tools
- [x] Creator approval system
- [x] Report management
- [x] Payout approval system
- [x] Token purchase approvals
- [x] System analytics

### ✅ UI/UX Components
- [x] Dark theme design
- [x] Responsive layout
- [x] Navigation with role-based links
- [x] Toast notifications
- [x] Loading states
- [x] Error handling
- [x] Modal dialogs
- [x] Form validations

### ⚠️ Limitations & Mock Data
- **Real-time streaming**: Uses mock video player, not actual WebRTC
- **Live chat**: Mock messages, not real-time WebSocket
- **Payment processing**: Mock UPI integration, no real payments
- **Stream analytics**: Mock data for demonstration
- **Email notifications**: Not implemented
- **File uploads**: Not implemented for stream thumbnails

### 🚀 Production Readiness
- **Database**: PostgreSQL with proper schema
- **Authentication**: Secure OAuth with sessions
- **Type Safety**: Full TypeScript coverage
- **Error Handling**: Comprehensive error states
- **Performance**: Optimized queries and caching
- **Security**: Input validation with Zod schemas

## Testing Workflow

1. **Test Viewer Flow**:
   - Browse streams on home page
   - Open stream modal and test chat
   - Purchase tokens via UPI flow
   - Send tips to creators

2. **Test Creator Flow**:
   - Access creator dashboard
   - Start/stop mock streams
   - View earnings and analytics
   - Request payouts
   - Manage stream settings

3. **Test Admin Flow**:
   - Access admin panel
   - Approve creator applications
   - Moderate reported content
   - Approve token purchases
   - Review system analytics

## Known Issues
- OAuth shows "StreamConnect" name (explained to users)
- Featured stream chat uses mock data to avoid DB constraints
- Some CSS opacity syntax needed browser compatibility fixes
- Need to manually set user roles for testing different flows