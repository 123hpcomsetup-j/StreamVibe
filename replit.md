# StreamVibe - Live Streaming Platform

## Overview

StreamVibe is a modern live streaming platform built with React, Express, and PostgreSQL. It features a token-based economy for viewer-creator interactions, role-based access control, and real-time streaming capabilities. The platform supports three user roles: viewers, creators, and admins, each with specific functionality and permissions.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (January 28, 2025)

✓ Enhanced WebRTC live streaming implementation for providers
✓ Updated admin panel to focus on provider authorization and payment oversight
✓ Fixed user role assignment - updated test user to admin role for accessing admin panel
✓ Implemented comprehensive live stream controls with camera/microphone access
✓ **MAJOR**: Replaced Replit Auth with simple username/password authentication system
✓ Added username and password fields to users table with bcrypt password hashing
✓ Created new login/register page with role selection (viewer, creator, admin)
✓ Created separate admin login portal at `/admin` for enhanced security
✓ Generated three test accounts: creator, viewer, and admin with proper credentials
✓ Created 10 additional user accounts (9 offline, 1 online with active stream)
✓ Fixed "Go Live" functionality in creator dashboard with proper authentication
✓ Added online user status tracking and display on home page
✓ Fixed admin logout to redirect back to admin login page instead of main login
✓ Fixed admin panel routing - was pointing to wrong component causing 404 errors
✓ **NEW**: Created separate login portals for improved user experience:
  - `/creator-login` - Purple-themed portal for content creators
  - `/user-login` - Blue-themed portal for viewers
  - `/admin` - Red-themed portal for administrators
✓ Fixed video preview issues in live streaming - now shows immediately when camera access granted
✓ Added live chat functionality for viewer-creator interaction during streams
✓ **NEW**: Enhanced main page with comprehensive "Online Users" section showing all active users with:
  - User profile pictures and names
  - Role-based color coding (purple=creator, blue=viewer, red=admin)
  - Real-time online status indicators
  - Responsive grid layout for different screen sizes
✓ **NEW**: Created comprehensive public home page (`/`) separate from user dashboards:
  - Shows live streams and online creators
  - Hero section with platform statistics
  - Call-to-action buttons for different user types
  - Portal selector as secondary sign-in option at `/login`
✓ Generated 9 complete test accounts (3 per role) with proper credentials displayed on login pages
✓ Updated routing structure: public home at `/`, authenticated dashboards at role-specific routes
✓ **NEW**: Implemented complete guest viewing system with 5-minute time limits and 100 free chat tokens:
  - Guest sessions automatically created when clicking "Watch Stream"
  - Real-time countdown timer with automatic redirect to signup
  - Guest chat functionality with token deduction
  - Creator-configurable token pricing in dashboard settings
  - Seamless integration with public home page stream listings
✓ **MAJOR**: Removed all demo/placeholder content and implemented real WebRTC live streaming:
  - Creators now access actual camera/microphone when clicking "Go Live"
  - Real-time video streaming using WebRTC peer-to-peer connections
  - Viewers (both guests and authenticated users) receive actual live camera feeds
  - Removed all placeholder videos, poster images, and demo content from all pages
  - Removed hardcoded Unsplash demo images from home page stream cards
  - Removed mock statistics and external avatar generation services
  - Live streaming displays actual camera preview for creators
  - WebSocket signaling server handles peer connections and ICE candidates
  - STUN servers configured for NAT traversal in real network conditions
  - Home page now shows only authentic data without demo content
✓ **NEW**: Implemented real-time stream status updates using WebSockets (January 28, 2025):
  - Added updateStreamStatus method to storage interface for database stream status management
  - Enhanced WebSocket server with real-time stream status synchronization across all clients
  - Updated public home page to use WebSocket connections for instant stream status updates
  - Added proper offline stream handling in guest view with "Stream Ended" messages
  - Live streams API now filters only truly live streams for accurate real-time display
  - WebSocket events notify all users when streams go live or offline immediately
  - Database stream status persists and syncs with real-time WebSocket updates
  - Guest viewers see real-time status changes without page refresh
✓ **NEW**: Enhanced chat system with proper user identification (January 28, 2025):
  - Auto-generated guest names (Guest_ABC123 format) for multiple guest users in same stream
  - Authenticated users display their real profile names from user accounts
  - Fixed database constraints - guest messages use guestSessionId instead of fake userId
  - Removed manual name input UI since guest names are automatically generated
  - Backend automatically provides correct sender names for both guest and authenticated users
✓ **NEW**: Enhanced creator login system with signup and password reset (January 28, 2025):
  - Added "Create Creator Account" signup button with comprehensive registration form
  - Implemented "Forgot Password?" functionality for password reset
  - Fixed test creator account authentication with proper bcrypt password hashing
  - Added backend endpoints for user registration and password reset functionality
  - Working test accounts: bob_gamer, charlie_art, diana_music (all with password123)
✓ **NEW**: Redesigned creator dashboard with simplified navigation (January 29, 2025):
  - Created custom navbar specifically for creators with only "Go Live" and "Request Payout" buttons
  - Removed duplicate stream controls that were confusing the interface
  - Fixed stream status detection - cleared old "live" streams from database
  - Streamlined layout with real-time status updates and authentic analytics
  - WebRTC controls only appear when actually streaming
✓ **FIXED**: Live streams now visible to guest users (January 29, 2025):
  - Fixed stream creation to properly mark streams as `isLive: true`
  - Guest users can now see live streams on the public home page
  - WebSocket notifications properly update all connected clients when streams go live
  - Real-time synchronization between creator dashboard and public home page
✓ **NEW**: Unified stream viewing system for all user types (January 29, 2025):
  - Created single stream-view.tsx component replacing guest-stream.tsx
  - Guest users get auto-generated names (Guest_ABC123 format)
  - Newly signed-up users see their chosen username in chat
  - Existing authenticated users see their usernames
  - All user types can watch streams and participate in chat
  - Seamless upgrade path: guests can sign up without losing stream access

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom dark theme
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Session Management**: express-session with PostgreSQL store
- **Authentication**: Replit Auth integration with OpenID Connect
- **Database ORM**: Drizzle ORM with PostgreSQL

### Database Design
- **Primary Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit for migrations
- **Key Tables**: users, streams, transactions, token_purchases, reports, payouts, chat_messages, sessions

## Key Components

### Authentication System
- **Provider**: Simple username/password authentication with bcrypt
- **Session Storage**: Express sessions with 7-day TTL
- **Authorization**: Role-based access control (viewer, creator, admin)
- **User Management**: Registration form with role selection
- **Security**: Bcrypt password hashing, session-based authentication

### Streaming Platform
- **Live Streams**: Real-time streaming with viewer count tracking
- **Stream Categories**: Art & Design, Gaming, Music, etc.
- **Creator Dashboard**: Stream management, earnings tracking, settings
- **Admin Panel**: Content moderation, user management, system oversight

### Token Economy
- **Virtual Currency**: Token-based tipping system
- **Purchase Flow**: UPI-based token purchases with admin approval
- **Transactions**: Peer-to-peer token transfers between users
- **Earnings**: Creator earnings tracking and payout management

### Real-time Features
- **Chat System**: Live chat during streams with tip integration
- **Stream Status**: Real-time stream status updates
- **Notifications**: Toast-based user feedback system

## Data Flow

### User Authentication Flow
1. User accesses protected route
2. Middleware checks session validity
3. Redirects to Replit Auth if unauthenticated
4. OAuth callback creates/updates user record
5. Session established with role-based permissions

### Streaming Workflow
1. Creator starts stream from dashboard
2. Stream metadata stored in database
3. Live status updated for discovery
4. Viewers join stream and participate in chat
5. Tips processed through token system
6. Earnings tracked for creator payouts

### Token Transaction Flow
1. User initiates token purchase with UPI
2. Purchase request stored as pending
3. Admin reviews and approves/rejects
4. Tokens credited to user wallet
5. Users can tip creators during streams
6. Transactions recorded for audit trail

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI components
- **express-session**: Session management
- **openid-client**: OAuth authentication

### Development Tools
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety across the stack
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Production bundling

### Replit Integration
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tooling

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite dev server with HMR
- **Database**: Neon PostgreSQL with connection pooling
- **Session Store**: PostgreSQL sessions table
- **Environment Variables**: DATABASE_URL, SESSION_SECRET, REPLIT_DOMAINS

### Production Build
- **Frontend**: Static assets built with Vite to `dist/public`
- **Backend**: Node.js server bundled with ESBuild
- **Database Migrations**: Drizzle Kit push command
- **Process Management**: Single Node.js process serving both API and static files

### Architecture Decisions

#### Monorepo Structure
- **Problem**: Shared types and utilities between frontend and backend
- **Solution**: Monorepo with shared folder for common code
- **Benefits**: Type safety across the stack, reduced duplication
- **Trade-offs**: Slightly more complex build process

#### Token-Based Economy
- **Problem**: Monetization and creator-viewer interaction
- **Solution**: Virtual token system with real money backing
- **Benefits**: Controlled economy, easy tip tracking, admin oversight
- **Trade-offs**: Requires payment integration and admin approval workflow

#### Role-Based Access Control
- **Problem**: Different user types need different permissions
- **Solution**: Enum-based roles with middleware protection
- **Benefits**: Clear separation of concerns, scalable permission system
- **Trade-offs**: More complex routing and UI logic

#### Replit Auth Integration
- **Problem**: User authentication and management
- **Solution**: Leverage Replit's OAuth system
- **Benefits**: Seamless integration, no custom auth needed
- **Trade-offs**: Platform dependency, limited customization

## Testing & User Management

### Test Account Setup
- Created dedicated test users for each role type
- Manual role switching via SQL for testing different flows
- Comprehensive testing documentation in TESTING.md
- Role switching guide in ROLE_SWITCHER.md

### Authentication Limitations
- OAuth shows "StreamConnect" name (Replit's registered app name)
- Cannot create traditional username/password accounts
- Testing requires manual database role updates
- Single OAuth identity used for role testing