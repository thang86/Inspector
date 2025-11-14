# 🎯 FPT PLAY PACKAGER MONITORING - QUICK REFERENCE CHEAT SHEET
**For Developers, DevOps, and NOC Teams**

---

## 🚀 STARTUP CHECKLIST (MORNING EACH DAY)

```bash
# 1. Check all services running
docker-compose ps

# Expected: 8 services "Up"

# 2. Verify database connectivity
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "SELECT COUNT(*) FROM channels;"

# Expected: Number of channels (50+)

# 3. Check API health
curl http://localhost:5000/api/v1/health

# Expected: {"status": "healthy", "database": "connected"}

# 4. Verify metrics flowing
curl -s http://localhost:8086/api/v2/query \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  --data-urlencode 'query=from(bucket:"packager_metrics") |> range(start: -5m) |> limit(n: 1)'

# Expected: Recent metrics (not empty)

# 5. Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health == "down")'

# Expected: Empty (all healthy)
```

---

## 💾 COMMON COMMANDS

### Docker Operations

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f cms-api
docker-compose logs -f packager-monitor
docker-compose logs -f postgres

# Restart service
docker-compose restart cms-api

# Get shell access
docker-compose exec postgres bash
docker-compose exec cms-api bash

# View resource usage
docker stats
```

### Database Operations

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring

# List channels
SELECT channel_code, channel_name, enabled FROM channels LIMIT 10;

# Count channels by tier
SELECT tier, COUNT(*) FROM channels GROUP BY tier;

# View recent alerts
SELECT alert_id, alert_type, severity, created_at FROM alerts ORDER BY created_at DESC LIMIT 10;

# Find channels with issues
SELECT * FROM channels WHERE channel_id IN (
  SELECT DISTINCT channel_id FROM alerts WHERE severity = 'CRITICAL' AND resolved = FALSE
);

# Acknowledge all major alerts
UPDATE alerts SET acknowledged = TRUE, acknowledged_by = 'system' 
WHERE severity = 'MAJOR' AND acknowledged = FALSE;

# Backup database
docker-compose exec postgres pg_dump -U monitor_app fpt_play_monitoring > backup-$(date +%s).sql

# Restore database
docker-compose exec -T postgres psql -U monitor_app fpt_play_monitoring < backup.sql
```

### API Operations

```bash
# Get all channels
curl http://localhost:5000/api/v1/channels

# Get 4K channels only
curl "http://localhost:5000/api/v1/channels?is_4k=true"

# Get Tier 1 channels
curl "http://localhost:5000/api/v1/channels?tier=1"

# Get active alerts
curl http://localhost:5000/api/v1/alerts/active

# Create new channel (JSON)
curl -X POST http://localhost:5000/api/v1/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channel_code":"CH_NEW_001",
    "channel_name":"New Channel",
    "channel_type":"LIVE",
    "tier":1,
    "probe_id":3,
    "input_url":"http://packager/live/CH_NEW_001/master.m3u8",
    "template_id":1
  }'

# Acknowledge alert
curl -X POST http://localhost:5000/api/v1/alerts/1/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"acknowledged_by":"operator"}'

# Resolve alert
curl -X POST http://localhost:5000/api/v1/alerts/1/resolve

# Delete/disable channel
curl -X DELETE http://localhost:5000/api/v1/channels/1
```

### Metrics Queries

```bash
# Prometheus - Query active alerts
curl http://localhost:9090/api/v1/rules

# Prometheus - Get metric target up/down status
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .job, health: .health}'

# InfluxDB - Query segment metrics (last 1 hour)
curl -s http://localhost:8086/api/v2/query \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  --data-urlencode 'org=fpt-play' \
  --data-urlencode 'query=
from(bucket:"packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "segment_metric")
'

# InfluxDB - Average download time per channel
curl -s http://localhost:8086/api/v2/query \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  --data-urlencode 'org=fpt-play' \
  --data-urlencode 'query=
from(bucket:"packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "segment_metric")
  |> group(columns: ["channel"])
  |> mean(column: "download_time_ms")
'
```

---

## 🔍 MONITORING & ALERTS

### Key Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Grafana | http://localhost:3000 | Real-time metrics & alerts |
| Prometheus | http://localhost:9090 | Alert rules & query |
| CMS API | http://localhost:5000 | Configuration API |
| InfluxDB | http://localhost:8086 | Raw metrics |
| AlertManager | http://localhost:9093 | Alert routing |

### Critical Alerts (Investigate Immediately)

```
ALERT: Segment Missing (HTTP 404)
└─ Action: Check packager output directory exists
└─ Command: ssh packager; ls -la /mnt/origin/live/CH_001

ALERT: Download Time > 2s
└─ Action: Check packager CPU/network load
└─ Command: ssh packager; top -b -n 1

ALERT: Segment Duration Variance
└─ Action: Check encoder GOP settings
└─ Command: Check encoder configuration

ALERT: HTTP 5xx Errors
└─ Action: Check packager service status
└─ Command: docker-compose logs packager-monitor

ALERT: Playlist Missing (404)
└─ Action: Verify channel configured correctly
└─ Command: curl http://packager/live/CH_001/master.m3u8
```

### Monitor Playbook

```
Issue: "Channel appears in dashboard but no metrics"
├─ Step 1: Check if monitor can reach packager
│  └─ docker-compose exec packager-monitor curl -v http://packager/live/CH_001/master.m3u8
│
├─ Step 2: Check InfluxDB connection
│  └─ docker-compose logs packager-monitor | grep -i influx
│
├─ Step 3: Verify channel in database
│  └─ SELECT * FROM channels WHERE channel_code = 'CH_001';
│
└─ Step 4: Restart monitoring service
   └─ docker-compose restart packager-monitor

Issue: "API returning 500 error"
├─ Step 1: Check API logs
│  └─ docker-compose logs cms-api
│
├─ Step 2: Check database connection
│  └─ docker-compose exec postgres pg_isready
│
└─ Step 3: Restart API
   └─ docker-compose restart cms-api

Issue: "Grafana not showing metrics"
├─ Step 1: Check data source
│  └─ Grafana UI → Configuration → Data Sources → Check InfluxDB URL/token
│
├─ Step 2: Verify InfluxDB has data
│  └─ Use InfluxDB query command above
│
└─ Step 3: Check dashboard queries
   └─ Edit dashboard, verify query syntax
```

---

## 📊 PERFORMANCE TUNING

### If Monitor Too Slow (High CPU)

```bash
# 1. Check what consuming CPU
docker-compose exec packager-monitor top -b -n 1

# 2. Increase polling interval (collect less frequently)
# Edit .env:
POLL_INTERVAL=60  # was 30 seconds

# 3. Restart service
docker-compose restart packager-monitor

# 4. Monitor CPU again
docker stats
```

### If Database Getting Large

```bash
# Check database size
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "SELECT pg_size_pretty(pg_database_size('fpt_play_monitoring'));"

# Clean old alerts (older than 30 days)
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "
DELETE FROM alerts WHERE created_at < NOW() - INTERVAL '30 days';
"

# Vacuum database (optimize)
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "VACUUM FULL;"

# Check table sizes
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### If Metrics Lag (Old Data in Grafana)

```bash
# Check InfluxDB retention policy
curl -s http://localhost:8086/api/v2/buckets \
  -H "Authorization: Token $INFLUXDB_TOKEN" | jq '.buckets[] | {name: .name, retentionRules: .retentionRules}'

# Force retention cleanup
docker-compose restart influxdb
```

---

## 🚨 INCIDENT RESPONSE FLOW

```
┌─ Alert triggered (Prometheus rule)
│
├─→ Send SNMP trap (if configured)
├─→ Send to AlertManager
├─→ AlertManager routes to:
│  ├─ Slack channel
│  ├─ Email inbox
│  └─ Webhook
│
├─ NOC receives notification
│
├─→ Check dashboard (Grafana/React UI)
├─→ Identify affected channel(s)
├─→ Check monitoring service logs
│
├─ Determine root cause:
│  ├─ Packager issue?  → Call Packager team
│  ├─ Network issue?   → Call Network team
│  ├─ Monitoring issue?→ Check docker-compose logs
│  └─ Unknown?         → Escalate
│
├─ Execute playbook for that issue
│
├─ Once resolved:
│  └─ Acknowledge alert in dashboard
│  └─ Document what happened
│  └─ Schedule post-incident review
│
└─ Follow-up:
   └─ Send "All Clear" notification
   └─ Update runbooks if needed
```

---

## 🔐 SECURITY CHECKLIST

```
☐ Change all default passwords (.env):
  - PostgreSQL: monitor_app password
  - Grafana: admin password
  - InfluxDB: admin password

☐ Generate secure tokens:
  - InfluxDB API token (minimum required permissions)
  - API secret key

☐ Configure firewall:
  - Only expose ports 80/443 (via Nginx)
  - Close internal ports (5000, 3000, 8086, 9090)

☐ Setup SSL/TLS:
  - Generate real certificates (not self-signed for production)
  - Configure in nginx.conf

☐ Database backups:
  - Daily automated backups
  - Test restore procedure

☐ Log retention:
  - Docker logs rotation configured
  - Old logs cleaned up
```

---

## 📱 MOBILE-FRIENDLY QUERIES (via API)

### Create Channel List (CSV)

```bash
# Export all channels as CSV
curl http://localhost:5000/api/v1/channels | python3 -c "
import json, csv, sys
data = json.load(sys.stdin)
writer = csv.DictWriter(sys.stdout, fieldnames=data['channels'][0].keys())
writer.writeheader()
writer.writerows(data['channels'])
" > channels.csv
```

### Count Issues

```bash
# Count by severity
curl -s http://localhost:5000/api/v1/alerts/active | \
  jq 'group_by(.severity) | map({severity: .[0].severity, count: length})'

# Most affected channels
curl -s http://localhost:5000/api/v1/alerts/active | \
  jq 'group_by(.channel_id) | sort_by(length) | reverse | map({channel_id: .[0].channel_id, alerts: length}) | .[0:10]'
```

---

## 🎓 TEAM ONBOARDING

### New DevOps Engineer

```
Day 1:
├─ Read: README_COMPLETE_PACKAGE.md (this repo overview)
├─ Read: 8_deployment_guide_complete.md (setup steps)
├─ Clone repo and deploy locally
└─ Verify all services running

Day 2:
├─ Study: 2_cms_api_flask.py (understand API)
├─ Practice: Create/update channels via API
├─ Understand: Database schema (init-db.sql)
└─ Backup/restore practice

Day 3:
├─ Study: 1_packager_monitor_service.py (monitor logic)
├─ Understand: Metrics types and calculations
├─ Learn: Prometheus query language
└─ Practice: Create custom dashboard

Day 4-5:
├─ Production deployment walkthrough
├─ Alert configuration and testing
├─ Incident response practice
└─ Handoff with team
```

### New NOC Operator

```
Day 1:
├─ Overview of Packager monitoring system
├─ Tour of Grafana dashboard
├─ Tour of React UI
└─ Understand alert severity levels

Day 2:
├─ Practice: Create new alert
├─ Practice: Acknowledge/resolve alert
├─ Practice: View channel details
└─ Learn: Escalation procedures

Day 3:
├─ Incident scenario 1: Low MOS alert
│  └─ Investigate → notify encoder team → wait for fix
├─ Incident scenario 2: Segment not found (404)
│  └─ Investigate → notify packager team
└─ Incident scenario 3: High latency
   └─ Investigate → notify CDN team

Day 4-5:
├─ Live monitoring with senior NOC
├─ Shadow for 8+ hours
├─ Go solo with backup available
└─ Certification ready
```

---

## 📞 ESCALATION TREE

```
CRITICAL ALERT
│
├─→ Acknowledged by NOC? 
│   YES: Continue below
│   NO: Wait 2 min, retry (2x)
│
├─→ Alert type?
│
├─ PACKAGER ALERT (HTTP 5xx, manifest 404, segment missing)
│  └─→ Page on-call Packager Engineer
│      If no response in 5 min → Page Packager Manager
│
├─ CDN ALERT (high latency, origin 5xx)
│  └─→ Page on-call CDN Engineer
│      If no response in 5 min → Page CDN Manager
│
├─ NETWORK ALERT (high packet loss, high jitter)
│  └─→ Page on-call Network Engineer
│      If no response in 5 min → Page Network Manager
│
├─ MONITORING ALERT (probe down, API 500)
│  └─→ Page on-call DevOps Engineer
│      If no response in 5 min → Page DevOps Manager
│
└─ UNKNOWN
   └─→ Page NOC Manager
       → Triage with senior engineers
```

---

## 🎯 SLA TARGETS

```
✓ Alert Detection Time:   < 1 minute from incident start
✓ Team Notification Time: < 2 minutes from alert
✓ Investigation Start:    < 5 minutes from alert
✓ CRITICAL Resolution:    < 15 minutes
✓ MAJOR Resolution:       < 30 minutes
✓ MINOR Resolution:       < 1 hour
✓ System Availability:    > 99.9% (packager + monitor)
✓ Metric Accuracy:        ± 5% (within baseline)
```

---

## 📝 DAILY LOG CHECKS

```bash
# Check for errors in past 24 hours
docker-compose logs --since 24h packager-monitor | grep ERROR
docker-compose logs --since 24h cms-api | grep ERROR
docker-compose logs --since 24h postgres | grep ERROR

# Summary of metrics collected
docker-compose exec influxdb influx query \
  'from(bucket:"packager_metrics") |> range(start: -24h) |> count()'

# Alert statistics
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring << EOF
  SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    severity,
    COUNT(*) as count
  FROM alerts
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY hour, severity
  ORDER BY hour DESC;
EOF
```

---

**Last Updated: 2025-01-13**
**Version: 1.0 Production**
**Status: Ready for Deployment ✅**

