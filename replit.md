# StreamVibe - Live Streaming Platform

## Overview

StreamVibe is a modern live streaming platform built with React, Express, and PostgreSQL. It features a token-based economy for viewer-creator interactions, role-based access control, and real-time streaming capabilities. The platform supports three user roles: viewers, creators, and admins, each with specific functionality and permissions.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Provider**: Replit Auth with OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions with 7-day TTL
- **Authorization**: Role-based access control (viewer, creator, admin)
- **User Management**: Automatic user creation/update on login

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