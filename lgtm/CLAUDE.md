# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an LGTM observability stack setup using Docker Compose. LGTM stands for:
- **L**oki: Log aggregation and storage
- **G**rafana: Visualization and dashboards
- **T**empo: Distributed tracing backend
- **(Alloy)**: OpenTelemetry collector (replaces the "M" which traditionally stands for Mimir/metrics)

The stack is designed to receive, process, and visualize observability data (logs and traces) from applications using the OpenTelemetry protocol.

## Common Commands

### Docker Stack Management

```bash
# Start the entire observability stack
docker-compose up -d

# Check service status
docker-compose ps

# View logs for specific services
docker-compose logs alloy
docker-compose logs loki
docker-compose logs tempo
docker-compose logs grafana

# Follow logs in real-time
docker-compose logs -f alloy

# Restart a specific service (useful after config changes)
docker-compose restart alloy
docker-compose restart loki

# Stop all services
docker-compose down

# Stop and remove all data (including volumes)
docker-compose down -v
```

## Architecture and Data Flow

### Service Architecture

The stack follows a typical observability pipeline pattern:

```
Application (OTLP client)
    ↓ OTLP/HTTP (4318) or OTLP/gRPC (4317)
Grafana Alloy (collector/processor)
    ├─→ Logs → Loki (via Loki native API)
    └─→ Traces → Tempo (via OTLP/gRPC)
         ↓
Grafana (query and visualization)
```

### Alloy Pipeline Configuration

The `config.alloy` file defines two separate pipelines:

**Logs Pipeline** (config.alloy:21-67):
1. `otelcol.receiver.otlp` - Receives OTLP logs on ports 4317/4318
2. `otelcol.processor.attributes` - Adds attributes and configures Loki label hints
3. `otelcol.processor.batch` - Batches logs for efficient processing
4. `otelcol.exporter.loki` - Converts OTLP logs to Loki format
5. `loki.write` - Writes to Loki at `http://loki:3100/loki/api/v1/push`

**Traces Pipeline** (config.alloy:69-86):
1. `otelcol.receiver.otlp` - Receives OTLP traces
2. `otelcol.processor.batch` - Batches traces
3. `otelcol.exporter.otlp` - Forwards to Tempo via gRPC at `tempo:4317`

**Important Alloy Configuration Details**:
- Debug logging is enabled (`level = "debug"`)
- The `stability.level=experimental` flag is required for DEBUG mode (docker-compose.yaml:58)
- Logs are sent to both the batch processor AND a debug exporter for troubleshooting
- Loki label hints are configured to promote specific attributes to labels:
  - Resource attributes: `service.name`
  - Log attributes: `severity`, `env`, `log.level`
- An `env=stag` attribute is automatically added to all logs

### Service Ports

- **Grafana**: 3001 (mapped from internal 3000)
- **Loki HTTP**: 3100
- **Loki gRPC**: 9095
- **Tempo HTTP**: 3200
- **Tempo gRPC**: 9096 (mapped from internal 9095)
- **Alloy OTLP gRPC**: 4317
- **Alloy OTLP HTTP**: 4318
- **Alloy UI**: 12345
- **Alloy Faro**: 12347

### Configuration Files

- **`docker-compose.yaml`**: Main orchestration file defining all services
- **`config.alloy`**: Alloy pipeline configuration (OTLP receiver → processing → Loki/Tempo export)
- **`loki-standalone.yaml`**: Loki configuration (currently NOT mounted - using default config from image)
- **`tempo-standalone.yaml`**: Tempo configuration with OTLP receivers enabled
- **`grafana_datasources/lgtm.yaml`**: Pre-configured Loki and Tempo data sources for Grafana

Note: The docker-compose.yaml has the Loki config volume commented out (lines 13-14), so Loki uses its default embedded configuration.

### Grafana Access

Access Grafana at http://localhost:3001. Anonymous authentication is enabled with Admin role:
- No login required (GF_AUTH_DISABLE_LOGIN_FORM=true)
- Full admin access (GF_AUTH_ANONYMOUS_ORG_ROLE=Admin)
- Data sources are pre-provisioned from `grafana_datasources/lgtm.yaml`

### Data Persistence

Current configuration:
- **Loki**: Uses in-memory storage via default config (data lost on restart)
- **Tempo**: Uses local filesystem storage at `/var/tempo/blocks` and `/var/tempo/wal` (within container, data lost on restart)
- **Grafana**: No volume mounted (dashboards/settings lost on restart)

All services are configured with `restart: always` for automatic recovery.

## Sending Data to the Stack

Applications should send telemetry data to Alloy's OTLP endpoints:

**For Logs and Traces**:
- HTTP: `http://localhost:4318` (OTLP/HTTP)
- gRPC: `http://localhost:4317` (OTLP/gRPC)

The Alloy receiver will automatically route logs to Loki and traces to Tempo based on the signal type.

## Troubleshooting

### Viewing Alloy Debug Output

Since debug logging is enabled, check Alloy logs to see detailed pipeline processing:

```bash
docker-compose logs -f alloy
```

### Checking if Services are Receiving Data

```bash
# Check Loki readiness
curl http://localhost:3100/ready

# Check Tempo readiness
curl http://localhost:3200/ready

# View Alloy UI (pipeline status and metrics)
open http://localhost:12345
```

### Configuration Changes

After modifying `config.alloy`, restart Alloy:

```bash
docker-compose restart alloy
```

Watch logs to verify the new configuration loads successfully:

```bash
docker-compose logs -f alloy
```

### Network Configuration

All services run on the `observability` Docker network. Services can communicate using their container names as hostnames (e.g., `loki:3100`, `tempo:4317`).
