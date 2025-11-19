# Inspector UI Dashboard - Access Guide

## 🎨 Web UI Dashboard

The Inspector monitoring system now has a **full-featured React web UI** deployed and running!

### 🌐 Access URL

```
http://localhost:8080
```

Open this URL in your web browser to access the Inspector Dashboard.

### 📊 Dashboard Features

The UI provides a comprehensive interface for monitoring and management:

#### 1. **Overview Tab**
- Active channels count
- 4K channels count
- Critical and major alerts
- Channel distribution by tier (charts)
- Alert severity breakdown (charts)
- Recent alerts list

#### 2. **Channels Tab**
- View all monitored channels
- Filter by tier (1, 2, 3)
- Filter by type (4K, HD/SD)
- Channel cards showing:
  - Channel name and code
  - Resolution, FPS, Codec
  - Tier level
  - Status (enabled/disabled)
  - 4K, HDR, Atmos badges
- Edit channel configuration
- View channel metrics

#### 3. **Inputs Tab** ⭐ **NEW**
- View all probe inputs (UDP, HTTP, HLS)
- Add new inputs via UI form
- Edit existing inputs
- Delete inputs
- View input information:
  - Input name and URL
  - Type (MPEGTS_UDP, HTTP, HLS, RTMP, SRT)
  - Port and protocol
  - Probe assignment
  - Primary/backup status
  - Enabled/disabled status
  - **Thumbnail/Snapshot preview** 📸
  - Last snapshot timestamp
- Refresh button for real-time updates

#### 4. **Alerts Tab**
- View active alerts
- Filter by severity (Critical, Major, Minor)
- Filter by acknowledgment status
- Acknowledge alerts
- Resolve alerts
- Alert details:
  - Timestamp
  - Channel
  - Alert type
  - Severity
  - Message
  - Status

#### 5. **Metrics Tab**
- Video MOS (Mean Opinion Score) trends
- Audio loudness (LUFS) trends
- Bitrate trends
- Real-time charts (last 60 seconds)

#### 6. **Debug Tab**
- System status
- Database connection status
- Record counts (channels, inputs, probes, alerts)
- Input debug information with snapshot status
- File existence verification
- Recent logs guidance

### 🎯 Quick Actions

#### Add a New Input (UDP Stream)

1. Go to **Inputs Tab**
2. Click **"+ Add New Input"**
3. Fill in the form:
   - Input Name: `VTV1 HD Input`
   - Input URL: `udp://225.3.3.42:30130`
   - Input Type: `MPEGTS_UDP`
   - Protocol: `udp`
   - Port: `30130`
   - Probe ID: `1`
   - Primary: `Yes`
   - Enabled: `Yes`
4. Click **"Create"**

The input will start being monitored and snapshots will be captured automatically!

#### View Input Details

1. Find the input in the **Inputs Tab**
2. Click **"Info"** button
3. View complete information including:
   - All configuration details
   - Metadata (if available)
   - Snapshot information
   - Timestamps

#### View Snapshot/Thumbnail

Snapshots are automatically displayed in the Inputs table as thumbnails. If a snapshot exists, you'll see a small preview image in the "Thumbnail" column.

### 🔄 Auto-Refresh

The dashboard automatically refreshes data every 30 seconds to keep information up-to-date.

### 🎨 UI Components

- **KPI Cards**: Quick metrics overview
- **Charts**: Bar charts and line charts for trends
- **Tables**: Sortable, filterable data tables
- **Modals**: Forms for adding/editing data
- **Badges**: Visual indicators for status and types
- **Color Coding**:
  - Green: Healthy/Success
  - Red: Critical/Error
  - Yellow: Warning
  - Blue: Info

### 🔧 Configuration

The UI connects to the CMS API backend running on port 5000. The API base URL is configured in the React app:

```javascript
const API_BASE = 'http://localhost:5000/api/v1';
```

### 📱 Responsive Design

The dashboard is responsive and works on:
- Desktop browsers (recommended)
- Tablets
- Mobile devices (limited functionality)

### 🚀 Technology Stack

- **Frontend**: React 18
- **Charts**: Recharts library
- **HTTP Client**: Fetch API
- **Styling**: Custom CSS
- **Server**: Nginx (containerized)

### 🔗 Related Services

The UI integrates with:

| Service | URL | Purpose |
|---------|-----|---------|
| **CMS API** | http://localhost:5000 | Backend REST API |
| **Grafana** | http://localhost:3000 | Advanced metrics dashboards |
| **Prometheus** | http://localhost:9090 | Metrics queries |
| **InfluxDB** | http://localhost:8086 | Time-series data |

### 🐛 Troubleshooting

#### UI not loading

```bash
# Check container status
docker ps | grep inspector-ui

# Check logs
docker logs inspector-ui

# Restart UI
docker-compose -f docker-compose.prod.yml --env-file .env.production.local restart ui-dashboard
```

#### API connection errors

```bash
# Verify CMS API is running
curl http://localhost:5000/api/v1/health

# Check logs
docker logs inspector-cms-api

# Restart API
docker-compose -f docker-compose.prod.yml --env-file .env.production.local restart cms-api
```

#### Snapshots not showing

```bash
# Check snapshot directory
ls -la /tmp/inspector_snapshots/

# Check monitor service logs
docker logs inspector-monitor | grep -i snapshot

# Verify ffmpeg is available
docker exec inspector-monitor which ffmpeg
```

### 📚 Documentation

- **Full API Documentation**: See CMS API endpoints documentation
- **Deployment Guide**: `README-PRODUCTION.md`
- **Deployment Status**: `DEPLOYMENT_STATUS.md`

### 🎉 Summary

Your **Inspector UI Dashboard** is now fully deployed and accessible at:

## **http://localhost:8080**

Start monitoring your streams with the intuitive web interface! 🚀

---

**Last Updated**: November 18, 2025
