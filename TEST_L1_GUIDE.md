# L1 Headend Monitor - Test Guide

## Quick Start

### Test với Input Mặc Định

```bash
cd /home/user/Inspector
python3 test_l1_monitor.py
```

### Test với Input Tùy Chỉnh

```bash
# UDP stream
python3 test_l1_monitor.py udp://225.3.3.42:30130

# SRT stream
python3 test_l1_monitor.py srt://10.0.1.100:9000

# RTMP stream
python3 test_l1_monitor.py rtmp://10.0.1.100/live/stream

# Với duration tùy chỉnh (seconds)
python3 test_l1_monitor.py udp://225.3.3.42:30130 15
```

---

## Test Menu

Khi chạy script, bạn sẽ thấy menu:

```
Select test to run:
======================================================================
  1. Stream Information (quick)
  2. TR 101 290 Analysis (~10s)
  3. HDR Metadata Check (quick)
  4. Dolby Atmos Detection (quick)
  5. Audio Loudness Measurement (~10s)
  6. Complete L1 Analysis (all tests, ~2 minutes)
  0. Exit
======================================================================
```

---

## Chi Tiết Từng Test

### Test 1: Stream Information (Nhanh - <5s)

**Mục đích**: Kiểm tra kết nối và lấy thông tin cơ bản

**Output mẫu**:
```
📺 Format:
  Format: mpegts
  Duration: N/A
  Bitrate: 5230 kbps

📡 Streams (3):
  Stream 0: VIDEO - hevc
    Resolution: 1920x1080
    FPS: 25/1
  Stream 1: AUDIO - aac
    Channels: 2
    Sample Rate: 48000 Hz
  Stream 2: DATA - bin_data
```

**Nên test khi**:
- Lần đầu setup
- Kiểm tra xem stream có accessible không
- Debug connection issues

---

### Test 2: TR 101 290 Analysis (~10s)

**Mục đích**: Kiểm tra MPEG-TS compliance

**Output mẫu (PASS)**:
```
✅ Analysis complete
Valid: True

🔴 Priority 1 Errors (CRITICAL):
  Sync Byte Errors: 0
  PAT Errors: 0
  PMT Errors: 0
  Continuity Errors: 0
  PID Errors: 0

🟡 Priority 2 Errors (SHOULD FIX):
  Transport Errors: 0
  CRC Errors: 0
  PCR Errors: 0
  PCR Discontinuity: 0

✅ No errors detected
```

**Output mẫu (FAIL)**:
```
❌ Analysis complete
Valid: False

🔴 Priority 1 Errors (CRITICAL):
  Sync Byte Errors: 0
  PAT Errors: 0
  PMT Errors: 0
  Continuity Errors: 15
  PID Errors: 0

⚠️  Error Messages (1):
  - Continuity counter errors: 15
```

**Nên test khi**:
- Stream có vấn đề về stability
- Troubleshoot packet loss
- Verify encoder output quality

**Common Issues**:
- **Continuity Errors**: Network packet loss hoặc encoder issues
- **PAT/PMT Errors**: Encoder configuration problem
- **Sync Byte Errors**: Corrupted stream hoặc wrong URL

---

### Test 3: HDR Metadata Check (Nhanh - <5s)

**Mục đích**: Kiểm tra HDR metadata cho 4K HDR content

**Output mẫu (HDR Stream)**:
```
✅ HDR Status
Has HDR: True

📺 HDR Details:
  Transfer: PQ (SMPTE 2084)
  Color Primaries: BT.2020
  Matrix: bt2020nc
  Mastering Display: Present ✅
  Content Light Level: Present ✅

  Valid: ✅
```

**Output mẫu (SDR Stream)**:
```
— HDR Status
Has HDR: False

ℹ️  No HDR detected (stream may be SDR)
```

**Output mẫu (HDR Invalid)**:
```
✅ HDR Status
Has HDR: True

📺 HDR Details:
  Transfer: PQ (SMPTE 2084)
  Color Primaries: Unknown
  Matrix: unknown
  Mastering Display: Missing ❌
  Content Light Level: Missing ❌

  Valid: ❌

⚠️  HDR Issues:
  - HDR detected but color primaries not BT.2020
  - HDR detected but missing mastering display metadata
```

**Nên test khi**:
- Triển khai 4K HDR content
- Verify encoder HDR settings
- Troubleshoot HDR playback issues

**Common Issues**:
- **Missing metadata**: Encoder không set HDR flags
- **Wrong color space**: Encoder config sai
- **HLG vs PQ**: Kiểm tra standard nào đang dùng

---

### Test 4: Dolby Atmos Detection (Nhanh - <5s)

**Mục đích**: Kiểm tra Dolby Atmos audio

**Output mẫu (Atmos Stream)**:
```
✅ Atmos Status
Has Atmos: True

🔊 Atmos Details:
  Codec: ATSC A/52B (AC-3, E-AC-3)
  Channel Layout: 5.1(side)
  Bed Channels: 6
  Sample Rate: 48000 Hz
  Bitrate: 640 kbps

  Valid: ✅
```

**Output mẫu (Standard Audio)**:
```
— Atmos Status
Has Atmos: False

ℹ️  No Dolby Atmos detected
    Stream may have standard audio (stereo, 5.1, etc.)
```

**Output mẫu (Atmos Invalid)**:
```
✅ Atmos Status
Has Atmos: True

🔊 Atmos Details:
  Codec: ATSC A/52B (AC-3, E-AC-3)
  Channel Layout: 5.1(side)
  Bed Channels: 6
  Sample Rate: 48000 Hz
  Bitrate: 256 kbps

  Valid: ❌

⚠️  Atmos Issues:
  - Low bitrate for Atmos: 256.0kbps
```

**Nên test khi**:
- Deploy premium content với Atmos
- Verify encoder audio settings
- Troubleshoot audio playback

**Common Issues**:
- **Low bitrate**: Tăng bitrate lên ≥384 kbps
- **Wrong sample rate**: Phải 48kHz
- **Wrong codec**: Cần E-AC-3, không phải AC-3 thường

---

### Test 5: Audio Loudness Measurement (~10-15s)

**Mục đích**: Đo loudness theo chuẩn EBU R128

**Output mẫu (Compliant)**:
```
✅ Loudness Analysis

📊 Loudness Measurements:
  Integrated Loudness: -23.2 LUFS
  Loudness Range: 8.5 LU
  True Peak: -2.3 dBTP

📏 Compliance Check:
  Target: -23.0 LUFS ± 2.0 LU
  Status: ✅ COMPLIANT (within range)
  True Peak: ✅ OK (< -1.0 dBTP)
```

**Output mẫu (Non-Compliant)**:
```
❌ Loudness Analysis

📊 Loudness Measurements:
  Integrated Loudness: -18.5 LUFS
  Loudness Range: 12.3 LU
  True Peak: -0.5 dBTP

📏 Compliance Check:
  Target: -23.0 LUFS ± 2.0 LU
  Status: ❌ NON-COMPLIANT (off by 4.5 LUFS)
  True Peak: ❌ TOO HIGH (risk of clipping)

⚠️  Loudness Issues:
  - Loudness out of range: -18.5 LUFS (target: -23.0 ±2.0 LUFS)
  - True peak too high: -0.5 dBTP (should be < -1.0 dBTP)
```

**Nên test khi**:
- Broadcast compliance check
- OTT platform requirements
- User complaints về audio levels
- Triển khai content mới

**Common Issues**:
- **Too loud**: Giảm gain ở encoder
- **Too quiet**: Tăng gain ở encoder
- **True peak high**: Thêm limiter
- **Wide loudness range**: Thêm compression

---

### Test 6: Complete L1 Analysis (~2 phút)

**Mục đích**: Chạy TẤT CẢ tests và tạo full report

**Output**: Kết hợp tất cả tests trên + JSON output đầy đủ

**Nên test khi**:
- Initial setup/commissioning
- Full health check định kỳ
- Creating baseline metrics
- Generating reports

---

## Troubleshooting

### Lỗi: "Cannot import l1_headend_monitor"

**Nguyên nhân**: File không ở cùng directory

**Giải pháp**:
```bash
cd /home/user/Inspector
ls -la l1_headend_monitor.py  # Verify file exists
python3 test_l1_monitor.py
```

---

### Lỗi: "ffmpeg: command not found"

**Nguyên nhân**: ffmpeg chưa cài

**Giải pháp**:
```bash
sudo apt update
sudo apt install -y ffmpeg
ffmpeg -version
```

---

### Lỗi: "Connection refused" hoặc "Timeout"

**Nguyên nhân**:
- Stream URL sai
- Network không accessible
- Multicast routing chưa setup

**Giải pháp**:
```bash
# Test UDP multicast
sudo tcpdump -i eth0 host 225.3.3.42 and port 30130 -c 10

# Check multicast route
ip route show | grep 224

# Add multicast route if needed
sudo ip route add 224.0.0.0/4 dev eth0

# Test với ffprobe trực tiếp
ffprobe -v quiet udp://225.3.3.42:30130
```

---

### Lỗi: "Could not parse loudness data"

**Nguyên nhân**:
- ffmpeg version cũ không có loudnorm filter
- Stream không có audio

**Giải pháp**:
```bash
# Check loudnorm filter
ffmpeg -filters | grep loudnorm

# Update ffmpeg if needed
sudo apt install -y ffmpeg

# Verify stream has audio
ffprobe -v quiet -select_streams a:0 -show_streams udp://225.3.3.42:30130
```

---

### Test Timeout hoặc Quá Lâu

**Nguyên nhân**: Stream chậm hoặc network issue

**Giải pháp**:
```bash
# Giảm duration
python3 test_l1_monitor.py udp://225.3.3.42:30130 5

# Hoặc test individual components thay vì full analysis
# Chọn test 1,3,4 (quick tests) thay vì test 2,5,6
```

---

## Expected Results for Common Scenarios

### Scenario 1: Standard HD Channel (1080p SDR Stereo)

```
✅ Stream Info: OK
✅ TR 101 290: PASS
— HDR: Not detected (expected)
— Atmos: Not detected (expected)
✅ Loudness: COMPLIANT
```

### Scenario 2: Premium 4K HDR Channel with Atmos

```
✅ Stream Info: OK
✅ TR 101 290: PASS
✅ HDR: DETECTED and VALID
✅ Atmos: DETECTED and VALID
✅ Loudness: COMPLIANT
```

### Scenario 3: Problematic Stream

```
❌ Stream Info: OK
❌ TR 101 290: FAIL (continuity errors)
⚠️  HDR: DETECTED but INVALID (missing metadata)
❌ Atmos: DETECTED but INVALID (low bitrate)
❌ Loudness: NON-COMPLIANT (too loud)
```

---

## Performance Benchmarks

| Test | Duration | CPU Usage | Notes |
|------|----------|-----------|-------|
| Stream Info | <5s | Low | Quick check |
| TR 101 290 | ~10s | Medium | Passive analysis |
| HDR Check | <5s | Low | Metadata only |
| Atmos Check | <5s | Low | Metadata only |
| Loudness | ~15s | **HIGH** | Full audio decode |
| Full Analysis | ~2min | High | All tests combined |

---

## Next Steps After Testing

### If All Tests PASS ✅

1. **Integrate** into monitor service
2. **Configure** alerting thresholds
3. **Setup** Grafana dashboards
4. **Schedule** regular monitoring (every 5-10 minutes)

### If Tests FAIL ❌

1. **Document** error messages
2. **Check** encoder configuration
3. **Verify** network connectivity
4. **Contact** encoder vendor if needed
5. **Re-test** after fixes

---

## Automation Example

### Daily Health Check Script

```bash
#!/bin/bash
# daily_l1_check.sh

INPUTS=(
  "udp://225.3.3.42:30130"  # HBO
  "udp://225.3.3.43:30131"  # ESPN
  "udp://225.3.3.44:30132"  # CNN
)

for input in "${INPUTS[@]}"; do
  echo "Testing $input..."
  python3 test_l1_monitor.py "$input" 10 <<EOF
6
EOF
  echo "---"
done
```

### Continuous Monitoring

```bash
#!/bin/bash
# continuous_l1_monitor.sh

while true; do
  python3 test_l1_monitor.py udp://225.3.3.42:30130 10 <<EOF
2
EOF
  sleep 300  # 5 minutes
done
```

---

## Support

**Logs**: Check script output and ffmpeg stderr

**Debug Mode**: Set `logging.basicConfig(level=logging.DEBUG)` in script

**Manual Testing**: Use ffmpeg/ffprobe commands directly

**Documentation**: See `L1_INTEGRATION_GUIDE.md` for details

---

**Version**: 1.0
**Last Updated**: 2025-01-18
