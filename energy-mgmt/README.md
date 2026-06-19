# EnergyOS — Energy Management CRUD Application

A secure, high-performance monorepo application for managing power plants and inverter diagnostics logs. Built using React, Express, and PostgreSQL.

---

## Technical Stack
- **Frontend**: React 18, Vite, React Router v6, Axios, TailwindCSS
- **Backend**: Node.js, Express, pg (node-postgres), bcryptjs, jsonwebtoken, dotenv, cors
- **Database**: PostgreSQL

---

## Project Folder Structure
```
/energy-mgmt
  /database
    schema.sql             # SQL DB Schema Definitions & Custom Enums
    seed.sql               # Seed Data (pre-hashed credentials, plants & permissions)
  /backend
    /src
      /config
        db.js              # pg Pool Database config
      /controllers
        authController.js  # Email Login, Profile Loading, changePassword
        plantsController.js# Plants scoped CRUD
        invertersController.js# Inverter paginated lists, status patches, CSV exports
        usersController.js # Admin User CRUD & resets
        permissionsController.js# Admin user plant permission overrides & batch saves
      /middleware
        authMiddleware.js  # JWT parser
        roleMiddleware.js  # requireRole factory
        permissionMiddleware.js# requirePlantPermission factory
      /routes
        auth.js
        plants.js
        inverters.js
        users.js
        permissions.js
      server.js            # Express API service booting
    .env.example
    package.json
  /frontend
    /src
      /components
        Navbar.jsx
        ProtectedRoute.jsx # Authentication route guard
        ConfirmDialog.jsx  # Reusable Delete Confirmation Dialogue
      /context
        AuthContext.jsx    # Session state reducer & auto-load
        ToastContext.jsx   # Global Toast stack manager
      /pages
        Login.jsx          # Teal/Green operator sign in
        AdminLogin.jsx     # Dark admin sign in
        UserDashboard.jsx  # Grid of plant cards & operator settings
        PlantDetail.jsx    # detailed plant inverters & inline editor
        AdminDashboard.jsx # Admin panel containing custom SVG charts & logs
      /services
        api.js             # Axios client with JWT headers interceptor
      App.jsx              # React Router v6 routes mapping
      main.jsx
      index.css            # Tailwind directives
    tailwind.config.js
    postcss.config.js
    .env.example
    package.json
```

---

## Database Initial Setup & Seeding

1. Create a PostgreSQL database (e.g. `energy_db`):
   ```bash
   createdb -U postgres energy_db
   ```
2. Apply migrations (`schema.sql`):
   ```bash
   psql -U postgres -d energy_db -f database/schema.sql
   ```
3. Apply seed data (`seed.sql`):
   ```bash
   psql -U postgres -d energy_db -f database/seed.sql
   ```

---

## Local Development Execution

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *Modify `.env` database parameters if necessary.*
4. Start the Express server in development mode:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Start the Vite React development server:
   ```bash
   npm run dev
   ```

---

## API Endpoints Reference

### Authentication API (`/api/auth`)
| Method | Endpoint | Description | Scope |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate email and password. Returns JWT. | Public |
| `POST` | `/api/auth/logout` | Client logout notifier response. | Protected |
| `GET` | `/api/auth/me` | Fetch active user credentials and grid permissions. | Protected |
| `PATCH` | `/api/auth/password` | Update current operator password. | Protected |

### Plants API (`/api/plants`)
| Method | Endpoint | Description | Scope |
|---|---|---|---|
| `GET` | `/api/plants` | List plants with inverter stats. Filter by `status`, `search`. | Protected (User scopes) |
| `GET` | `/api/plants/:id` | Fetch details of a single plant and its inverters. | Protected (Read perm check) |
| `POST` | `/api/plants` | Create a new power plant grid. | Admin Only |
| `PUT` | `/api/plants/:id` | Update plant specifications. | Admin Only |
| `DELETE` | `/api/plants/:id` | Delete plant and cascade inverters. | Admin Only |

### Inverters API (`/api/inverters`)
| Method | Endpoint | Description | Scope |
|---|---|---|---|
| `GET` | `/api/inverters` | List inverters with pagination, sort, search. | Protected (User scoping) |
| `GET` | `/api/inverters/export` | Download filtered list of inverters as a CSV file. | Protected (User scoping) |
| `GET` | `/api/inverters/:id` | Fetch detail log of a single inverter. | Protected (Read perm check) |
| `POST` | `/api/inverters` | Register a new inverter at a plant. | Protected (Write perm check) |
| `PUT` | `/api/inverters/:id` | Update inverter metrics (status, efficiency, model). | Protected (Write perm check) |
| `PATCH` | `/api/inverters/:id/status` | Modify status of an inverter. | Protected (Write perm check) |
| `DELETE` | `/api/inverters/:id` | Remove inverter. | Admin Only |

### Users & Permissions API (`/api/users` & `/api/permissions`)
| Method | Endpoint | Description | Scope |
|---|---|---|---|
| `GET` | `/api/users` | List users with assigned plants count. | Admin Only |
| `GET` | `/api/users/:id` | Fetch user details and permissions list. | Admin Only |
| `POST` | `/api/users` | Register a new system account (Admin or Operator). | Admin Only |
| `PUT` | `/api/users/:id` | Edit username, email, and role of an account. | Admin Only |
| `DELETE` | `/api/users/:id` | Delete account and permissions cascade. | Admin Only |
| `PATCH` | `/api/users/:id/password` | Admin reset user password. | Admin Only |
| `GET` | `/api/permissions/user/:userId` | Get plant permissions overrides list. | Admin Only |
| `POST` | `/api/permissions/batch` | Update and save all user permissions in one call. | Admin Only |

---

## Role & Authorization Privilege Matrix

| Operation | Administrator Role | Operator User (`can_write = true`) | Operator User (`can_read = true`) |
|---|---|---|---|
| **View Plant list / Cards** | Yes (All plants) | Yes (Assigned plants only) | Yes (Assigned plants only) |
| **Manage Plants (CRUD)** | Yes | No | No |
| **View Inverter Table** | Yes (All inverters) | Yes (Assigned plants only) | Yes (Assigned plants only) |
| **Add Inverter** | Yes | Yes (Assigned plant only) | No |
| **Edit Inverter inline** | Yes | Yes (Assigned plant status/efficiency) | No |
| **Delete Inverter** | Yes | No | No |
| **Export Grid CSV** | Yes (All grids) | Yes (Assigned plants only) | Yes (Assigned plants only) |
| **Manage Users & Perms** | Yes | No | No |

---

## Seed Accounts Reference
- **Administrator**:
  - Email: `admin@energymgmt.com`
  - Password: `Admin@123`
- **Operators**:
  - Emails: `user1@energymgmt.com`, `user2@energymgmt.com`, `user3@energymgmt.com`
  - Password: `User@123`
