# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an OpenTelemetry Logs demonstration project showcasing two different approaches to logging in Node.js applications: **automated logging** and **manual logging**. The project is designed for internal demos and educational purposes.

**Architecture**: Node.js Application → Grafana Alloy (OTLP Receiver) → Loki (Log Storage) → Grafana (Visualization)

The project demonstrates the trade-offs between:
- **Automated logging** (`auto.js`): Simple wrapper functions for quick logging
- **Manual logging** (`manual.js`): Full control with rich custom attributes and business logic metadata

Both implementations use the same Express.js API (user registration, login, logout, user listing) to allow direct comparison of logging approaches.

## Common Commands

### Running the Application

```bash
# Start the automated logging version
npm run start:auto

# Start the manual logging version
npm run start:manual
```

Both versions run on port 3000. Choose one at a time.

### Docker Services

```bash
# Start the observability stack (Grafana, Loki, Alloy)
docker-compose up -d

# Check service status
docker-compose ps

# View Alloy logs
docker-compose logs alloy

# Stop all services
docker-compose down

# Stop and remove all data (including volumes)
docker-compose down -v

# Restart Alloy after config changes
docker-compose restart alloy
```

### Testing the API

The project includes a `test-api.rest` file for API testing. You can also use curl:

```bash
# Register a user
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'

# Login
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'

# List all users
curl http://localhost:3000/users
```

## Code Architecture

### Application Files

- **`auto.js`**: Automated logging version that uses a simple logger wrapper (`log.info()`, `log.error()`)
- **`manual.js`**: Manual logging version with full control over log attributes and business metadata
- **`logging.js`**: OpenTelemetry Logs SDK configuration used by `auto.js`

Note that `manual.js` contains its own OpenTelemetry setup inline at the top of the file rather than importing from `logging.js`.

### OpenTelemetry Configuration

Both applications use:
- **LoggerProvider** with resource attributes (`service.name`, `service.version`)
- **SimpleLogRecordProcessor**: Sends each log immediately (not batched)
- **OTLPLogExporter**: Exports logs via OTLP HTTP to `http://localhost:4318/v1/logs`

Service names differ:
- `auto.js`: `tony_auto`
- `manual.js`: `tony_manual`

### Alloy Configuration

Two Alloy configuration files are available:

- **`config.alloy`** (currently used): Extended configuration with debug options and batch processor
- **`config-traditional.alloy`**: Simplified pipeline with standard batch processing

Both configurations:
1. Receive OTLP logs on port 4318 (HTTP) and 4317 (gRPC)
2. Process logs through a batch processor
3. Export to Loki at `http://loki:3100/otlp`

Important: Loki must have the OTLP endpoint enabled (`/otlp/v1/logs`) for this setup to work.

The docker-compose.yaml mounts `config.alloy` by default. To switch to the traditional config, change the volume mount.

### Data Flow

```
Application (auto.js or manual.js)
    ↓ OTLP/HTTP on port 4318
Alloy (receives, batches)
    ↓ OTLP HTTP to Loki
Loki (stores logs)
    ↓ LogQL queries
Grafana (visualizes)
```

### Logging Patterns

**Automated Version** (`auto.js` + `logging.js`):
- Simple helper: `log.info(message)`, `log.error(message)`
- Minimal attributes: just severity, timestamp, and message body
- Best for: Quick development, standard logging needs

**Manual Version** (`manual.js`):
- Rich attributes: `log.info(message, attributes)`
- Custom business logic metadata: `user.username`, `error.type`, `request.id`, `operation`, etc.
- Multiple severity levels: `log.debug()`, `log.info()`, `log.error()`
- Best for: Detailed business tracking, complex querying needs

Both versions emit logs using the `logger.emit()` method with `SeverityNumber` and `severityText`.

### Express API Structure

The Express application provides a simple user management API with in-memory storage:

- **POST /register**: User registration
- **POST /login**: User authentication (returns sessionId)
- **POST /logout**: User logout
- **GET /users**: List all registered users
- **GET /user?sessionId=xxx**: Get current logged-in user

Data structures:
- `users` Map: stores username → {username, password}
- `sessions` Map: stores sessionId → username

Note: This is for demo purposes only. Passwords are not encrypted, and data is lost on restart.

### Service Ports

- **Application**: 3000
- **Grafana**: 3001 (mapped from internal 3000)
- **Loki**: 3100
- **Alloy OTLP HTTP**: 4318
- **Alloy OTLP gRPC**: 4317
- **Alloy UI**: 12345

## Grafana Usage

Access Grafana at http://localhost:3001 (anonymous login enabled, no credentials needed).

To set up Loki data source:
1. Go to Connections → Data sources → Add data source
2. Select "Loki"
3. Set URL: `http://loki:3100`
4. Click "Save & test"

Example LogQL queries:
```logql
# View all logs
{service_name="tony_auto"}

# View ERROR level logs
{service_name="tony_manual"} |= "ERROR"

# Query specific user operations
{service_name="tony_manual"} | json | user_username="alice"

# Query by error type
{service_name="tony_manual"} | json | error_type="validation_error"
```

## Development Notes

- The project uses CommonJS modules (`type: "commonjs"` in package.json)
- OpenTelemetry SDK packages: `@opentelemetry/api`, `@opentelemetry/sdk-logs`, `@opentelemetry/exporter-logs-otlp-http`
- Both applications handle graceful shutdown (SIGINT/SIGTERM) to properly close the LoggerProvider
- Alloy runs with debug logging enabled (`level = "debug"`)
- Docker volumes: `vol_loki` (Loki data), `vol_grafana` (Grafana settings)

## Important Considerations

This is a demo/educational project:
- User data stored in memory only
- No password encryption
- Simple session management
- Not suitable for production use
- Loki uses simple local storage (production should use S3 or similar)
