# Inspector MVP - Architecture Documentation

## System Architecture

### Overview

The Inspector MVP is a multi-layer monitoring system designed to provide comprehensive visibility across video delivery infrastructure from origin to edge.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INSPECTOR MVP STACK                          │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │  Video Sources   │
                         │  (Encoders)      │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │    Packager      │
                         │  (HLS/DASH)      │◄──┐
                         └────────┬─────────┘   │
                                  │             │ Monitor
                         ┌────────▼─────────┐   │
                         │   CDN Origin     │   │
                         │   (Caching)      │◄──┤
                         └────────┬─────────┘   │
                                  │             │
                         ┌────────▼─────────┐   │
                         │   CDN Edge       │   │
                         │   (Regional)     │◄──┤
                         └────────┬─────────┘   │
                                  │             │
                         ┌────────▼─────────┐   │
                         │  Client Players  │   │
                         │  (End Users)     │   │
                         └──────────────────┘   │
                                                │
                                                │
┌───────────────────────────────────────────────┘
│
│  MONITORING STACK
│
├──▶ ┌────────────────────┐     ┌────────────────────┐
│    │ Packager Monitor   │     │   CDN Monitor      │
│    │ - Playlist         │     │ - Latency          │
│    │ - Segments         │     │ - Cache Rate       │
│    │ - ABR Ladder       │     │ - Availability     │
│    └─────────┬──────────┘     └─────────┬──────────┘
│              │                           │
│              └────────┬──────────────────┘
│                       │
│                       ▼
│              ┌────────────────────┐
│              │     InfluxDB       │
│              │  (Time Series DB)  │
│              └─────────┬──────────┘
│                        │
│        ┌───────────────┼───────────────┐
│        │               │               │
│        ▼               ▼               ▼
│  ┌──────────┐   ┌──────────┐   ┌──────────┐
│  │Prometheus│   │ Grafana  │   │ CMS API  │
│  │(Metrics) │   │(Dashbrd) │   │(Config)  │
│  └──────────┘   └──────────┘   └─────┬────┘
│                                       │
│                                       ▼
│                                ┌─────────────┐
│                                │ PostgreSQL  │
│                                │ (Metadata)  │
│                                └─────────────┘
│
└──▶ ┌────────────────────┐
     │  UI Dashboard      │
     │  (React SPA)       │
     └────────────────────┘
```

## Components

### 1. Monitoring Services

#### 1.1 Packager Monitor

**Purpose**: Monitor HLS/DASH packaging quality and availability

**Technology**: Python 3.11

**Key Functions**:
- Download and validate master playlists
- Check variant playlists for each quality level
- Download and verify segment files
- Measure segment download time
- Validate ABR ladder configuration
- Check for discontinuities

**Metrics Generated**:
- `segment_metric`: Per-segment metrics (size, duration, download time)
- `playlist_validation`: Playlist structure validation
- `abr_ladder`: ABR configuration and bitrates
- `channel_error`: Error tracking

**Data Flow**:
```
Packager → HTTP GET → Monitor → Parse M3U8 → Validate
                                      ↓
                              InfluxDB (write metrics)
```

#### 1.2 CDN Monitor

**Purpose**: Monitor CDN edge performance and cache efficiency

**Technology**: Python 3.11

**Key Functions**:
- Test CDN endpoints across regions
- Measure latency and TTFB
- Track cache hit/miss rates
- Monitor error rates
- Aggregate health metrics

**Metrics Generated**:
- `cdn_request`: Per-request metrics (latency, cache status)
- `cdn_health`: Aggregated endpoint health

**Data Flow**:
```
CDN Edge → HTTP GET → Monitor → Measure Response
                                     ↓
                             InfluxDB (write metrics)
```

### 2. Data Storage

#### 2.1 InfluxDB (Time-Series)

**Purpose**: Store time-series metrics data

**Schema**:
```
Bucket: metrics
  Measurements:
    - segment_metric
    - playlist_validation
    - abr_ladder
    - cdn_request
    - cdn_health
    - channel_error

  Retention: 30 days default
```

**Indexing**:
- Tags: `channel`, `rung`, `endpoint`, `cache_status`
- Fields: Numerical values (latency_ms, size_bytes, etc.)
- Timestamp: nanosecond precision

#### 2.2 PostgreSQL (Relational)

**Purpose**: Store configuration and metadata

**Schema**:
```sql
Tables:
  - probes (monitoring probe configuration)
  - channels (channel definitions)
  - templates (monitoring templates)
  - alerts (alert history)

Relationships:
  channels.probe_id → probes.probe_id
  channels.template_id → templates.template_id
  alerts.channel_id → channels.channel_id
```

### 3. API Layer

#### 3.1 CMS API

**Purpose**: RESTful API for configuration management

**Technology**: Flask + SQLAlchemy

**Endpoints**:
```
/api/v1/health          - Health check
/api/v1/channels        - Channel CRUD
/api/v1/templates       - Template CRUD
/api/v1/alerts          - Alert management
/api/v1/probes          - Probe configuration
```

**Authentication**: None (add JWT/OAuth in production)

**Response Format**: JSON

### 4. Metrics & Alerting

#### 4.1 Prometheus

**Purpose**: Metrics scraping and alerting

**Jobs**:
- `prometheus`: Self-monitoring
- `cms-api`: API metrics
- `influxdb`: Database metrics

**Alert Rules**:
- ServiceDown: Service unreachable for 2+ minutes
- HighErrorRate: Error rate > 5% for 5+ minutes
- DatabaseConnectionFailure: DB unavailable

#### 4.2 AlertManager

**Purpose**: Alert routing and notification

**Features**:
- Alert grouping
- Alert deduplication
- Routing by severity
- Notification channels (Slack, Email, PagerDuty)

**Alert Severities**:
- `critical`: Immediate attention required
- `major`: Important but not immediate
- `minor`: Warning level
- `info`: Informational

### 5. Visualization

#### 5.1 Grafana

**Purpose**: Data visualization and dashboards

**Datasources**:
- InfluxDB (metrics bucket)
- Prometheus (alert metrics)
- PostgreSQL (metadata)

**Dashboard Types**:
- Real-time monitoring
- Historical trends
- Alert overview
- System health

#### 5.2 UI Dashboard

**Purpose**: Custom monitoring interface

**Technology**: React 18 + Recharts

**Features**:
- Channel overview
- Real-time KPIs
- Alert management
- Channel configuration

## Data Flow

### Metrics Collection Flow

```
1. Monitor Services (every 30-60s)
   ↓
2. Fetch Data (HTTP GET from Packager/CDN)
   ↓
3. Process & Validate
   ↓
4. Write to InfluxDB (via Line Protocol)
   ↓
5. Prometheus Scrapes InfluxDB
   ↓
6. Grafana Queries Data
   ↓
7. Display in UI
```

### Alert Flow

```
1. Prometheus Evaluates Rules (every 15s)
   ↓
2. Alert Triggered (threshold exceeded)
   ↓
3. Send to AlertManager
   ↓
4. AlertManager Routes Alert
   ↓
5. Notification Sent (Slack/Email/etc)
   ↓
6. NOC Acknowledges via UI
```

### Configuration Flow

```
1. User Updates Channel via UI
   ↓
2. UI Sends POST to CMS API
   ↓
3. CMS API Validates & Writes to PostgreSQL
   ↓
4. Monitor Service Reads New Config (next cycle)
   ↓
5. Monitoring Begins
```

## Security

### Network Security

```
External Access:
  - Port 80/443: UI Dashboard (HTTPS in prod)
  - Port 3000: Grafana (HTTPS in prod)

Internal Only:
  - Port 5000: CMS API
  - Port 5432: PostgreSQL
  - Port 8086: InfluxDB
  - Port 9090: Prometheus
  - Port 9093: AlertManager

Docker Network: inspector (bridge)
```

### Authentication

**Current (MVP)**:
- No authentication (internal use only)
- Docker network isolation

**Production Recommendations**:
- Add JWT/OAuth to CMS API
- Enable Grafana LDAP/OAuth
- Enable InfluxDB token authentication
- Use TLS for all services
- Implement API rate limiting

### Data Security

**Sensitive Data**:
- Database passwords in `.env`
- InfluxDB tokens in `.env`
- API tokens

**Protection**:
- Environment variables (not in code)
- File permissions: `chmod 600 .env`
- Docker secrets (production)
- Vault integration (production)

## Scalability

### Horizontal Scaling

**Monitors**:
```bash
# Scale packager monitors
docker compose up -d --scale packager-monitor=3

# Each instance monitors subset of channels
# Use CHANNELS env var to distribute load
```

**API**:
```bash
# Add load balancer (nginx/HAProxy)
# Scale API instances
docker compose up -d --scale cms-api=3
```

### Vertical Scaling

**Resource Limits**:
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 4G
    reservations:
      cpus: '0.5'
      memory: 1G
```

### Database Scaling

**PostgreSQL**:
- Read replicas for queries
- Connection pooling (PgBouncer)
- Partitioning for large tables

**InfluxDB**:
- Increase retention based on disk
- Downsample old data
- Archive to cold storage (S3)

## Performance

### Expected Performance

**Per Monitor Service**:
- CPU: 5-10% (100 channels)
- Memory: 100-200MB
- Network: 1-5 Mbps

**Per Database**:
- PostgreSQL: 50-100MB RAM
- InfluxDB: 200-500MB RAM (active bucket)

**Latency**:
- API response: < 100ms (p95)
- Metrics write: < 50ms
- Dashboard load: < 2s

### Optimization

**Monitoring**:
- Adjust poll interval based on load
- Use connection pooling
- Cache DNS lookups
- Batch writes to InfluxDB

**Database**:
- Index frequently queried fields
- Use prepared statements
- Enable query caching
- Monitor slow queries

## Reliability

### High Availability

**Database HA**:
```
PostgreSQL:
  - Master-replica setup
  - Automatic failover (Patroni)
  - Connection pooling

InfluxDB:
  - Clustering (Enterprise)
  - Regular backups
  - Snapshot-based recovery
```

**Service HA**:
```
Monitors:
  - Multiple instances
  - Health checks
  - Auto-restart on failure

API:
  - Load balancer
  - Health endpoint
  - Graceful shutdown
```

### Monitoring the Monitors

```
- Prometheus monitors all services
- AlertManager notifies on failures
- Grafana dashboards show system health
- Docker health checks
```

### Backup Strategy

**Daily Backups**:
- PostgreSQL: pg_dump
- InfluxDB: influx backup
- Configuration files

**Retention**:
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months

## Future Enhancements

### Planned Features

1. **Authentication & Authorization**
   - JWT tokens
   - Role-based access control
   - SSO integration

2. **Advanced Alerting**
   - ML-based anomaly detection
   - Predictive alerting
   - Custom alert rules

3. **Extended Monitoring**
   - Player analytics integration
   - QoE metrics
   - Business metrics

4. **Performance**
   - Metrics caching layer (Redis)
   - Read replicas
   - Query optimization

5. **Integration**
   - Webhook notifications
   - External ITSM (ServiceNow, Jira)
   - ChatOps (Slack commands)

---

**Version**: 1.0.0
**Last Updated**: 2025-01-14
