# Graph Explorer

Welcome to the **Lemici Graph Explorer**! This project is a full-stack web application designed to help users interact with, visualize, and manage Nebula Graph database schemas and data. It features a drag-and-drop schema drafter, real-time DDL execution, and an interactive data explorer.

This document will guide you from unzipping the project to getting it fully running on your local machine.

---

## 📁 What You Will See After Unzipping
Once you unzip the provided file, you will see the following directory structure:

```text
Graph/
├── backend/            # Go Backend (REST API + WebSockets)
├── frontend/           # React Frontend (Vite + Tailwind + D3.js)
└── README.md           # This documentation file
```

---

## 🛠️ Prerequisites
Before running the project, please ensure you have the following software installed on your machine:

1. **Node.js (with NPM)** - Required to install dependencies and run the React frontend.
2. **Go** (v1.20 or higher) - For running the backend.
3. **PostgreSQL** - Running locally (default port `5432`). Used for storing schema drafts and user data.
4. **Nebula Graph Database** - Running locally via Docker (default port `9669`). Used as the primary graph database.

---

## 🚀 How to Run the Backend (Go)

The backend handles API requests, database migrations, and WebSocket connections for real-time querying. It runs on **Port 8080**.

### 1. Setup Database
Ensure PostgreSQL is running on your machine and create a blank database named `Graph` (or whatever name you prefer).

### 2. Configure Environment Variables
Navigate into the `backend/` directory and create a new file named `.env`.

Add the following credentials to your `.env` file (adjust values according to your local setup):

```env
# Nebula Graph Configuration
NEBULA_HOST=127.0.0.1
NEBULA_PORT=9669

# PostgreSQL Configuration
POSTGRES_HOST=127.0.0.1
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=graph
POSTGRES_PORT=5432
```

### 3. Install Dependencies & Run
Open a terminal in the `backend/` directory and install the required Go modules and the `air` live-reloading tool:

```bash
# Download required Go modules
go mod tidy

# Install 'air' for live reloading (if not already installed)
go install github.com/air-verse/air@latest

# Start the server using air
air
```
If successful, you will see logs indicating that Nebula and Postgres connected successfully, and the server started on `:8080`.

---

## 🎨 How to Run the Frontend (React)

The frontend is a modern React application built with Vite. It runs on **Port 5173**.

### 1. Configure Environment Variables
You **do not** need a `.env` file for the frontend! 
The project is configured using Vite's proxy feature. Any requests sent to `/api` or `/ws` from the frontend are automatically forwarded to the backend running at `http://localhost:8080`.

### 2. Install Dependencies & Run
Open a **new** terminal in the `frontend/` directory and run the following commands:

```bash
# Install NPM packages
npm install

# Start the development server
npm run dev
```

### 3. Open in Browser
Once the server starts, open your browser and navigate to:
**http://localhost:5173**

---

## 🛑 Troubleshooting
- **CORS Errors / API not reachable:** Ensure your backend is running on `localhost:8080`. The frontend Vite proxy relies on this exact port.
- **Nebula Connection Failed:** Ensure your Nebula Graph Docker containers (graphd, metad, storaged) are healthy. You can verify this using `docker ps`.

---

## 🐳 Docker Architecture & Connectivity

If you prefer to run the entire application using Docker, a complete `docker-compose.yml` setup is included. Here is exactly how the containers are structured, which ports they run on, and how they communicate.

### Containers & Ports Overview

| Container Name | Service | Internal Port | External Port | Description |
|---|---|---|---|---|
| **postgres** | PostgreSQL DB | 5432 | 5432 | Stores schema drafts and workspace data. |
| **backend** | Go Gin API | 8080 | 8080 | Core backend server handling requests and DB connections. |
| **frontend** | React + Nginx | 80 | 5173 | Serves the UI and proxies API requests to the backend. |

*(Note: "External Port" is the port mapped in `docker-compose.yml` that you use in your browser/localhost to access the service from outside. "Internal Port" is what the container actually runs on inside the Docker network.)*

*(Note: Change enviorment credentials in .yml file)*

### How They Are Connected

All Docker containers run on a shared default Docker bridge network (`graph_default`), allowing them to talk to each other using their container names as hostnames:

1. **Frontend → Backend**: 
   - The React app runs inside the `frontend` container using Nginx.
   - Nginx is configured to serve the UI on internal port `80` (mapped to `5173` for you).
   - Any API or WebSocket request (e.g., `/api/*` or `/ws/*`) made by the UI is intercepted by Nginx and proxied internally to `http://backend:8080`.

2. **Backend → PostgreSQL**:
   - The Go server in `backend` connects to PostgreSQL using the hostname `postgres` (which resolves to the `postgres` container) on port `5432`.

3. **Backend → Nebula Graph**:
   - Since Nebula Graph is running directly on your Windows Host (not in this docker-compose), the `backend` container connects to it using the special IP address `192.168.1.10` (or `host.docker.internal`) on port `9669`.

### How to Start the Containers
Open a terminal in the root folder (`graph/`) and run:

```bash
# Build and start all containers in detached mode
docker-compose up --build -d
```

### Accessing the Application
- **Open the UI:** [http://localhost:5173](http://localhost:5173)

### How to Stop the Containers
To stop and remove the containers, run:
```bash
docker-compose down
```
