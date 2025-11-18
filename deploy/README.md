# Inspector Monitoring Server - Dev Deployment

Triển khai monitoring server cho môi trường development.

## 📋 Tổng quan

Stack monitoring bao gồm:
- **PostgreSQL**: Database lưu trữ cấu hình channels, inputs, alerts
- **InfluxDB**: Time-series database cho metrics
- **CMS API (Flask)**: REST API quản lý cấu hình
- **Packager Monitor**: Service giám sát HLS/DASH segments và UDP inputs
- **Grafana**: Dashboard visualization

## 🚀 Quick Start

### Yêu cầu hệ thống
- Docker 20.10+
- Docker Compose 1.29+
- 8GB RAM khả dụng
- 20GB disk space

### Deploy trong 1 lệnh

```bash
cd deploy
./deploy-dev.sh
```

Script sẽ tự động:
1. Kiểm tra prerequisites
2. Tạo thư mục snapshot
3. Build và start tất cả services
4. Kiểm tra health của các services
5. Hiển thị thông tin truy cập

## 📦 Services & Ports

| Service | Port | Credentials | Description |
|---------|------|-------------|-------------|
| CMS API | 5000 | N/A | REST API for management |
| Grafana | 3000 | admin/admin | Dashboard & visualization |
| InfluxDB | 8086 | admin/admin_password_123 | Time-series metrics |
| PostgreSQL | 5432 | monitor_app/dev_password_123 | Configuration database |

## 🔧 Quản lý Services

### Xem logs
```bash
# Tất cả services
docker-compose -f docker-compose.dev.yml logs -f

# Service cụ thể
docker-compose -f docker-compose.dev.yml logs -f cms-api
docker-compose -f docker-compose.dev.yml logs -f packager-monitor
```

### Stop services
```bash
docker-compose -f docker-compose.dev.yml down
```

### Restart service
```bash
docker-compose -f docker-compose.dev.yml restart packager-monitor
```

### Rebuild services
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

## 🧪 Testing

### Kiểm tra API health
```bash
curl http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T10:30:45.123456",
  "database": "connected"
}
```

### Kiểm tra database
```bash
docker-compose -f docker-compose.dev.yml exec postgres \
  psql -U monitor_app -d fpt_play_monitoring -c "SELECT COUNT(*) FROM probes;"
```

### Lấy danh sách probes
```bash
curl http://localhost:5000/api/v1/probes | jq
```

### Lấy danh sách inputs
```bash
curl http://localhost:5000/api/v1/inputs | jq
```

## 📝 API Examples

### Tạo Input (MPEGTS UDP)
```bash
curl -X POST http://localhost:5000/api/v1/inputs \
  -H "Content-Type: application/json" \
  -d '{
    "input_name": "VTV1 HD Input",
    "input_url": "udp://225.3.3.42:30130",
    "input_type": "MPEGTS_UDP",
    "input_protocol": "udp",
    "input_port": 30130,
    "probe_id": 1,
    "is_primary": true,
    "enabled": true,
    "bitrate_mbps": 8.0
  }'
```

### Tạo Channel
```bash
curl -X POST http://localhost:5000/api/v1/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channel_code": "VTV1_HD",
    "channel_name": "VTV1 HD",
    "channel_type": "LIVE",
    "tier": 1,
    "codec": "H.264",
    "resolution": "1920x1080",
    "fps": 25,
    "is_4k": false,
    "is_hdr": false,
    "probe_id": 1,
    "input_url": "udp://225.3.3.42:30130",
    "template_id": 1,
    "enabled": true
  }'
```

### Lấy thông tin Input với snapshot
```bash
# Xem input details
curl http://localhost:5000/api/v1/inputs/1 | jq

# Lấy snapshot image
curl http://localhost:5000/api/v1/inputs/1/snapshot -o snapshot.jpg
```

### Debug endpoints
```bash
# Kiểm tra system status
curl http://localhost:5000/api/v1/debug/system | jq

# Xem tất cả inputs với snapshot status
curl http://localhost:5000/api/v1/debug/inputs | jq
```

## 🔍 Troubleshooting

### Service không start
```bash
# Kiểm tra logs
docker-compose -f docker-compose.dev.yml logs cms-api
docker-compose -f docker-compose.dev.yml logs postgres

# Kiểm tra container status
docker-compose -f docker-compose.dev.yml ps
```

### Database connection issues
```bash
# Kiểm tra PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres pg_isready

# Connect vào database
docker-compose -f docker-compose.dev.yml exec postgres \
  psql -U monitor_app -d fpt_play_monitoring

# Xem tables
\dt

# Xem dữ liệu
SELECT * FROM probes;
SELECT * FROM inputs;
```

### InfluxDB issues
```bash
# Kiểm tra InfluxDB
docker-compose -f docker-compose.dev.yml exec influxdb influx ping

# List buckets
docker-compose -f docker-compose.dev.yml exec influxdb \
  influx bucket list --token dev_influxdb_token_12345
```

### Packager Monitor không nhận data
```bash
# Xem logs chi tiết
docker-compose -f docker-compose.dev.yml logs -f packager-monitor

# Kiểm tra kết nối database
docker-compose -f docker-compose.dev.yml exec packager-monitor \
  python -c "import psycopg2; print('OK')"
```

### Snapshots không được tạo
```bash
# Kiểm tra thư mục snapshots
ls -la /tmp/inspector_snapshots/

# Kiểm tra ffmpeg trong container
docker-compose -f docker-compose.dev.yml exec packager-monitor ffmpeg -version

# Xem logs snapshot capture
docker-compose -f docker-compose.dev.yml logs packager-monitor | grep -i snapshot
```

## 🗄️ Data Persistence

Dữ liệu được lưu trong Docker volumes:
- `inspector-postgres-dev`: PostgreSQL data
- `inspector-influxdb-dev`: InfluxDB data
- `inspector-grafana-dev`: Grafana dashboards & settings

### Backup database
```bash
# PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres \
  pg_dump -U monitor_app fpt_play_monitoring > backup-$(date +%Y%m%d).sql

# Restore
docker-compose -f docker-compose.dev.yml exec -T postgres \
  psql -U monitor_app fpt_play_monitoring < backup-20250114.sql
```

### Xóa tất cả data (reset)
```bash
# Stop và xóa volumes
docker-compose -f docker-compose.dev.yml down -v

# Start lại (sẽ tạo data mới)
./deploy-dev.sh
```

## 📊 Grafana Dashboards

Access Grafana: http://localhost:3000
- Username: `admin`
- Password: `admin`

### Add InfluxDB datasource
1. Configuration → Data Sources → Add data source
2. Select InfluxDB
3. Configuration:
   - URL: `http://influxdb:8086`
   - Organization: `fpt-play`
   - Token: `dev_influxdb_token_12345`
   - Default Bucket: `packager_metrics`

### Import dashboards
Import dashboards từ thư mục `grafana/provisioning/dashboards/`

## 🔐 Security Notes

⚠️ **Development Only**: Cấu hình này chỉ dùng cho môi trường development!

Không sử dụng passwords mặc định trong production:
- PostgreSQL: `dev_password_123` → Change in production
- InfluxDB: `admin_password_123` → Change in production
- Grafana: `admin/admin` → Change on first login

## 📚 Additional Resources

- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Full deployment guide
- [README.md](../README.md) - Project overview
- [ARCHITECTURE_DIAGRAM.md](../ARCHITECTURE_DIAGRAM.md) - System architecture

## 🆘 Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.dev.yml logs`
- View service status: `docker-compose -f docker-compose.dev.yml ps`
- Contact: SRE Team
