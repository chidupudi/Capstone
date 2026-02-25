# TrainForge Project Overview

A robust distributed AI compute platform featuring a web dashboard, REST API, CLI tool, and Python workers utilizing Firebase for Auth & DB.

## 1. Frontend Dashboard (React.js + Tailwind CSS)
**Location:** `d:\capstone\trainforge\dashboard\`
- **Core Entry:** `src/index.js` and `src/App.js` (Routing & Protected Routes)
- **Pages:** `src/pages/`
  - `Login.js`: Google SSO with Firebase.
  - `SubmitJob.js`: Job configuration and file upload portal.
  - `Workers.js`: Lists active GPU workers and allows admin disconnect.
  - `DistributedMonitor.js`: Real-time system monitoring.
  - `GPUConnect.js` / `Profile.js`: Admin controls and user identity.
- **Services:** `src/context/AuthContext.js` (Global Auth), `src/services/api.js` (Axios REST calls).

## 2. Backend API (Node.js + Express)
**Location:** `d:\capstone\trainforge\api\`
- **Core Entry:** `src/index.js` (Express Server & WebSocket initialization)
- **Routes:** `src/routes/`
  - `jobs.js`: Job CRUD operations and file ingestion.
  - `workers.js`: Worker registration, status pooling, and disconnection.
  - `auth.js` / `config.js`: Authentication endpoints and Tunnel config.
- **Middleware:** `src/middleware/auth.js` (`verifyToken` for standard users, `isAdmin` for RBAC checks).

## 3. Database & Setup Config (Firebase)
**Locations:**
- **Backend Setup:** `d:\capstone\trainforge\api\src\config\firebase.js` uses **Firebase Admin SDK** to communicate securely with Firestore & Cloud Storage.
- **Service Key:** `api/train-forge-firebase-adminsdk-fbsvc-cb9c09cc5e.json`.
- **Frontend Setup:** `dashboard/src/config/firebase.js` uses standard Firebase Client SDK.

## 4. CLI Tool (Node.js)
**Location:** `d:\capstone\trainforge\cli\`
- **Core Entry:** `bin/trainforge` / `bin/trainforge.js`
- **Purpose:** Headless interaction for users to `login` and `submit` training jobs directly from terminal to the Node Express API.

## 5. External GPU Workers (Python)
**Location:** `d:\capstone\trainforge\external-gpu\`
- **Core Entry:** `colab_worker.py`
- **Purpose:** Runs on remote GPUs (e.g., Google Colab, RunPod), pings the Express Backend API for task assignments, downloads payloads, and uploads results back to Firebase Storage.
