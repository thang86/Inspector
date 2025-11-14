# INSPECTOR LIVE MULTI-LAYER PROBE - DEPLOYMENT GUIDE

## I. QUICK START

### 1.1 Hardware Requirements

```
L1 Headend Probe:
├─ CPU: Intel Xeon 6-core (2.5GHz+)
├─ RAM: 16GB
├─ Storage: 500GB SSD
├─ Network: 2x 10Gbps Ethernet (1 for TS input, 1 for management)
├─ OS: Linux (Ubuntu 20.04 LTS, CentOS 8)
└─ Physical: 1U rack mount

L2 Packager Probe:
├─ CPU: Intel i7/Xeon 4-core
├─ RAM: 8GB
├─ Storage: 256GB SSD
├─ Network: 1x 10Gbps (HTTP traffic monitoring)
└─ Physical: 1U rack mount

L3 CDN Core Probe:
├─ CPU: Xeon 8-core (redundant pair recommended)
├─ RAM: 16GB
├─ Storage: 1TB SSD
├─ Network: 2x 10Gbps
└─ Physical: 2U (active-active setup)

L4 Edge POPs (×4):
├─ CPU: i7 4-core (minimal load)
├─ RAM: 8GB
├─ Storage: 256GB SSD
└─ Network: Existing POP network
```

### 1.2 Network Configuration

```yaml
L1 (Headend):
  network:
    vlan: 100              # Encoder VLAN
    multicast_group: 239.0.0.1/32
    multicast_interface: eth0
    management_interface: eth1
    management_vlan: 10
    dns: 8.8.8.8

L2 (Packager):
  network:
    vlan: 200              # Packager/CDN VLAN
    http_sniff_port: 80, 443
    management_interface: eth1
    management_vlan: 10

L3 (CDN Core):
  network:
    vlan: 300              # Origin/MidCache VLAN
    http_sniff_ports: 80, 443, 8080
    api_interface: eth0 (10.0.0.0/8)
    management_interface: eth1
    vrrp_vip: 10.0.0.10   # Virtual IP for redundancy

L4 (Edge POPs):
  network:
    vlan: 400 + POP_ID
    http_sniff_ports: 80, 443
    management_interface: mgmt VLAN per region
```

---

## II. INSTALLATION STEPS

### 2.1 Build Rust Probe from Source

```bash
# Clone or download probe-rs code
git clone https://github.com/company/probe-inspector-live.git
cd probe-inspector-live

# Install Rust (if not already)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Build release binary (optimized for production)
RUSTFLAGS="-C target-cpu=native -C opt-level=3" cargo build --release

# Binary location
ls -lh target/release/probe-rs
# -rw-r--r-- 1 user 45M probe-rs
```

### 2.2 Deploy Binaries

```bash
# Copy to probe hardware
scp target/release/probe-rs user@headend-probe-01:/opt/probe-rs/bin/

# Create service structure
sudo mkdir -p /opt/probe-rs/{bin,config,logs,data}
sudo chown -R probe:probe /opt/probe-rs/

# Set executable
sudo chmod +x /opt/probe-rs/bin/probe-rs
```

### 2.3 Systemd Service Setup

```ini
# /etc/systemd/system/probe-rs-l1.service
[Unit]
Description=Inspector LIVE L1 Headend Probe
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=probe
ExecStart=/opt/probe-rs/bin/probe-rs --layer L1 --config /etc/probe-rs/l1_config.yaml
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable probe-rs-l1.service
sudo systemctl start probe-rs-l1.service

# Check status
sudo systemctl status probe-rs-l1.service
sudo journalctl -u probe-rs-l1.service -f
```

---

## III. CONFIGURATION FILES

### 3.1 L1 Headend Config (YAML)

```yaml
# /etc/probe-rs/l1_config.yaml

probe:
  id: "HEADEND-MUMBAI-01"
  layer: "L1"
  stream_id_prefix: "CH_"

input:
  type: "multicast"
  address: "239.0.0.1"
  port: 5000
  interface: "eth0"
  buffer_mb: 100
  rtp_enabled: false

analyzers:
  tr101290:
    enabled: true
    priority_levels: [1, 2, 3]
  
  video:
    enabled: true
    codec_check: true
    mos_sampling: 1.0           # Check every frame
    macroblocking_threshold: 0.15
    freeze_detection: true
    black_detection: true
  
  audio:
    enabled: true
    loudness_target_lufs: -23.0
    loudness_tolerance_db: 2.0
    silence_detection: true
    silence_threshold_db: -80
  
  hdr:
    enabled: true
    monitor_sei: true
    check_max_cll: true
    check_max_fall: true
  
  atmos:
    enabled: true
    monitor_joc: true
    object_count_expected: 16
  
  signaling:
    scte35_enabled: true
    caption_enabled: true
    nit_sdt_check: true

thresholds:
  video:
    mos_critical: 2.0
    mos_major: 3.0
    mos_warning: 3.5
    macroblocking_critical: 0.30
    macroblocking_major: 0.20
    macroblocking_warning: 0.15
  
  audio:
    loudness_critical_under: -26.0
    loudness_critical_over: -20.0
    loudness_major_under: -25.0
    loudness_major_over: -21.0
  
  ts:
    pcr_drift_critical_us: 2000
    pcr_drift_major_us: 1000
    pcr_drift_warning_us: 500

output:
  influxdb:
    enabled: true
    url: "http://metrics-db.company.com:8086"
    database: "broadcast_metrics"
    batch_size: 100
    flush_interval_sec: 30
  
  prometheus:
    enabled: true
    listen_addr: "0.0.0.0"
    listen_port: 9090
  
  snmp_traps:
    enabled: true
    nms_host: "192.168.1.100"
    nms_port: 162
    community: "trapwrite"
    enterprise_oid: "1.3.6.1.4.1.37211.100"
  
  ivms:
    enabled: true
    api_url: "https://ivms.company.com/api/v2"
    api_key: "${IVMS_API_KEY}"
    push_interval_sec: 60
    metrics:
      - tr101290
      - video_mos
      - audio_loudness
      - hdr_events
      - atmos_metadata
  
  rest_api:
    enabled: true
    listen_addr: "0.0.0.0"
    listen_port: 8080
    enable_metrics: true
    enable_websocket: true

logging:
  level: "INFO"
  format: "json"
  file: "/var/log/probe-rs/l1.log"
  max_size_mb: 100
  retain_days: 30
  syslog: true
  syslog_host: "logging-server.company.com"
```

### 3.2 L2 Packager Config

```yaml
# /etc/probe-rs/l2_config.yaml

probe:
  id: "PACKAGER-HCMC-01"
  layer: "L2"

input:
  type: "http"
  listen_addr: "0.0.0.0"
  listen_port: 80, 443
  ssl_cert: "/etc/probe-rs/certs/packager.crt"
  ssl_key: "/etc/probe-rs/certs/packager.key"

manifest_monitoring:
  hls_enabled: true
  dash_enabled: true
  manifest_poll_interval_ms: 500
  manifest_timeout_sec: 10

abr_validation:
  enabled: true
  expected_rungs: 7
  bitrate_order_check: true
  bitrate_gap_max_percent: 100
  segment_duration_tolerance_percent: 5

segment_analysis:
  enabled: true
  continuity_check: true
  latency_measure: true
  fetch_timeout_sec: 30

ebp_validation:
  enabled: true
  sap_type_check: true
  timing_alignment_tolerance_ms: 100

fmp4_validation:
  enabled: true
  box_structure_check: true
  sample_flag_validation: true

drm:
  enabled: true
  widevine_monitoring: true
  playready_monitoring: true
  fairplay_monitoring: true
  key_rotation_interval_sec: 3600

output:
  influxdb:
    enabled: true
    url: "http://metrics-db.company.com:8086"
    database: "broadcast_metrics"
  
  snmp_traps:
    enabled: true
    nms_host: "192.168.1.100"
    nms_port: 162

logging:
  level: "INFO"
  file: "/var/log/probe-rs/l2.log"
```

### 3.3 Alert Thresholds Config

```yaml
# /etc/probe-rs/alert_thresholds.yaml

alerts:
  critical:
    # TR 101 290 P1 (Service Outage)
    - TS_SYNC_LOSS: 1              # Any occurrence = critical
    - PAT_ERROR: 1
    - PMT_ERROR: 1
    - AUDIO_SILENCE: 1
    - LOUDNESS_CRITICAL: true
    - HDR_METADATA_MISSING: 2      # 2 consecutive frames
    - DRM_LICENSE_FAILURE: 1
    
    # Network
    - PACKET_LOSS_PERCENT: 5.0
    - MDI: 4.0
  
  major:
    # TR 101 290 P2
    - PCR_DRIFT_US: 1000
    - PTS_DTS_INVERSION: 1
    - CRC_ERROR: 10
    
    # Video Quality
    - VIDEO_MOS: 3.0
    - MACROBLOCKING_RATIO: 0.20
    - FREEZE_FRAME: 1              # Any freeze
    
    # Audio
    - LOUDNESS_MAJOR: true
    - STEREO_PHASE_ERROR: 0.95
    
    # Signaling
    - SCTE35_MISSING: 5
    - CAPTION_ERROR: 10
    
    # Manifest
    - ABR_LADDER_INCONSISTENT: 0.8  # Consistency score < 0.8
    - SEGMENT_GAP: 1
  
  minor:
    - PCR_DRIFT_US: 500
    - BITRATE_DRIFT_PERCENT: 10
    - P3_ERRORS: 50

persistence:
  require_consecutive_violations: 3  # Alert if 3 consecutive violations
  clear_after_ok_sec: 300            # Clear alert if OK for 5 minutes

routing:
  critical:
    methods: [email, snmp, pagerduty, slack]
    recipients:
      email: [noc@company.com, ops@company.com]
      slack: "#alerts-critical"
      pagerduty_service_id: "abc123"
  
  major:
    methods: [email, snmp, slack]
    recipients:
      email: [ops@company.com]
      slack: "#alerts-major"
  
  minor:
    methods: [slack, ivms]
    recipients:
      slack: "#alerts-minor"
```

---

## IV. INTEGRATION EXAMPLES

### 4.1 SNMP Trap Setup (Zabbix)

```
Zabbix Configuration Steps:

1. Add SNMP OID Mapping:
   Administration → Data types → SNMP traps
   
   Add entries:
   - OID: 1.3.6.1.4.1.37211.100.1
     Name: inspector_live_video_mos_low
   
   - OID: 1.3.6.1.4.1.37211.100.8
     Name: inspector_live_ts_sync_loss
     Action: Trigger severity CRITICAL

2. Create Trigger:
   {host:snmp.get[1.3.6.1.4.1.37211.100.8]} > 0
   → Severity: CRITICAL
   → Action: Page on-call engineer

3. Test:
   echo "Test Trap" | snmptrap -v 2c -c trapwrite 192.168.1.100:162 \
     1.3.6.1.4.1.37211.100 1.3.6.1.4.1.37211.100.8 i 1
```

### 4.2 iVMS 5.x Integration

```bash
# 1. Get iVMS API Token
curl -X POST https://ivms.company.com/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"probe_api","password":"****"}'

# Response: {"token": "eyJ0eXAi..."}

# 2. Push metrics to iVMS
curl -X POST https://ivms.company.com/api/v2/metrics/inspector-live \
  -H "Authorization: Bearer eyJ0eXAi..." \
  -H "Content-Type: application/json" \
  -d '{
    "probe_id": "HEADEND-01",
    "layer": "L1",
    "timestamp": "2025-01-13T15:30:00Z",
    "metrics": {
      "tr101290_p1_errors": 0,
      "video_mos": 4.2,
      "audio_loudness_lufs": -22.5,
      "macroblocking_ratio": 0.08
    }
  }'

# 3. iVMS Dashboard shows:
#    - Real-time MOS score per channel
#    - Color-coded status (Green/Yellow/Red)
#    - Drill-down by stream, time, error type
```

### 4.3 InfluxDB Setup for Metrics

```bash
# Create InfluxDB database
influx cli database create --name broadcast_metrics

# Create retention policy
influx cli retention create \
  --name 30_days \
  --duration 30d \
  --shard-duration 24h \
  --org company

# Create bucket for Grafana
influx bucket create \
  --name broadcast_metrics \
  --org company \
  --retention 30d

# Verify data ingestion
influx query 'from(bucket:"broadcast_metrics") |> range(start:-1h)'
```

### 4.4 Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Inspector LIVE Multi-Layer Monitoring",
    "panels": [
      {
        "title": "Video MOS (L1)",
        "targets": [
          {
            "expr": "probe_video_mos{layer=\"L1\"}"
          }
        ]
      },
      {
        "title": "MDI - Network Quality (L3/L4)",
        "targets": [
          {
            "expr": "probe_mdi{layer=~\"L3|L4\"}"
          }
        ]
      },
      {
        "title": "Audio Loudness (L1)",
        "targets": [
          {
            "expr": "probe_audio_loudness_lufs{layer=\"L1\"}"
          }
        ]
      },
      {
        "title": "Alarms Timeline",
        "targets": [
          {
            "expr": "increase(probe_alarms_total[5m])"
          }
        ]
      }
    ]
  }
}
```

---

## V. OPERATIONAL PROCEDURES

### 5.1 Daily NOC Checklist

```
08:00 AM - Shift Start:
□ Log into iVMS dashboard (https://ivms.company.com)
□ Check alarm count overnight (Critical/Major)
□ Review top 5 alarms
□ Cross-check L1 vs L4 metrics
  - If Critical alarm on L1 but not L4 → upstream issue
  - If Critical alarm on L4 but not L1 → CDN/network issue
□ Check Grafana panels for trends
□ Review metrics DB storage usage
□ Confirm SNMP traps reaching NMS

Ongoing:
□ Monitor real-time dashboards
□ Check email/Slack alerts
□ Respond to escalations
□ Log incidents in ticket system

16:00 - Shift End:
□ Generate hourly/daily reports
□ Archive logs for long-term storage
□ Brief next shift
□ Check if any anomalies detected overnight
```

### 5.2 Alert Response Playbook

**Scenario 1: TR 101 290 P1 Error (TS Sync Loss)**

```
ALERT: TS_SYNC_LOSS on CH001 (L1)
Severity: CRITICAL

Immediate Actions (0-5 min):
1. Page on-call engineer
2. Verify alert (not false positive)
   - Check SNMP trap received
   - Check iVMS shows same error
3. Identify scope:
   - Single channel → Encoder issue
   - All channels → Network/multicast issue
4. Check encoder logs
5. Check network interface errors

Troubleshooting (5-15 min):
1. Pull 10-min PCAP from probe
   sudo tcpdump -i eth0 -c 100000 -w /tmp/capture.pcap

2. Inspect TS packets
   ffprobe -i /tmp/capture.pcap

3. Check encoder
   - Restart PCR clock
   - Verify TS output bitrate
   - Check encoder CPU usage

4. Restore Service:
   - Restart encoder output
   - Monitor for 5 minutes
   - Verify TR 101 290 P1 errors clear

Post-Incident:
- Document RCA in ticket
- Update alert threshold if false positive
- Schedule preventive maintenance
```

**Scenario 2: HDR Metadata Missing (L1)**

```
ALERT: HDR_METADATA_MISSING on CH_4K_HDR (L1)
Severity: MAJOR

Investigation:
1. Confirm 4K content is being encoded
2. Verify HEVC Main10 profile is enabled on encoder
3. Check SEI (Supplemental Enhancement Info) emission
4. Verify fMP4 box contains HDR metadata
5. Check if packager strips SEI during packaging
6. Check CDN cache doesn't corrupt SEI

Resolution:
- Encoder: Enable HDR metadata injection
- Packager: Verify SEI preservation config
- CDN: Clear cache for affected stream
```

---

## VI. TROUBLESHOOTING

### 6.1 Probe Won't Start

```
symptom: systemctl start probe-rs-l1.service fails

Solution:
1. Check logs:
   sudo journalctl -u probe-rs-l1.service -n 50
   
2. Check config syntax:
   probe-rs --validate-config /etc/probe-rs/l1_config.yaml
   
3. Check network connectivity:
   ping 239.0.0.1  # Multicast address
   sudo ip route add 239.0.0.0/24 via eth0
   
4. Check permissions:
   ls -l /opt/probe-rs/bin/probe-rs
   sudo chown probe:probe /opt/probe-rs/bin/probe-rs
```

### 6.2 High CPU Usage

```
symptom: probe-rs consuming 50%+ CPU

Diagnosis:
1. Check number of streams:
   ss -u | grep 239.0.0.1 | wc -l
   
2. Profile CPU usage:
   perf record -p $(pgrep probe-rs) -g -- sleep 10
   perf report
   
3. Check buffer settings:
   grep buffer_mb /etc/probe-rs/l1_config.yaml

Solution:
- Reduce sample rate (every frame → every 10 frames)
- Disable non-essential analyzers
- Increase buffer to reduce packet loss
- Upgrade hardware if necessary
```

### 6.3 Metrics Not Appearing in InfluxDB

```
Diagnosis:
1. Check connectivity:
   curl http://metrics-db.company.com:8086/ping
   
2. Check database exists:
   influx bucket list --org company
   
3. Check probe can reach InfluxDB:
   curl -X POST http://metrics-db.company.com:8086/api/v2/write \
     -H "Authorization: Token $INFLUX_TOKEN" \
     -H "Content-Type: text/plain" \
     -d 'test,host=server01 value=42'

Solution:
- Verify API URL and auth token
- Check firewall rules
- Restart probe: systemctl restart probe-rs-l1
```

---

## VII. BACKUP & RECOVERY

### 7.1 Configuration Backup

```bash
# Daily config backup
#!/bin/bash
BACKUP_DIR="/backups/probe-rs"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR/$DATE
cp -r /etc/probe-rs $BACKUP_DIR/$DATE/
tar -czf $BACKUP_DIR/probe-rs-config-$DATE.tar.gz $BACKUP_DIR/$DATE/

# Push to S3
aws s3 cp $BACKUP_DIR/probe-rs-config-$DATE.tar.gz s3://backup-bucket/
```

### 7.2 Disaster Recovery

```bash
# Restore from backup
tar -xzf probe-rs-config-20250113.tar.gz
sudo cp -r etc/probe-rs/* /etc/probe-rs/
sudo systemctl restart probe-rs-l1.service
```

---

## VIII. CAPACITY PLANNING

```
Per L1 Probe:
├─ Max streams: 100 (HEVC 1080p30 @ 5Mbps)
├─ CPU: 5-10% per stream
├─ Memory: 50MB base + 10MB per stream
├─ Network: 1Gbps multicast recommended
└─ Storage (logs): 1-5GB/day

Per L2 Probe:
├─ Max ABR rungs monitored: 50
├─ Max renditions: 200
└─ Bandwidth: 10Gbps recommended

Scaling:
- >50 streams on L1 → Deploy L1 probe cluster (2-3 probes)
- >10 channels on L2 → Consider dedicated packager probe
- L3/L4 → 1 per region minimum
```

---

## IX. CONTACT & SUPPORT

```
Telestream Support:
- Phone: +1-800-XXX-XXXX
- Email: support@telestream.net
- Portal: https://support.telestream.net

Company NOC:
- Email: noc@company.com
- Phone: +84-24-XXXX-XXXX
- Slack: #noc-support

Escalation:
- Network: network-team@company.com
- Encoder Ops: encoder-ops@company.com
- CDN Ops: cdn-ops@company.com
```

