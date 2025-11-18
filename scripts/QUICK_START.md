# Inspector Phase 1 - Quick Start Guide

## 🚀 5-Minute Setup (TL;DR)

### Central Server
```bash
# 1. Clone repo
cd /opt
git clone https://github.com/thang86/Inspector.git
cd Inspector

# 2. Run setup script
chmod +x scripts/setup_central_server.sh
sudo ./scripts/setup_central_server.sh

# 3. Access UI
http://YOUR_SERVER_IP
```

### Packager Servers
```bash
# 1. Clone repo
cd /opt
git clone https://github.com/thang86/Inspector.git
cd Inspector

# 2. Run setup script
chmod +x scripts/setup_packager_monitor.sh
sudo ./scripts/setup_packager_monitor.sh

# 3. Check logs
tail -f /var/log/inspector-monitor.log
```

---

## 📋 Pre-Deployment Checklist

### Central Server Requirements
- [ ] Ubuntu 20.04+ or CentOS 8+
- [ ] 4 CPU cores minimum
- [ ] 8GB RAM minimum
- [ ] 100GB disk space
- [ ] Static IP address
- [ ] Ports 80, 5000, 5432, 8086 accessible

### Packager Server Requirements
- [ ] Ubuntu 20.04+ or CentOS 8+
- [ ] 2 CPU cores minimum
- [ ] 4GB RAM minimum
- [ ] 20GB disk space
- [ ] Network access to multicast groups
- [ ] Network access to central server
- [ ] ffmpeg installed

### Network Requirements
- [ ] Multicast routing configured
- [ ] Firewall rules allow:
  - PostgreSQL (5432): packager → central
  - InfluxDB (8086): packager → central
  - HTTP (80): operators → central
- [ ] DNS or /etc/hosts entries configured

---

## 🎯 Deployment Steps

### Step 1: Prepare Central Server (30 minutes)

1. **Clone repository**
   ```bash
   sudo su
   cd /opt
   git clone https://github.com/thang86/Inspector.git
   cd Inspector
   ```

2. **Run setup script**
   ```bash
   chmod +x scripts/*.sh
   ./scripts/setup_central_server.sh
   ```

   You'll be prompted for:
   - PostgreSQL password (store securely!)
   - InfluxDB URL (default: http://localhost:8086)
   - InfluxDB token
   - Server hostname/IP

3. **Setup InfluxDB**
   - Open http://YOUR_SERVER:8086
   - Create organization: `fpt-play`
   - Create bucket: `packager_metrics`
   - Create API token
   - Save token securely

4. **Verify services**
   ```bash
   systemctl status postgresql
   systemctl status influxdb
   systemctl status inspector-api
   systemctl status nginx
   ```

5. **Test API**
   ```bash
   curl http://localhost:5000/api/v1/health
   # Expected: {"status":"healthy","database":"connected"}
   ```

6. **Access Web UI**
   - Open http://YOUR_SERVER in browser
   - Should see Inspector Dashboard loading

### Step 2: Deploy on First Packager (20 minutes)

1. **SSH to packager server**
   ```bash
   ssh user@packager-01
   sudo su
   ```

2. **Clone repository**
   ```bash
   cd /opt
   git clone https://github.com/thang86/Inspector.git
   cd Inspector
   ```

3. **Run setup script**
   ```bash
   chmod +x scripts/setup_packager_monitor.sh
   ./scripts/setup_packager_monitor.sh
   ```

   You'll be prompted for:
   - Central server IP/hostname
   - PostgreSQL password
   - InfluxDB token
   - Packager URL (usually http://localhost:8080)

4. **Verify service**
   ```bash
   systemctl status inspector-monitor
   tail -f /var/log/inspector-monitor.log
   ```

   You should see:
   - "Starting Packager Monitor Service"
   - "Connected to database successfully"
   - "Fetched N inputs from database"

### Step 3: Add First Input (5 minutes)

1. **Via Web UI**
   - Go to http://YOUR_CENTRAL_SERVER
   - Click "Inputs" tab
   - Click "+ Add New Input"
   - Fill in:
     - Name: HBO
     - URL: udp://225.3.3.42:30130
     - Type: MPEGTS_UDP
     - Protocol: udp
     - Port: 30130
     - Probe ID: 1
     - Enabled: ✓
   - Click "Create"

2. **Via API**
   ```bash
   curl -X POST http://YOUR_CENTRAL_SERVER:5000/api/v1/inputs \
     -H "Content-Type: application/json" \
     -d '{
       "input_name": "HBO",
       "input_url": "udp://225.3.3.42:30130",
       "input_type": "MPEGTS_UDP",
       "input_protocol": "udp",
       "input_port": 30130,
       "probe_id": 1,
       "enabled": true
     }'
   ```

### Step 4: Verify Monitoring (10 minutes)

1. **Check packager logs**
   ```bash
   tail -f /var/log/inspector-monitor.log
   ```

   Within 30 seconds you should see:
   ```
   INFO - Probing UDP stream HBO at 225.3.3.42:30130
   INFO - UDP probe successful for HBO: 100 packets, 132160 bytes, 700 TS packets, 5.23 Mbps
   INFO - Captured snapshot for HBO: /tmp/inspector_snapshots/input_1_1234567890.jpg
   ```

2. **Check snapshot directory**
   ```bash
   ls -lh /tmp/inspector_snapshots/
   # Should see .jpg files after 60 seconds
   ```

3. **Check Web UI**
   - Go to "Inputs" tab
   - Should see HBO input with thumbnail
   - Click "Info" button to see details
   - Go to "Debug" tab
   - Check system status and input details

4. **Check InfluxDB metrics**
   ```bash
   # Query metrics via InfluxDB UI
   # http://YOUR_CENTRAL_SERVER:8086
   # Query: from(bucket: "packager_metrics") |> range(start: -5m)
   ```

---

## 🐛 Troubleshooting

### Issue: Monitor can't connect to database

**Symptoms:**
```
ERROR - Failed to connect to database: connection refused
```

**Solution:**
```bash
# On central server, edit PostgreSQL config
sudo nano /etc/postgresql/13/main/postgresql.conf
# Change: listen_addresses = '*'

sudo nano /etc/postgresql/13/main/pg_hba.conf
# Add: host all all PACKAGER_IP/32 md5

sudo systemctl restart postgresql

# Test from packager
telnet CENTRAL_SERVER 5432
```

### Issue: UDP multicast not working

**Symptoms:**
```
WARNING - UDP probe failed for HBO: 0 packets received
```

**Solution:**
```bash
# Check multicast route
ip route show | grep 224

# Add multicast route
sudo ip route add 224.0.0.0/4 dev eth0

# Make permanent
echo "up ip route add 224.0.0.0/4 dev eth0" | sudo tee -a /etc/network/interfaces

# Verify receiving multicast
sudo tcpdump -i eth0 host 225.3.3.42 and port 30130 -c 10
```

### Issue: Snapshots not captured

**Symptoms:**
- No .jpg files in /tmp/inspector_snapshots/
- Logs show "Failed to capture snapshot"

**Solution:**
```bash
# Test ffmpeg manually
ffmpeg -i udp://225.3.3.42:30130 -frames:v 1 -q:v 2 -t 3 /tmp/test.jpg

# If fails, check:
# 1. UDP stream is accessible (see above)
# 2. ffmpeg is installed
ffmpeg -version

# 3. Permissions
ls -la /tmp/inspector_snapshots/
sudo chown inspector:inspector /tmp/inspector_snapshots/
```

### Issue: Web UI not loading

**Symptoms:**
- Browser shows "Connection refused" or blank page

**Solution:**
```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Verify files exist
ls -la /opt/Inspector/3_react_dashboard.*

# Restart Nginx
sudo systemctl restart nginx
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Central server accessible via web browser
- [ ] API health check returns OK
- [ ] PostgreSQL accepts connections
- [ ] InfluxDB is running
- [ ] At least 1 packager monitor is running
- [ ] At least 1 input is configured
- [ ] Monitor logs show successful UDP probes
- [ ] Snapshots are being captured
- [ ] Web UI shows inputs in table
- [ ] Debug tab shows system status
- [ ] No critical errors in logs for 10 minutes

---

## 📊 Expected Metrics

After 5 minutes of operation, you should see:

### In Web UI
- **Inputs tab**: HBO input with green "Enabled" badge
- **Inputs tab**: Thumbnail showing actual video frame
- **Debug tab**: System status "OK"
- **Debug tab**: 1 channel, 1 input, 1 probe

### In Logs
```
INFO - Starting Packager Monitor Service
INFO - Connected to database successfully
INFO - Fetched 1 inputs from database
INFO - Probing UDP stream HBO at 225.3.3.42:30130
INFO - UDP probe successful for HBO: 100 packets, 132160 bytes, 700 TS packets, 5.23 Mbps
INFO - Captured snapshot for HBO: /tmp/inspector_snapshots/input_1_1234567890.jpg
INFO - Updated snapshot for input 1
INFO - Pushed UDP probe metric for HBO: 5.23 Mbps
```

### In Database
```sql
-- Check inputs
SELECT input_id, input_name, enabled, last_snapshot_at FROM inputs;

-- Check probes
SELECT probe_id, probe_name, location FROM probes;
```

---

## 🔄 Next Steps

After successful Phase 1 deployment:

1. **Add More Inputs**
   - Configure all production MPEGTS_UDP streams
   - Add HLS/DASH output monitoring

2. **Setup Alerting** (Phase 2)
   - Configure alert thresholds
   - Setup Telegram/Email notifications

3. **Deploy to More Packagers**
   - Repeat Step 2 for packager-02, packager-03, etc.
   - Update probe_id for each server

4. **Monitor Performance**
   - Watch InfluxDB metrics
   - Optimize snapshot capture frequency
   - Adjust polling intervals

5. **Train Team**
   - Show operators how to use Web UI
   - Document incident response procedures
   - Create runbooks for common issues

---

## 📞 Support

**Logs Locations:**
- CMS API: `journalctl -u inspector-api -f`
- Monitor: `/var/log/inspector-monitor.log`
- Nginx: `/var/log/nginx/error.log`
- PostgreSQL: `/var/log/postgresql/postgresql-*.log`

**Configuration Files:**
- Central API: `/opt/Inspector/api_config.env`
- Monitor: `/opt/Inspector/monitor_config.env`
- Nginx: `/etc/nginx/sites-available/inspector`

**Useful Commands:**
```bash
# Restart services
sudo systemctl restart inspector-api
sudo systemctl restart inspector-monitor
sudo systemctl restart nginx

# Check service status
sudo systemctl status inspector-api
sudo systemctl status inspector-monitor

# View logs
tail -f /var/log/inspector-monitor.log
journalctl -u inspector-api -f -n 100

# Test database
sudo -u postgres psql fpt_play_monitoring -c "SELECT * FROM v_active_inputs;"

# Test API
curl http://localhost:5000/api/v1/health
curl http://localhost:5000/api/v1/debug/system
```

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
