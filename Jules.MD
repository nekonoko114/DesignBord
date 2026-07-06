# DesignBoard: Project Architecture & Development Requirements

This document is prepared for **Jules** (AI Agent / Developer) to understand the architecture, current implementation status, and upcoming tasks for the `DesignBoard` project.

---

## 1. Project Overview & Architecture

**DesignBoard** is a client portal for a design agency, enabling seamless communication, document/content submission, design reviews, and project management between the agency (Admin) and its clients.

### Tech Stack
- **Framework:** React Router v7 (SSR/SSG architecture)
- **Deployment:** Cloudflare Pages / Workers (`@react-router/cloudflare`)
- **Database:** Cloudflare D1 (SQLite) - bound as `DB`
- **Storage:** Cloudflare R2 - bound as `BUCKET`
- **Authentication:** Clerk (`@clerk/react-router`)
- **Styling:** Tailwind CSS v4, custom "Neumorphic" UI design patterns (`neumorphic-panel`, `neu-button`, etc.)

---

## 2. Database Schema (Cloudflare D1)
The schema is defined in `migrations/0000_init.sql`.

- **users:** `id` (Clerk User ID), `email`, `name`, `role` ('admin' | 'client')
- **projects:** `id`, `client_id` (FK users.id), `title`, `progress_rate`, `booking_limit`, `last_activity_at`, `current_phase`
- **hearings:** `id`, `project_id`, `status` ('draft' | 'submitted'), `overview_data` (JSON), `content_data` (JSON), `terms_accepted`
- **files:** `id`, `project_id`, `file_type` ('image' | 'audio' | 'design_comp'), `r2_url`, `uploaded_by`
- **annotations:** `id`, `file_id`, `user_id`, `pos_x` (REAL), `pos_y` (REAL), `comment`
- **bookings:** `id`, `project_id`, `scheduled_at` (Unix Timestamp), `status` ('reserved' | 'completed' | 'cancelled')

---

## 3. Core Mechanisms & Completed Implementations

### 3.1 Authentication & User Synchronization (`app/root.tsx`)
- Uses `clerkMiddleware` and `rootAuthLoader`.
- **Pending User Logic:** When an Admin creates a new project for a client email that doesn't exist yet, a placeholder user (`id: 'pending_<uuid>'`) is created. When the client signs up via Clerk, `root.tsx` detects the matching email, migrates the `pending_` ID to the new Clerk User ID, and updates the associated `projects.client_id`. **(Already Implemented)**

### 3.2 Client-side Routes (`app/routes/client/`)
- `dashboard.tsx`: Displays current phase, next tasks (Todo), and allows booking meetings.
- `discovery.tsx`: Multi-step form (FormWizard) saving to `hearings.overview_data`.
- `content-hub.tsx`: Section-based text editor with R2 file uploads, saving to `hearings.content_data`.
- `review.tsx`: Interactive image review tool. Users click on an image (`design_comp`) to drop a pin and leave a comment (`annotations` table). 

### 3.3 Admin-side Routes (`app/routes/admin/`)
- `dashboard.tsx`: Lists all projects, allows changing `progress_rate` and `current_phase`, detects stagnant projects (no activity for 5 days), and provides CSV/JSON export of hearing data.
- `project.tsx`: Detailed view of a project, showing submitted hearing and content data.
- `review.tsx`: Allows the Admin to resolve client comments left on design comps.

---

## 4. Pending Tasks & Requirements for Jules (TODO)

Please implement the following features. Prioritize **Task A** and **Task B**.

### Task A: Design Comp Upload Feature (Admin Side)
Currently, the `review.tsx` board relies on images existing in the `files` table, but there is no UI for the Admin to upload these designs.
- **Goal:** Allow admins to upload design images to Cloudflare R2 and register them in the `files` table with `file_type = 'design_comp'`.
- **Location:** Implement an upload form/section inside `app/routes/admin/project.tsx` (or a dedicated route if appropriate).
- **Implementation Note:** You can reuse the R2 upload logic found in `app/routes/client/content-hub.tsx` (inside the `action` function handling `intent === "upload-file"`).

### Task B: Booking Management (Admin Side)
Clients can create meeting bookings, but Admins have no way to view or manage them.
- **Goal:** Display a list of upcoming meetings for each project and allow Admins to update their status (e.g., mark as `completed` or `cancelled`).
- **Location:** `app/routes/admin/dashboard.tsx` (global view) AND/OR `app/routes/admin/project.tsx` (project-specific view).
- **Database:** Query and update the `bookings` table.

### Task C: Project Meta-Data Management
The client dashboard expects project details like `planName`, `launchDate`, `siteType`, and `directorName` from the `AuthContext` (provided by `root.tsx` loader). However, this data is currently missing or mocked.
- **Goal:** Allow Admins to edit these fields, and serve them to the Client dashboard.
- **Implementation Note:** You can either add new columns to the `projects` table or store this data as JSON inside a new column (or within `hearings.overview_data`). Update the `root.tsx` loader to fetch and return this data in the `project` object. Add a form in `app/routes/admin/project.tsx` to update it.

### Task D: UX/UI Polish & Error Handling
- Implement Toast notifications (e.g., using `react-hot-toast` or a custom Neumorphic toast) for success/error states on forms and file uploads.
- Ensure the Design Review tool (`review.tsx`) is usable on mobile devices (touch events for dropping pins).

---

## Instructions for Jules
1. Read the implementation details in the respective files mentioned above.
2. **CRITICAL:** Before making any changes, please create a new git branch for this development (e.g., `git checkout -b feature/admin-improvements`).
3. Start with **Task A** (Design Upload) to complete the core feedback loop of the application.
4. Follow the existing Neumorphic design patterns and use Tailwind classes consistently.
5. When writing to Cloudflare R2 or D1, ensure proper error handling and Discord notifications (using `utils/discord.server.ts`) where appropriate.
