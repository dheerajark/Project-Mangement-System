# Enterprise Project Management System (EPMS)

> A modern, full-stack, enterprise-grade project management application inspired by Zoho Projects and OpenProject. Designed for teams to track projects, milestones, tasks, issues, and billable hours in real-time.

---

## 🚀 Quick Start for Demo

Both backend and frontend servers can be started easily for live demonstration and testing.

### 🔑 Demo Login Credentials

The development database comes pre-seeded with sample users, projects, tasks, milestones, and time logs.

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@example.com` | `password123` | Full admin privileges & Organization Settings access |
| **Project Manager** | `pm@example.com` | `password123` | Project & member management, task & time approval |
| **Developer / Member** | `member@example.com` | `password123` | Task execution, issue tracking, logging hours |
| **Client** | `client@example.com` | `password123` | Read-only view of project progress and milestones |

---

## ⚡ Server Execution & Endpoints

| Service | Access URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [`http://localhost:3001`](http://localhost:3001) | Next.js 16 interactive dashboard |
| **Backend REST API** | [`http://localhost:3000`](http://localhost:3000) | NestJS 11 core application API |
| **Swagger API Docs** | [`http://localhost:3000/api/docs`](http://localhost:3000/api/docs) | Interactive OpenAPI spec & endpoint sandbox |
| **Real-time Gateway** | `ws://localhost:3000` | Socket.IO WebSocket notification server |

---

## 🛠️ Technology Stack Breakdown

This application is built with a modern, scalable, type-safe stack:

### 1. Backend Architecture (`/backend`)
* **Framework**: [NestJS 11](https://nestjs.com/) — Progressive Node.js framework for scalable server-side applications.
* **Language**: [TypeScript 5](https://www.typescriptlang.org/) — Strongly typed JavaScript.
* **Database & ORM**: [Prisma ORM 7](https://www.prisma.io/) with [SQLite](https://www.sqlite.org/) via `@prisma/adapter-better-sqlite3` and `@libsql/client`.
* **Security & Auth**:
  * [Argon2](https://github.com/ranisalt/node-argon2) — State-of-the-art password hashing.
  * [Passport.js](http://www.passportjs.org/) & [@nestjs/jwt](https://docs.nestjs.com/techniques/authentication) — Dual-token JWT (Access & Refresh tokens) with RBAC guards.
  * [Helmet](https://helmetjs.github.io/) — HTTP security headers protection.
* **Real-time WebSockets**: [@nestjs/websockets](https://docs.nestjs.com/websockets/gateways) & [Socket.IO 4](https://socket.io/) — Bidirectional event-driven communication.
* **API Documentation**: [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction) — Automated OpenAPI documentation UI.
* **Validation & Logging**:
  * `class-validator` & `class-transformer` — DTO validation pipes.
  * `Winston` & `winston-daily-rotate-file` — Structured log rotation.

### 2. Frontend Architecture (`/frontend`)
* **Framework**: [Next.js 16](https://nextjs.org/) (App Router & React Server Components).
* **UI Library**: [React 19](https://react.dev/).
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first modern CSS framework.
* **State & Data Fetching**:
  * [@tanstack/react-query v5](https://tanstack.com/query/latest) — Server state management, auto-caching, and refetching.
  * [Axios](https://axios-http.com/) — HTTP client configured with automatic JWT refresh interceptors.
* **Forms & Validation**:
  * [React Hook Form](https://react-hook-form.com/) — High-performance form handling.
  * [Zod](https://zod.dev/) — Type-safe schema validation.
* **Real-time Client**: `socket.io-client` — WebSocket listener for live notifications and task updates.
* **Visualization & Icons**:
  * [Recharts](https://recharts.org/) — Data visualization for time tracking and issue reports.
  * [Lucide React](https://lucide.dev/) — Modern UI icon set.

### 3. Infrastructure & DevOps
* **Containerization**: Docker & Docker Compose setup (`docker-compose.yml`).
* **Reverse Proxy**: Nginx configuration template (`/nginx`).

---

## 📂 Key Modules & Capabilities

```
Enterprise Project Management System
├── 🔐 Auth & Security
│   ├── Login / Register / Refresh Tokens
│   └── Organization Multi-Tenancy & RBAC
├── 📁 Projects & Milestones
│   ├── Project Creation & Auto-Generated Project Codes
│   └── Milestone Progress & Deadlines
├── 📋 Task Management
│   ├── Task Types (Task, Story, Bug) & Priorities (Low to Critical)
│   ├── Interactive Kanban Status Pipeline
│   └── Task Comments & User Mentions
├── 🐛 Defect & Issue Tracking
│   ├── Severity Levels & Environment Tagging (Staging / Prod)
│   └── Defect Lifecycle Management
├── ⏱️ Time Tracking
│   ├── Manual Hours Logging & Billable Status
│   └── Team Timesheet Summaries
└── 🔔 Real-Time Notifications
    └── Live Socket.IO Broadcasts & User Notification Center
```

---

## 💡 Usage Examples & API Specs

### 1. User Authentication (`POST /auth/login`)

**Request Payload:**
```json
{
  "email": "pm@example.com",
  "password": "password123"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "pm@example.com", "password": "password123"}'
```

**Response Payload:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": "usr_12345",
    "email": "pm@example.com",
    "firstName": "John",
    "lastName": "Manager",
    "organizationId": "org_demo"
  }
}
```

---

### 2. Create Project (`POST /project`)

**Headers:**
`Authorization: Bearer <accessToken>`

**Request Payload:**
```json
{
  "name": "Mobile Banking Application",
  "projectCode": "MBA",
  "description": "Next-gen iOS and Android banking app.",
  "visibility": "ORGANIZATION"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/project \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile Banking Application",
    "projectCode": "MBA",
    "description": "Next-gen iOS and Android banking app.",
    "visibility": "ORGANIZATION"
  }'
```

---

### 3. Create Task (`POST /task`)

**Request Payload:**
```json
{
  "title": "Implement Biometric Auth Flow",
  "description": "Integrate FaceID and Fingerprint SDK for iOS/Android",
  "type": "STORY",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "projectId": "<project_id>",
  "assigneeId": "<user_id>"
}
```

---

### 4. Log Time Entry (`POST /time-tracking`)

**Request Payload:**
```json
{
  "hours": 4.5,
  "description": "Developed JWT refresh rotation mechanism and unit tests.",
  "billable": true,
  "projectId": "<project_id>",
  "taskId": "<task_id>",
  "loggedAt": "2026-09-02T10:00:00Z"
}
```

---

### 5. Real-Time WebSocket Events (`Socket.IO`)

Connect to `ws://localhost:3000` passing JWT token in auth metadata:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer <accessToken>' }
});

// Listen for instant notifications
socket.on('notification', (data) => {
  console.log('Received real-time notification:', data);
});

// Listen for task update broadcasts
socket.on('task_updated', (task) => {
  console.log('Task status changed:', task);
});
```

---

## 💻 Local Setup & Installation

### Prerequisites
* **Node.js**: v18.x or higher
* **NPM**: v9.x or higher

### 1. Environment Setup

Check `backend/.env` configuration:
```env
DATABASE_URL="file:./dev.db"
JWT_ACCESS_SECRET="super-secret-jwt-access-key-12345"
JWT_REFRESH_SECRET="super-secret-jwt-refresh-key-67890"
PORT=3000
ALLOWED_ORIGINS=http://localhost:3001
```

Check `frontend/.env.local` configuration:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 2. Database Migration & Seeding

```bash
# Navigate to backend directory
cd backend

# Apply database migrations
npx prisma db push

# Seed demo users and projects
npx prisma db seed
```

### 3. Run Development Servers

**Start Backend (Terminal 1):**
```bash
cd backend
npm run start:dev
```

**Start Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
```

Open [`http://localhost:3001`](http://localhost:3001) in your browser to start exploring!

---

## 📄 License

This project is licensed under the MIT License.
