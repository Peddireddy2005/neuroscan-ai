# Deploy NeuroScan

Extract the ZIP into a new folder. Keep the backend, frontend, models and Dockerfile together. The container builds the React frontend and serves it alongside the API on port 8000.

## Run locally on Windows

Install Node.js 22 and open PowerShell in the extracted folder. Run:

```powershell
node -e "console.log('SECRET_KEY='+require('node:crypto').randomBytes(32).toString('hex'))" | Set-Content -Encoding ascii .env
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
npm.cmd --prefix backend start
```

Open http://localhost:8000. The local service stores accounts and report history in neuroscan.db. Keep this database and the signing key when upgrading an existing installation. Generate the key only for a new installation.

## Deploy with Docker Compose

On a Docker host with the Compose plugin, create a private .env file beside docker-compose.yml. Set SECRET_KEY and POSTGRES_PASSWORD to independent random 64-character hexadecimal strings. For each value run `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` or `openssl rand -hex 32`.

Run `docker compose up --build -d`. Compose starts the app and PostgreSQL. The pgdata volume persists accounts and report history across container restarts. Retain the volume and back it up before upgrades.

Expose the web service through an HTTPS reverse proxy forwarding to port 8000. Keep one application replica because analysis jobs are queued in process. Production authentication uses secure cookies. For a managed container deployment, use the root Dockerfile, set NODE_ENV=production, SECRET_KEY and DATABASE_URL, and configure /api/health as the health endpoint. The service reads the host-provided PORT.

## Verify the installation

Open /api/health and confirm four model families. At /api/models confirm 2 SVM, 5 CNN, 30 DNN and 30 CLDNN checkpoints. Create an account, upload one 19-channel recording sampled at 128 Hz with at least 1,024 samples per channel, and open the completed report from Reports.

## Model selection and interpretation

All ten supplied SVM checkpoints produced finite outputs on the same EEG feature batch. Among them, folds 2 and 8 had the lowest median inference times on the test machine across 30 timed runs after warm-up. Latency depends on hardware and input. The archives contain aggregate training metrics, so accuracy of the selected pair is unknown.

All five supplied CNN folds and the existing DNN and CLDNN checkpoints are included. Each family produces one recording-level classification from its average output. An even split between the four families yields an inconclusive report. The Models page presents original subject-level cross-validation results. The combined system has no separately measured clinical performance.
