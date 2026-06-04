# Project Architecture & Database Schema Guide

This guide provides an overview of the Enterprise Project Management System's architecture, file structure, database schema, and key request flows. Use it to navigate the codebase and understand how the frontend and backend interact.

---

## 📂 Monorepo File Map

The codebase is organized as a monorepo containing a NestJS backend and a Next.js frontend:

```yaml
root/
├── backend/                             # NestJS Backend Application
│   ├── prisma/
│   │   ├── schema.prisma                # Database Models & Schema Definition
│   │   └── seed.ts                      # Seeding Script (Admin, Roles, Permissions)
│   ├── src/
│   │   ├── app.module.ts                # Main App Module (registers guards and sub-modules)
│   │   ├── auth/                        # JWT Auth, Strategy, Decorators & Guards
│   │   │   ├── decorators/              # Custom Decorators (@TenantId, @Permissions, etc.)
│   │   │   ├── guards/                  # AccessTokenGuard, RefreshTokenGuard, PermissionsGuard
│   │   │   ├── strategies/              # Passport JWT Access/Refresh Strategies
│   │   │   ├── auth.controller.ts       # Registration, Login, Token Refresh, Invite Acceptance
│   │   │   └── auth.service.ts          # Authentication logic & JWT Generation
│   │   ├── organization/                # Member Management, Settings, and Audit Logs
│   │   ├── invitation/                  # Member invitation generation and token hashing
│   │   ├── audit/                       # Global Immutable Audit Logging Service
│   │   └── prisma/                      # Prisma Client Service configuration
│   └── package.json
│
└── frontend/                            # Next.js Frontend Application
    ├── app/                             # App Router Pages
    │   ├── (auth)/                      # Public Authentication routes
    │   │   ├── login/page.tsx           # Login Screen
    │   │   ├── register/page.tsx        # Registration (New Org Creation) Screen
    │   │   └── accept-invite/page.tsx   # Invitation Onboarding Screen
    │   ├── (dashboard)/                 # Protected Dashboard routes
    │   │   ├── dashboard/page.tsx       # Core User Dashboard
    │   │   └── settings/page.tsx        # Admin Settings & Member Management Panel
    │   └── layout.tsx                   # Main Root Layout & Providers Wrapper
    ├── hooks/
    │   └── useAuth.ts                   # Custom Hook (user session, login, register, acceptInvite)
    ├── services/
    │   └── api.ts                       # Axios Client (with Auth interceptor and Silent Refresh)
    └── package.json
```

---

## 🗄️ Database Entity Relationship Diagram (ERD)

This diagram visualizes the relational schema defined in [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/schema.prisma). It highlights the separation between multi-tenant organization constraints and the Role-Based Access Control (RBAC) tables:

```mermaid
erDiagram
    %% Multi-Tenant Models
    ORGANIZATION ||--o| ORGANIZATION_SETTINGS : "has settings"
    ORGANIZATION ||--o{ USER : "owns users"
    ORGANIZATION ||--o{ ORGANIZATION_MEMBER : "has members"
    ORGANIZATION ||--o{ INVITATION : "has invitations"
    ORGANIZATION ||--o{ AUDIT_LOG : "records logs"

    USER ||--o{ ORGANIZATION_MEMBER : "has membership"
    USER ||--o{ INVITATION : "invited by user"
    USER ||--o{ AUDIT_LOG : "executes action"
    USER ||--o{ USER_ROLE : "has roles"

    %% RBAC Models
    ROLE ||--o{ USER_ROLE : "assigned to users"
    ROLE ||--o{ ROLE_PERMISSION : "contains permissions"
    ROLE ||--o{ INVITATION : "pre-assigned to invitations"
    PERMISSION ||--o{ ROLE_PERMISSION : "granted to roles"

    ORGANIZATION {
        String id PK
        String name
        String description
        String logoUrl
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    ORGANIZATION_SETTINGS {
        String id PK
        String organizationId FK
        String theme
        String allowedEmailDomains
        String timezone
        String dateFormat
        String language
        String currency
    }

    USER {
        String id PK
        String email
        String passwordHash
        String firstName
        String lastName
        String hashedRt
        Boolean isActive
        String organizationId FK
        DateTime createdAt
        DateTime deletedAt
    }

    ORGANIZATION_MEMBER {
        String id PK
        String organizationId FK
        String userId FK
        String status "ACTIVE, SUSPENDED, INVITED"
        DateTime joinedAt
        DateTime deletedAt
    }

    INVITATION {
        String id PK
        String email
        String organizationId FK
        String roleId FK
        String tokenHash "SHA-256 Hash"
        String invitedBy FK
        String status "PENDING, ACCEPTED, EXPIRED, REVOKED"
        DateTime expiresAt
        DateTime acceptedAt
        DateTime deletedAt
    }

    AUDIT_LOG {
        String id PK
        String organizationId FK
        String userId FK
        String entityType
        String entityId
        String action
        String oldValue "JSON String"
        String newValue "JSON String"
        DateTime createdAt
    }

    ROLE {
        String id PK
        String name "Admin, Project Manager, Member"
        String description
    }

    PERMISSION {
        String id PK
        String name "MANAGE_USERS, CREATE_PROJECT, etc."
        String description
    }

    USER_ROLE {
        String userId PK, FK
        String roleId PK, FK
    }

    ROLE_PERMISSION {
        String roleId PK, FK
        String permissionId PK, FK
    }
```

---

## 🔑 Authentication & Request Flow

This diagram illustrates how a user logs in, receives a token containing organization context, and makes a tenant-isolated request to the API:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant API as Axios Service (api.ts)
    participant Auth as Auth Controller/Service
    participant Guard as AccessTokenGuard & PermissionsGuard
    participant DB as SQLite (Prisma)

    %% Login Sequence
    Note over User, DB: 1. Authentication (Login) Sequence
    User->>API: Enter credentials & Submit
    API->>Auth: POST /auth/login { email, password }
    Auth->>DB: Query User (check email, active status, deletedAt = null)
    DB-->>Auth: User Record
    Auth->>Auth: Verify password hash (Argon2)
    Auth->>DB: Query User's RBAC roles & permissions
    DB-->>Auth: Role & Permission list
    Auth->>Auth: Generate JWT (Sign with organizationId, sub, roles, permissions)
    Auth->>DB: Save hashed Refresh Token (hashedRt)
    Auth-->>API: Response { access_token, refresh_token }
    API->>User: Set Tokens in localStorage, redirect to Dashboard

    %% Isolated Request Sequence
    Note over User, DB: 2. Tenant-Isolated Request Sequence
    User->>API: Navigate to Settings (Requests data)
    API->>API: Add Header: Authorization Bearer (access_token)
    API->>Guard: GET /organization/settings
    Note over Guard: AccessTokenGuard validates token signature
    Note over Guard: PermissionsGuard validates user.permissions includes 'MANAGE_USERS'
    Guard->>Auth: Pass request user payload (includes organizationId)
    Auth->>DB: Query Settings where organizationId = payload.organizationId
    DB-->>Auth: Tenant Settings
    Auth-->>API: Return Settings JSON
    API-->>User: Render Dashboard settings page
```

---

## ✉️ Onboarding Invitation Flow

How an administrator invites a new team member, and how that member accepts the invitation:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin (Browser)
    participant API as Backend (NestJS)
    participant DB as SQLite (Prisma)
    actor Invitee as Invitee (Browser)

    %% Invitation Creation
    Note over Admin, DB: Phase A: Admin Invites New Member
    Admin->>API: POST /invitations { email, roleId }
    Note over API: Verify Admin holds 'INVITE_MEMBERS' permission
    Note over API: Check if email is already registered
    API->>API: Generate random token: crypto.randomBytes(32)
    API->>API: Compute SHA-256 Hash of raw token
    API->>DB: Save Invitation (store email, roleId, organizationId, tokenHash)
    API->>API: Print raw token in terminal console
    API-->>Admin: Return { rawToken, email, expiresAt }
    Note over Admin: Admin shares register link with rawToken

    %% Invitation Acceptance
    Note over Invitee, DB: Phase B: Invitee Accepts Invitation
    Invitee->>Invitee: Navigate to /accept-invite?token=rawToken
    Invitee->>API: POST /auth/accept-invite { token, password, firstName, lastName }
    API->>API: Compute SHA-256 Hash of incoming token
    API->>DB: Query Invitation where tokenHash = input & status = PENDING & active
    DB-->>API: Invitation details (email, organizationId, roleId)
    
    rect rgb(15, 23, 42)
        Note over API, DB: Transaction Block
        API->>DB: Create User (linked to organizationId, hashed password)
        API->>DB: Create OrganizationMember (status: ACTIVE)
        API->>DB: Create UserRole (assign roleId)
        API->>DB: Update Invitation (status: ACCEPTED, acceptedAt: now)
    end

    API->>API: Sign Access/Refresh Tokens (with organizationId)
    API-->>Invitee: Return { access_token, refresh_token }
    Invitee->>Invitee: Logged in and redirected to Dashboard
```
