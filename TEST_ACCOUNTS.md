# StreamVibe Test Accounts

## Test Account Credentials

### Creator Account (for streaming)
- **Username:** `creator`
- **Password:** `creator123`
- **Email:** creator@streamvibe.com
- **Role:** Creator
- **Access:** Can create and manage live streams, view earnings, access creator dashboard
- **Wallet Balance:** 100 tokens

### Viewer Account (for watching)
- **Username:** `viewer`
- **Password:** `viewer123`
- **Email:** viewer@streamvibe.com
- **Role:** Viewer
- **Access:** Can watch streams, tip creators, purchase tokens
- **Wallet Balance:** 50 tokens

### Admin Account (for management)
- **Username:** `admin`
- **Password:** `admin123`
- **Email:** admin@streamvibe.com
- **Role:** Admin
- **Access:** Full admin panel access, can approve creators, manage payments, moderate content

## Login Pages

### Regular Users (Creator & Viewer)
- **URL:** `/` or `/login`
- **Features:** Login and registration forms with role selection (creator/viewer only)
- **Admin Access Link:** Bottom of the page

### Admin Users
- **URL:** `/admin`
- **Features:** Dedicated admin login page with enhanced security styling
- **Restrictions:** Only accepts admin role users
- **Redirect:** Successful admin login goes directly to `/admin-panel`

## Authentication Flow

1. **Creators and Viewers** use the main login page
2. **Admins** use the separate admin portal at `/admin`
3. Registration is limited to creator and viewer roles only
4. Admin accounts must be created manually by existing admins

## Security Features

- **Password Hashing:** bcrypt with 10 salt rounds
- **Session Management:** Express sessions with 7-day TTL
- **Role-based Access:** Middleware checks user roles for protected routes
- **Separate Admin Portal:** Enhanced security for administrative access