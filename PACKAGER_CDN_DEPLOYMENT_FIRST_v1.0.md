# FPT PLAY - PACKAGER + CDN DEPLOYMENT (PRIORITY ORDER)
**Status: Production Implementation Plan for Packager-First Strategy**

---

## 🎯 TẠI SAO PACKAGER + CDN TRƯỚC?

```
FPT Play Revenue Flow:
  
  Satellite/ISP Feed
       ↓
  Encoder (H.264/HEVC)
       ↓
  ┌─────────────────────────────────┐
  │  **PACKAGER** ← HE FLOW STARTS   │  ← OTT Streaming (Revenue Core)
  │  (HLS/DASH ABR)                 │    - Đi qua packager TRƯỚC
  └─────────────────────────────────┘    - Rồi đẩy sang CDN
       ↓
  CDN Origin/Cache
       ↓
  Edge POPs (HN, HCM, Regions)
       ↓
  Clients (Web, App, STB)
  
💰 Revenue Impact:
  - Packager = Gateway cho OTT → phải reliable
  - Nếu packager down → OTT revenue = 0
  - Encoder down → IPTV affected, nhưng OTT (HE) vẫn có cache

👉 CHIẾN LƯỢC: Giám sát Packager + CDN TRƯỚC
   - Đảm bảo dòng tiền OTT ổn định
   - Sau đó mới lo IPTV (L1 Headend)
```

---

## 📊 DEPLOYMENT SEQUENCE (WEEK-BY-WEEK)

### WEEK 1-2: PACKAGER LAYER (L2)
```
FOCUS: HLS/DASH ABR generation + segment validation

TASK 1: Deploy Inspector LIVE #2 + #2B (Redundancy)
  ├─ LIVE-PACKAGER-01 (Primary)     → 10.10.20.21
  ├─ LIVE-PACKAGER-02 (Backup)      → 10.10.20.22
  └─ Both monitored together (HA config)

TASK 2: Configure Packager Input
  ├─ Source: Encoder TS (MPEG-TS from L1)
  │   Input multicast: 239.1.0.0/16, 239.2.0.0/16
  │   OR HTTP stream from encoder (fallback)
  ├─ Connect 50 channels initially:
  │   ├─ Top 20 HD live
  │   ├─ Top 10 4K HDR live
  │   ├─ Top 20 most watched VOD
  │   └─ Ad-supported channels
  └─ Verify TS reception on probe

TASK 3: ABR Ladder Monitoring
  ├─ Expected manifest structure:
  │   /live/CH_001/master.m3u8 (Root playlist)
  │   ├─ /CH_001_4K_15M.m3u8     (4K: 15 Mbps)
  │   ├─ /CH_001_HD_5M.m3u8      (HD: 5 Mbps)
  │   ├─ /CH_001_SD_2M.m3u8      (SD: 2 Mbps)
  │   └─ /CH_001_LD_500K.m3u8    (Low: 500 Kbps)
  ├─ Validate ladder completeness
  ├─ Check bitrate spacing (should match spec)
  └─ Alert if missing rungs

TASK 4: Segment Continuity Check
  ├─ Download + verify:
  │   ├─ Segment duration (target: 6s ± 10%)
  │   ├─ Sequence number continuity (no gaps)
  │   ├─ Media sequence increment
  │   ├─ Target duration match
  │   └─ Byte range accuracy (fMP4)
  ├─ Monitor for:
  │   ├─ DISCONTINUITY tags without warning
  │   ├─ Missing segments (HTTP 404)
  │   ├─ Segment duration variance
  │   └─ Timeline drift
  └─ Alert on abnormalities

TASK 5: TS-to-ABR Mapping Verification
  ├─ For each channel:
  │   ├─ Compare TS timestamp → first segment timestamp
  │   ├─ Verify continuity across renditions
  │   ├─ Check audio/subtitle presence in each rung
  │   └─ Validate EBP (Entry Point Boundary) if used
  ├─ Ensure MOS/QoS metrics map correctly
  └─ Alert if mapping degradation detected

COMPLETION: 
  ✓ 50 channels monitored end-to-end (TS → ABR)
  ✓ Packager health dashboard live
  ✓ Segment continuity alerts enabled
```

---

### WEEK 3: CDN CORE LAYER (L3)
```
FOCUS: Origin + MidCache health monitoring

TASK 1: Deploy Inspector LIVE #3 (CDN Core Probe)
  ├─ LIVE-CDNCORE-01: 10.10.30.21
  ├─ Location: Cạnh Origin cluster hoặc Coping MidCache
  ├─ Input: Sample 20-30 top channels via HTTP
  │   ├─ Sample from Origin: http://origin.cdn.internal/live/CH_001/
  │   ├─ OR from MidCache: http://midcache.cdn.internal/live/CH_001/
  │   └─ Both if possible (in series)
  └─ Verify connectivity to CDN infrastructure

TASK 2: Origin Health Monitoring
  ├─ Measure per-segment fetch time:
  │   ├─ HTTP request latency (should be < 500ms)
  │   ├─ First byte latency (should be < 200ms)
  │   ├─ Last byte to complete (overall < 2s)
  ├─ Count HTTP status codes:
  │   ├─ 200 OK (success)
  │   ├─ 206 Partial Content (range requests - OK)
  │   ├─ 304 Not Modified (cache check - OK)
  │   ├─ 4xx Client errors (manifest not found - ALERT)
  │   └─ 5xx Server errors (origin down - CRITICAL)
  ├─ Monitor origin load:
  │   ├─ CPU/Memory/Network utilization
  │   ├─ Concurrent connections
  │   └─ Request queue depth
  └─ Alert thresholds:
      - HTTP 5xx > 1% → CRITICAL
      - Latency p95 > 1s → MAJOR
      - Origin CPU > 80% → WARNING

TASK 3: MidCache Performance
  ├─ Monitor cache hit ratio:
  │   ├─ X-Cache header: HIT vs MISS
  │   ├─ Target: > 90% HIT rate
  │   ├─ If < 85%: investigate cache eviction
  │   └─ Alert if drop below 80%
  ├─ Cache layer statistics:
  │   ├─ Bytes served from cache (total bandwidth)
  │   ├─ Bytes requested from origin (cache miss cost)
  │   ├─ Cache eviction rate
  │   └─ Stale content serving (if any)
  ├─ Per-channel cache performance:
  │   ├─ Top 10 channels: Expect > 95% HIT
  │   ├─ Mid tier: Expect > 85% HIT
  │   └─ Long tail: Expect > 70% HIT
  └─ Compare expected vs actual hit rates

TASK 4: Segment Availability from CDN
  ├─ Random sampling:
  │   ├─ Pick 5 random channels (every hour)
  │   ├─ Request latest 3 segments
  │   ├─ Measure response time
  │   ├─ Verify segment integrity (byte count, duration)
  │   └─ Check if in cache or fetched from origin
  ├─ Error tracking:
  │   ├─ Count 404s (segment missing)
  │   ├─ Count 503s (service unavailable)
  │   ├─ Count timeouts
  │   └─ Alert if error rate > 0.5%
  └─ Manifest consistency:
      - Master playlist reflects actual segments
      - Bandwidth declarations accurate
      - Program date/time integrity

TASK 5: CDN Edge Readiness
  ├─ Pre-validate edge POPs before full traffic:
  │   ├─ Can edge reach origin? (connectivity check)
  │   ├─ Edge disk space OK? (> 100GB free recommended)
  │   ├─ Edge CPU/memory baseline established
  │   └─ Edge network capacity available
  ├─ Pre-warm important channels to edge:
  │   ├─ Push top 20 channels to Edge HN
  │   ├─ Push top 20 channels to Edge HCM
  │   ├─ Verify arrival at edge
  │   └─ Measure edge fetch latency (should be < 100ms local)
  └─ Test failover: Origin down → Edge should serve from cache

COMPLETION:
  ✓ CDN core monitoring live (Origin + MidCache)
  ✓ Cache hit ratio visible and tracked
  ✓ Segment availability from CDN validated
  ✓ Edge POPs pre-warmed and ready
```

---

### WEEK 4: INTEGRATION + PRODUCTION CUTOVER
```
FOCUS: Packager + CDN working together, ready for live OTT traffic

TASK 1: End-to-End Flow Validation (TS → Packager → CDN → Client)
  ├─ Encoder generates TS
  ├─ Probe L2 monitors TS quality
  ├─ Packager generates HLS/DASH
  ├─ Probe L2 validates ABR quality
  ├─ CDN picks up manifest + segments
  ├─ Probe L3 monitors CDN health
  ├─ Simulate client download (HLS.js / dash.js)
  ├─ Verify playback quality (MOS)
  ├─ Compare MOS: TS vs ABR vs Edge
  └─ Alert if degradation detected at any layer

TASK 2: Redundancy Configuration
  ├─ Packager failover:
  │   ├─ Primary LIVE-PACKAGER-01 ↔ Backup LIVE-PACKAGER-02
  │   ├─ If one goes down, alerts on both
  │   ├─ Test failover manually
  │   └─ Verify backup takes over seamlessly
  ├─ CDN failover:
  │   ├─ Origin primary + backup
  │   ├─ MidCache distributed for redundancy
  │   ├─ Test origin failure → cache continues serving
  │   └─ Verify no service interruption
  └─ Monitoring continues through failover

TASK 3: Threshold Tuning (Packager + CDN)
  ├─ ABR Ladder:
  │   ├─ Min rung bitrate: _____ kbps (target: < 1 Mbps)
  │   ├─ Max rung bitrate: _____ Mbps (target: 15-25 for 4K)
  │   ├─ Typical 4K ladder: 500K, 2M, 5M, 10M, 15M
  │   └─ Verify ladder matches hardware capabilities
  ├─ Segment Duration:
  │   ├─ Standard: 6 seconds
  │   ├─ Tolerance: ± 10% (5.4 - 6.6 sec)
  │   ├─ Playlist size: 3 segments minimum
  │   └─ Monitor duration variance
  ├─ Cache Thresholds:
  │   ├─ Hit ratio target: > 90%
  │   ├─ Origin latency target: < 500ms
  │   ├─ Edge latency target: < 100ms
  │   └─ Total download time: < 2s per segment
  └─ Quality Thresholds:
      - ABR MOS: > 4.0 (same as TS)
      - Video macroblocking: < 10% (no increase from TS)
      - Frame drop rate: 0%
      - Stall ratio: < 1%

TASK 4: Alert Routing + Escalation
  ├─ CRITICAL Alerts (Packager):
  │   ├─ Packager down
  │   ├─ All manifests missing (404)
  │   ├─ All segments missing (404)
  │   └─ → Escalate: Packager Team NOW
  ├─ CRITICAL Alerts (CDN):
  │   ├─ Origin down (5xx errors > 10%)
  │   ├─ Cache hit < 50% (suspected failure)
  │   ├─ HTTP error rate > 1%
  │   └─ → Escalate: CDN Team NOW
  ├─ MAJOR Alerts:
  │   ├─ MOS degradation (4.0 → 2.5)
  │   ├─ Segment latency p95 > 1s
  │   ├─ Cache hit ratio 85-90% (trend warning)
  │   └─ → Monitor, escalate if not resolved in 5 min
  └─ Route to SNMP → Zabbix → ON-CALL escalation

TASK 5: Production Cut-Over Readiness
  ├─ Checklist:
  │   ☐ Packager probe: Both online, receiving TS, outputting ABR
  │   ☐ CDN core probe: Online, monitoring origin + midcache
  │   ☐ Alert rules: All configured (CRITICAL, MAJOR, MINOR)
  │   ☐ Escalation lists: Teams have contact info
  │   ☐ Thresholds: Baselined against 24h data
  │   ☐ Runbooks: Written and team trained
  │   ☐ Dashboard: Packager + CDN live in Grafana/iVMS
  │   ☐ Fail-over tested: Both packager and CDN
  │   ☐ Documentation: Channel mapping, IP config, contact list
  │   ☐ Customer notification: Ops team aware of go-live
  ├─ Sign-off required:
  │   ├─ Packager Team Lead
  │   ├─ CDN Team Lead
  │   ├─ NOC Manager
  │   └─ Platform Lead
  └─ Green light → Go live

COMPLETION:
  ✓ Packager + CDN monitoring 100% operational
  ✓ 50 channels flowing through OTT pipeline
  ✓ End-to-end MOS tracked and alerted
  ✓ Redundancy validated
  ✓ Teams trained and ready for 24/7 ops
```

---

## 📋 DETAILED TASKS BY ROLE (WHO DOES WHAT)

### 🔧 PACKAGER TEAM

#### Task P1: Packager Infrastructure Setup
```
WHEN: Week 1, Day 1-2
WHO: Packager Engineer + DevOps
TIME: 4 hours

STEPS:
1. Verify Packager Hardware
   $ ssh packager-01.internal
   $ # Check available resources
   $ lscpu
   $ free -h
   $ df -h
   
   Requirements:
   - CPU: 16+ cores available
   - RAM: 32GB+ available
   - Disk: > 1TB SSD for cache
   - Network: 10Gbps NIC dedicated to contribution

2. Check Packager Configuration
   $ # If using Elemental, Unified, or Wowza
   $ service elemental status
   $ ps aux | grep -i packager
   $ # Verify running and healthy

3. Configure Input Feeds
   $ # TS input from encoder multicast
   $ ip route add 239.0.0.0/8 dev eth0
   $ ip maddr add 239.1.1.1 dev eth0
   $ # Test reception
   $ tcpdump -i eth0 "dst 239.1.1.1" -c 100

4. Configure Output Manifests
   $ # Packager should output:
   $ ls -la /var/www/live/
   /var/www/live/CH_001/master.m3u8
   /var/www/live/CH_001/CH_001_4K_15M.m3u8
   /var/www/live/CH_001/CH_001_HD_5M.m3u8
   /var/www/live/CH_001/segments/
   
   $ # Test manifest fetch
   $ curl http://localhost/live/CH_001/master.m3u8

5. Verify Output to CDN
   $ # Check if segments being written to origin mount
   $ ls /mnt/origin/live/CH_001/
   $ # Should see segment-0000.ts, segment-0001.ts, etc.
   
DELIVERABLE: Packager ready to accept TS + produce ABR
```

#### Task P2: Create 50 Channel Profiles
```
WHEN: Week 1, Day 2-3
WHO: Packager Engineer + Content Team
TIME: 6 hours

STEPS:
1. List 50 Priority Channels
   Priority 1 (20): Top rated, news, sports, movies
   Priority 2 (20): Secondary popular, regional, branded
   Priority 3 (10): Ad-supported, sponsored

2. For Each Channel, Define:
   a. Channel ID / Name
      Example: CH_TV_HD_001 / "FPT Channel 1"
   
   b. Input Source
      Multicast: 239.1.x.y:1234 (prog_num=101)
      OR HTTP: http://encoder/stream/ch001.ts
   
   c. ABR Ladder (for 4K channels)
      ├─ 4K HDR: 15 Mbps, 3840x2160, HEVC-10, HLG/HDR10
      ├─ HD: 5 Mbps, 1920x1080, HEVC or H.264
      ├─ SD: 2 Mbps, 1280x720
      └─ LD: 500 Kbps, 640x360
   
   d. ABR Ladder (for HD channels)
      ├─ HD: 5 Mbps, 1920x1080
      ├─ SD: 2 Mbps, 1280x720
      └─ LD: 500 Kbps, 640x360
   
   e. Audio Tracks
      Primary: AC-3 5.1, -24 LUFS
      Secondary: AAC Stereo, -24 LUFS (optional)
   
   f. Subtitles
      Format: CEA-608 in video OR separate SRT
   
   g. Ad Insertion
      SCTE-35: Enabled (segment count for ad breaks)
      Ad duration: 30s (typical)

3. Create Packager Profile (XML/Config Example)
   
   <Channel>
     <ChannelID>CH_TV_HD_001</ChannelID>
     <Name>FPT Channel 1</Name>
     <Input>
       <Type>MPEG-TS</Type>
       <Multicast>239.1.1.1:1234</Multicast>
       <ProgramNumber>101</ProgramNumber>
     </Input>
     <Output>
       <Playlist>/live/CH_TV_HD_001/master.m3u8</Playlist>
       <SegmentPath>/live/CH_TV_HD_001/segments/</SegmentPath>
       <SegmentDuration>6</SegmentDuration>
       <PlaylistType>EVENT</PlaylistType>  <!-- or VOD for recorded -->
     </Output>
     <Renditions>
       <Rendition bitrate="5000" resolution="1920x1080" codec="avc"/>
       <Rendition bitrate="2000" resolution="1280x720" codec="avc"/>
       <Rendition bitrate="500" resolution="640x360" codec="avc"/>
     </Renditions>
     <SCTE35>
       <Enabled>true</Enabled>
       <SegmentCountForAdBreak>1</SegmentCountForAdBreak>
     </SCTE35>
   </Channel>

4. Import/Configure in Packager
   $ # Elemental Manager:
   $ # UI: Create channel from template → fill in CH_001 values
   $ # Or via API:
   curl -X POST https://packager/api/channels \
     -d @channel_profile.json
   
   $ # Unified Packager:
   $ vim /etc/packager/channels/CH_001.conf
   $ systemctl reload packager

5. Verification per Channel
   ✓ Input TS received (packets counted)
   ✓ Manifest generated
   ✓ All renditions present in playlist
   ✓ First segment available
   ✓ Can download and play segment

DELIVERABLE: 50 channels configured, ingesting, outputting ABR
```

#### Task P3: Segment Quality Validation
```
WHEN: Week 1-2, continuous
WHO: Packager QA Engineer
TIME: 8 hours (setup), then 2h/day monitoring

STEPS:
1. Automated Segment Checker (Python Script)
   
   #!/usr/bin/env python3
   import requests
   import m3u8
   from datetime import datetime
   
   def check_channel_segments(channel_id, probe_url):
       """Download and validate segments"""
       
       # 1. Get master playlist
       resp = requests.get(f"http://packager/live/{channel_id}/master.m3u8")
       master = m3u8.loads(resp.text)
       
       # 2. For each rendition
       for variant in master.variants:
           rung_url = f"http://packager{variant.uri}"
           resp = requests.get(rung_url)
           playlist = m3u8.loads(resp.text)
           
           # 3. Validate playlist structure
           assert playlist.target_duration == 6, "Wrong segment duration"
           assert len(playlist.segments) >= 3, "Playlist too short"
           
           # 4. Check segment integrity
           for i, seg in enumerate(playlist.segments):
               seg_url = f"{rung_url.rsplit('/', 1)[0]}/{seg.uri}"
               
               # Measure download
               start = datetime.now()
               seg_resp = requests.get(seg_url)
               elapsed = (datetime.now() - start).total_seconds()
               
               # Validation
               assert seg_resp.status_code == 200, f"Segment {i} failed"
               assert len(seg_resp.content) > 10000, "Segment too small"
               assert elapsed < 2, f"Segment took {elapsed}s to download"
               
               # Check duration
               assert abs(seg.duration - 6.0) < 0.5, f"Duration off"
       
       print(f"✓ {channel_id}: All segments valid")

2. Run Validation on All 50 Channels
   for ch_id in CH_001 to CH_050:
     check_channel_segments(ch_id, "http://packager")
   
   Time: ~5 min per channel if sequential
        or 30 sec if parallel on 10 workers

3. Create Segment Metrics Dashboard
   Track per-channel:
   - Segment arrival rate (segments/min)
   - Average download time (ms)
   - Download time p95 (ms)
   - Error rate (failed segments %)
   - Bandwidth per rung (Mbps)
   
   $ # Example query (InfluxDB)
   SELECT MEAN("download_time_ms") FROM segment_metrics
   WHERE channel_id = 'CH_001' AND time > now() - 1h
   GROUP BY rendition

DELIVERABLE: Segment quality dashboard live, validates 50 channels
```

#### Task P4: Packager Redundancy Setup
```
WHEN: Week 2, Day 3
WHO: Packager Engineer + DevOps
TIME: 4 hours

OBJECTIVE: If LIVE-PACKAGER-01 goes down, traffic switches to LIVE-PACKAGER-02

STEPS:
1. Configure Active-Active Packager Pair
   
   Packager-01 (Primary):
   ├─ IP: 10.10.20.21
   ├─ Receives TS: 239.1.x.x (50 channels)
   ├─ Outputs: /mnt/origin/live/CH_*/
   └─ Publishes: http://packager-01/live/
   
   Packager-02 (Standby / Active):
   ├─ IP: 10.10.20.22
   ├─ Receives TS: Same multicast groups (IGMP join both)
   ├─ Outputs: /mnt/origin/live/CH_*/  (same NFS mount)
   └─ Publishes: http://packager-02/live/
   
   Load Balancer (VIP):
   ├─ Virtual IP: 10.10.20.10 (http://packager-vip/live/)
   ├─ Routes to: packager-01 (weight 100)
   ├─ Routes to: packager-02 (weight 0 - standby)
   └─ Health check: GET /health → HTTP 200

2. Setup Shared Storage
   $ # NFS mount on both packagers
   $ mount -t nfs nfs-server:/export/origin /mnt/origin
   $ # Verify mount
   $ df -h /mnt/origin
   
   Advantage: If packager-01 crashes, packager-02 continues
   serving same segments from shared cache

3. Configure Health Checks
   $ # On load balancer:
   $ # Check every 5 sec
   $ # If packager-01 returns 5xx or timeout for 15 sec
   $ # → Failover to packager-02
   
   Health check URL: http://packager-01:8080/api/health
   
   Response:
   {
     "status": "healthy",
     "channels_active": 50,
     "output_bitrate_mbps": 250,
     "cpu_usage_percent": 35,
     "disk_usage_percent": 60
   }

4. Test Failover
   Step 1: Shut down packager-01
   $ service packager stop
   
   Step 2: Monitor alerts
   - Probe should alert "Packager-01 down"
   - Load balancer should route to packager-02
   
   Step 3: Verify playback continues
   $ # Download segment from VIP
   $ curl http://packager-vip/live/CH_001/segments/segment-100.ts
   $ # Should succeed (served from packager-02)
   
   Step 4: Restart packager-01
   $ service packager start
   $ # Load balancer re-adds it back
   
   Step 5: Verify no service interruption
   - Segments continued flowing
   - Only brief interruption (< 5 sec) if any

DELIVERABLE: Packager redundancy validated, failover tested
```

---

### 🌐 CDN TEAM

#### Task C1: CDN Infrastructure Audit
```
WHEN: Week 2, Day 1-2
WHO: CDN Engineer + Infrastructure Team
TIME: 6 hours

OBJECTIVE: Understand CDN topology, document current performance baseline

STEPS:
1. Map CDN Architecture
   
   ORIGIN CLUSTER:
   ├─ Origin-01: 10.40.1.10 (Primary)
   ├─ Origin-02: 10.40.1.11 (Backup)
   └─ Shared Storage: /var/www/origin (NFS)
   
   MIDCACHE LAYER:
   ├─ MidCache-HN: 10.40.10.10 (Hanoi region)
   ├─ MidCache-HCM: 10.40.20.10 (Ho Chi Minh region)
   └─ MidCache-DN: 10.40.30.10 (Da Nang region)
   
   EDGE POPs:
   ├─ Edge-HN-01: 10.20.10.21 (Hanoi)
   ├─ Edge-HN-02: 10.20.10.22 (Hanoi backup)
   ├─ Edge-HCM-01: 10.20.20.21 (Ho Chi Minh)
   ├─ Edge-HCM-02: 10.20.20.22 (Ho Chi Minh backup)
   └─ Edge-DN-01: 10.20.30.21 (Da Nang)

2. Document Network Paths
   Packager → Origin:
   $ traceroute origin-01.cdn.internal
   
   Origin → MidCache:
   $ traceroute midcache-hn.cdn.internal
   
   MidCache → Edge:
   $ traceroute edge-hn-01.cdn.internal

3. Check Origin Storage
   $ ssh origin-01.cdn.internal
   $ df -h /var/www/origin
   
   Available space: ________ GB
   Used space: ________ GB
   Recommend: Keep > 20% free for operational headroom

4. Verify Cache Setup
   $ ssh midcache-hn.cdn.internal
   $ # Check cache directory
   $ du -sh /var/cache/cdn
   
   Cache size: ________ GB
   Recommend: 500GB+ SSD for HN midcache

5. Document Baseline Metrics
   
   Per-Origin:
   ├─ Current throughput: ______ Mbps
   ├─ Current connections: ______
   ├─ Current CPU: ______%
   ├─ Current memory: ______%
   └─ Disk I/O: ______ IOPS
   
   Per-MidCache:
   ├─ Cache hit ratio: ______%
   ├─ Bytes in cache: ______ GB
   └─ Eviction rate: ______/hour
   
   Per-Edge:
   ├─ Throughput to clients: ______ Mbps
   └─ Latency to clients: ______ ms

DELIVERABLE: CDN topology documented, baseline established
```

#### Task C2: Origin Monitoring Configuration
```
WHEN: Week 2, Day 2-3
WHO: CDN Engineer + Monitoring Admin
TIME: 5 hours

OBJECTIVE: Setup Inspector LIVE #3 to monitor Origin health

STEPS:
1. Deploy Inspector LIVE #3
   $ # On VM LIVE-CDNCORE-01
   $ ssh live-cdncore-01.monitor.local
   $ curl https://packager/live/CH_001/master.m3u8 -I
   
   Configure Inspector:
   ├─ Primary source: Origin-01
   ├─ Channels to monitor: CH_001-020 (top 20)
   ├─ Secondary source: MidCache-HN (for cache hit verification)
   └─ Polling interval: Every 30 seconds

2. Create Origin Monitoring Template
   
   ```yaml
   CDN_Origin_Template:
     input_type: HTTP_ABR
     sources:
       - url: http://origin-01/live/
       - url: http://midcache-hn/live/
     
     metrics:
       http_latency:
         target: < 500ms (p95)
         alert_threshold: > 1000ms
       
       http_errors:
         target: < 0.1%
         alert_threshold: > 1%
       
       segment_availability:
         target: 100%
         alert_threshold: < 99%
       
       cache_hit_ratio:
         target: > 90%
         alert_threshold: < 80%
     
     sampling:
       interval: 30s
       per_channel: 1 sample per interval
       per_rendition: Sample each quality rung
   ```

3. Configure HTTP-level Monitoring
   
   For each segment downloaded:
   ├─ Measure HTTP response time (ms)
   ├─ Check HTTP status code (200, 206, 404, 5xx)
   ├─ Verify Content-Length matches downloaded bytes
   ├─ Check X-Cache header:
   │  ├─ X-Cache: HIT (served from cache) ✓
   │  ├─ X-Cache: MISS (fetched from origin) ✓
   │  └─ X-Cache: None (bypass cache) ⚠
   └─ Verify Last-Modified / ETag consistency

4. Setup Per-Origin Error Tracking
   
   Origin-01 Status:
   ├─ HTTP 200: ____/hour (should be 90-100%)
   ├─ HTTP 206: ____/hour (partial content, OK for range requests)
   ├─ HTTP 304: ____/hour (not modified, OK)
   ├─ HTTP 4xx: ____/hour (should be < 1%)
   ├─ HTTP 5xx: ____/hour (should be 0, ALERT if > 0)
   └─ Timeout: ____/hour (should be 0)

5. Configure Cache Hit Analysis
   
   $ # Query CDN logs
   $ tail -10000 /var/log/nginx/access.log | \
     awk '{print $NF}' | sort | uniq -c
   
   Expected output:
   HIT_fresh: 91000
   MISS: 8000
   EXPIRED: 1000
   
   Analysis:
   ├─ Hit ratio: 91000 / 100000 = 91% ✓
   ├─ Investigate if < 85%
   └─ Check for cache eviction issues

6. Create Origin Health Dashboard
   
   Grafana Panel 1: HTTP Latency (p50, p95, p99)
   Grafana Panel 2: HTTP Error Rate
   Grafana Panel 3: Cache Hit Ratio
   Grafana Panel 4: Segment Availability %
   Grafana Panel 5: Origin CPU/Memory
   
   Alert Rules:
   ├─ If p95 latency > 1s → MAJOR
   ├─ If error rate > 1% → CRITICAL
   ├─ If cache hit < 85% → MAJOR
   └─ If availability < 99.9% → CRITICAL

DELIVERABLE: Origin monitoring live, latency/errors/cache visible
```

#### Task C3: MidCache Performance Tuning
```
WHEN: Week 2, Day 3-4
WHO: CDN Cache Engineer
TIME: 6 hours

OBJECTIVE: Optimize cache hit ratio to > 90%

STEPS:
1. Analyze Cache Hit Ratio Baseline
   
   Current state (before tuning):
   $ ssh midcache-hn.cdn.internal
   $ # Extract cache hit stats
   $ grep "X-Cache: HIT" /var/log/nginx/access.log | wc -l
   $ grep "X-Cache: MISS" /var/log/nginx/access.log | wc -l
   
   Example: 10,000 HIT + 1,500 MISS = 87% hit ratio
   Target: > 90%
   Gap: +3 percentage points needed

2. Identify Miss Reasons
   
   Type 1: Segment Not in Cache Yet
   └─ First request for segment → MISS (expected)
   
   Type 2: Segment Expired (TTL exceeded)
   └─ Increase TTL (Cache-Control header)
   
   Type 3: Cache Eviction (LRU - Least Recently Used)
   └─ Cache full, popular segments get evicted
   └─ Solution: Increase cache size or reduce TTL on low-popularity content
   
   Type 4: Cache Bypass (Set-Cookie or other rules)
   └─ Check if origin sending no-cache headers
   └─ Fix: Configure conditional caching in CDN rules

3. Tuning Actions
   
   Action A: Increase Cache TTL for Segments
   
   Origin currently sends:
   Cache-Control: max-age=60 (1 minute)
   
   Update to:
   Cache-Control: max-age=3600 (1 hour)
   
   $ # Modify origin config
   $ vim /etc/nginx/nginx.conf
   
   upstream origin {
     add_header Cache-Control "max-age=3600, public";
   }
   
   $ systemctl reload nginx
   
   Action B: Increase MidCache Disk Size
   
   Current: 256 GB
   Recommend: 500 GB
   
   If diskless issue:
   $ # Add new SSD
   $ # Mount at /var/cache/cdn
   $ # Restart cache daemon
   
   Action C: Tune Cache Eviction Policy
   
   $ # Reduce minimum object size to cache
   $ # (cache even small segments, but with short TTL)
   vim /etc/cache/config.conf
   
   min_cache_size = 1MB (was 10MB)
   max_cache_size = 450GB (was 200GB)
   eviction_policy = LRU_WITH_PRIORITY
   priority_channels = CH_001,CH_002,...  (top 50)

4. Monitor Cache Behavior After Tuning
   
   $ # Compare before/after
   Time Period: 1 hour baseline
   
   Before Tuning:
   ├─ Hit ratio: 87%
   ├─ Avg latency: 250ms
   ├─ Bytes from origin: 150 GB/hour
   └─ Miss rate: 13%
   
   After Tuning:
   ├─ Hit ratio: 92% (target achieved ✓)
   ├─ Avg latency: 120ms (faster!)
   ├─ Bytes from origin: 40 GB/hour (less origin load!)
   └─ Miss rate: 8%

5. Per-Channel Cache Optimization
   
   Top channels (High Priority):
   ├─ CH_001-020: Target 95%+ hit ratio
   ├─ TTL: 1 hour minimum
   └─ Pre-populate to edge on cache miss
   
   Mid-tier channels (Medium Priority):
   ├─ CH_021-050: Target 85%+ hit ratio
   ├─ TTL: 30 minutes
   └─ Standard LRU eviction
   
   Long-tail channels (Low Priority):
   ├─ CH_051+: Acceptable 70%+ hit ratio
   ├─ TTL: 10 minutes
   └─ More aggressive eviction

DELIVERABLE: Cache hit ratio > 90% verified
```

#### Task C4: Edge POP Readiness
```
WHEN: Week 3, Day 1-2
WHO: CDN Edge Engineer + Network Team
TIME: 4 hours

OBJECTIVE: Prepare edge POPs for content delivery

STEPS:
1. Verify Edge → MidCache Connectivity
   
   Test from Edge HN:
   $ ssh edge-hn-01.cdn.internal
   $ ping midcache-hn.cdn.internal
   Latency: _______ ms (should be < 50ms, same datacenter)
   
   Test from Edge HCM:
   $ ssh edge-hcm-01.cdn.internal
   $ ping midcache-hcm.cdn.internal
   Latency: _______ ms (should be < 50ms)
   
   If latency high:
   └─ Investigate routing, network path
   └─ Check for congestion on inter-DC links

2. Pre-Warm Important Channels to Edge
   
   Goal: Reduce first-request latency
   
   $ # List top 20 channels
   TOP_CHANNELS=(CH_001 CH_002 CH_003 ... CH_020)
   
   for ch in "${TOP_CHANNELS[@]}"; do
     for rung in 4K_15M HD_5M SD_2M; do
       # Download 3 segments to populate cache
       for i in 1 2 3; do
         curl -I "http://midcache-hn/live/$ch/${ch}_${rung}/segment-$(($i + 100)).ts" > /dev/null
       done
     done
   done
   
   Verification:
   $ # Check edge cache
   $ du -sh /var/cache/cdn/live/
   Expected: 20-50 GB pre-warmed

3. Configure Edge → Client Delivery
   
   Edge now ready to serve clients:
   ├─ Client requests: CH_001/master.m3u8
   ├─ Edge serves from cache: X-Cache: HIT
   ├─ Latency to client: < 100ms (ideal)
   └─ Bandwidth: Full client capacity
   
   Measure:
   $ # Simulate client download
   $ curl -I http://edge-hn-01/live/CH_001/segments/segment-100.ts
   
   Response:
   HTTP/1.1 200 OK
   X-Cache: HIT from edge-hn-01
   Content-Length: 500000
   Server: nginx/1.20.0

4. Configure Failover Path
   
   Normal flow:
   Edge HN (full cache) → Client
   
   Edge cache empty:
   Edge HN (miss) → MidCache HN (maybe miss) → Origin
   
   If origin slow:
   Edge can fetch from alternate origin:
   ├─ Intelligent routing based on RTT
   ├─ Avoid timeouts by using backup
   └─ Configure in CDN rules

5. Test Edge Failover
   
   Step 1: Simulate edge cache full
   $ # Trigger cache eviction of a channel
   
   Step 2: Request segment → cache miss
   $ curl http://edge-hn-01/live/CH_001/segment-200.ts
   X-Cache: MISS (not in edge cache)
   
   Step 3: Edge fetches from midcache
   X-Cache: HIT from midcache (in mid cache)
   
   Step 4: Midcache miss → fetches from origin
   X-Cache: MISS from midcache (needs origin)
   
   Latency should be:
   ├─ Edge HIT: < 50ms
   ├─ MidCache HIT: < 200ms
   ├─ Origin fetch: < 500ms
   └─ Total: All within acceptable range

DELIVERABLE: Edge POPs ready, pre-warmed, failover tested
```

---

## 📊 MONITORING SCHEMA FOR PACKAGER + CDN

### Database Tables Needed

```sql
-- Packager Monitoring
CREATE TABLE packager_metrics (
    time TIMESTAMP NOT NULL,
    probe_id INT,
    channel_id INT,
    
    -- Input (TS)
    ts_bitrate_kbps DECIMAL(10,2),
    ts_cc_errors INT,
    ts_packets_lost INT,
    
    -- Output (ABR)
    manifest_fetch_time_ms INT,
    segment_duration_sec DECIMAL(5,2),
    segment_count INT,
    segment_missing INT,
    
    -- ABR Ladder
    rung_count INT,
    rung_bitrates TEXT,  -- '500,2000,5000'
    
    PRIMARY KEY (time, probe_id, channel_id)
);

-- CDN Monitoring
CREATE TABLE cdn_metrics (
    time TIMESTAMP NOT NULL,
    probe_id INT,
    cdn_layer VARCHAR(20),  -- 'ORIGIN', 'MIDCACHE', 'EDGE'
    channel_id INT,
    
    -- HTTP Performance
    http_latency_ms INT,
    http_first_byte_ms INT,
    http_status_code INT,
    
    -- Cache
    cache_hit BOOLEAN,
    bytes_served INT,
    
    -- Errors
    error_count INT,
    timeout_count INT,
    
    PRIMARY KEY (time, probe_id, cdn_layer, channel_id)
);

-- Alert Log
CREATE TABLE alert_log (
    alert_id SERIAL PRIMARY KEY,
    time TIMESTAMP,
    severity VARCHAR(20),  -- CRITICAL, MAJOR, MINOR
    source VARCHAR(20),     -- PACKAGER, ORIGIN, MIDCACHE, EDGE
    channel_id INT,
    message TEXT,
    escalated_to VARCHAR(100),
    resolved_at TIMESTAMP
);
```

### Key Dashboards

#### Dashboard 1: Packager Health
```
┌──────────────────────────────────────────────────────────────┐
│ PACKAGER LAYER (L2) - LIVE MONITORING                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Status: ●●●●●  Packager-01 ONLINE                           │
│         ●●●●   Packager-02 ONLINE                           │
│                                                              │
│ Channels Active: 50/50 ✓                                    │
│ Manifests Generated: 50 ✓                                   │
│ Average Segment Duration: 6.02s ✓                          │
│                                                              │
├─────────────────────┬─────────────────────────────────────┤
│ TS Input (L1)       │ ABR Output (to CDN)                │
├─────────────────────┼─────────────────────────────────────┤
│ Total Bitrate:      │ Rung Distribution:                 │
│ 2.5 Gbps (normal)   │ ├─ 4K: 50 channels (100%)         │
│                     │ ├─ HD: 50 channels (100%)         │
│ TS Errors:          │ ├─ SD: 50 channels (100%)         │
│ 0/hour ✓            │ └─ LD: 50 channels (100%)         │
│                     │                                   │
│ Packet Loss:        │ Segment Queue:                    │
│ 0.0% ✓              │ ├─ Pending: 150 segments         │
│                     │ ├─ Ready: 5000 segments          │
│                     │ └─ Processing latency: 120ms     │
│                                                              │
│ Top Issues: [None]                                          │
│ Last Updated: 2025-01-13 15:45:30 UTC                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Dashboard 2: CDN Core Performance
```
┌──────────────────────────────────────────────────────────────┐
│ CDN CORE LAYER (L3) - ORIGIN + MIDCACHE PERFORMANCE         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ORIGIN HEALTH                                               │
│ ├─ Status: ✓ ONLINE                                        │
│ ├─ HTTP Response Time (p95): 245ms (OK < 500ms)           │
│ ├─ HTTP Error Rate: 0.05% (OK < 1%)                       │
│ ├─ CPU Usage: 35% (OK < 80%)                              │
│ ├─ Memory: 18/32 GB (56%)                                 │
│ └─ Disk: 450/500 GB (90%) - Acceptable                    │
│                                                              │
│ MIDCACHE PERFORMANCE                                        │
│ ├─ Region: Hanoi                                           │
│ ├─ Cache Hit Ratio: 92% (Target: > 90%) ✓                 │
│ ├─ Cache Size: 420/500 GB                                 │
│ ├─ Avg Response Time: 120ms (fast)                        │
│ ├─ Eviction Rate: 150 objs/min (stable)                   │
│ └─ Top Evicted: Long-tail channels (expected)            │
│                                                              │
│ PER-CHANNEL SAMPLE:                                        │
│ Channel   │ Bitrate │ Cache Hit │ Origin Reqs/min          │
│ ──────────┼─────────┼───────────┼─────────────────        │
│ CH_001    │ 12.5Mbps│ 98%       │ 2 reqs/min (refill)     │
│ CH_002    │ 11.2Mbps│ 96%       │ 3 reqs/min              │
│ CH_050    │ 8.1Mbps │ 87%       │ 45 reqs/min (miss rate) │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎬 WEEK-BY-WEEK EXECUTION SUMMARY

```
WEEK 1: PACKAGER LAYER
  ├─ Day 1-2:   Infrastructure, Packager setup
  ├─ Day 2-3:   50 channel configuration
  ├─ Day 3-4:   Segment quality validation
  └─ Day 5:     Test + freeze config

WEEK 2: CDN CORE LAYER
  ├─ Day 1-2:   CDN audit, Origin monitoring config
  ├─ Day 2-3:   MidCache performance tuning
  ├─ Day 3-4:   Cache hit ratio > 90%
  ├─ Day 4:     Edge POP readiness
  └─ Day 5:     Test all failovers

WEEK 3: INTEGRATION + PRODUCTION
  ├─ Day 1-2:   End-to-end flow validation
  ├─ Day 2-3:   Threshold tuning, alert rules
  ├─ Day 3-4:   Team training, runbooks
  ├─ Day 4:     Production readiness review
  └─ Day 5:     GO LIVE (Packager + CDN OTT revenue stream)

WEEK 4: STABILIZATION + L1 PLANNING
  ├─ Day 1-3:   24/7 monitoring, incident response
  ├─ Day 3-4:   Baseline data collection
  ├─ Day 4-5:   Plan L1 (Headend) deployment next
  └─ Review:    What went well? What to improve?
```

---

## 📋 DELIVERABLES CHECKLIST (PACKAGER + CDN)

```
WEEK 1 (Packager):
  ☐ Packager infra verified (CPU, disk, network)
  ☐ 50 channels configured in packager
  ☐ All channels generating HLS/DASH manifests
  ☐ Segment quality checker script deployed
  ☐ Segment quality dashboard live (Grafana)
  ☐ Inspector LIVE #2 (Packager probe) receiving all 50 channels
  ☐ Redundancy (Packager-01 + Packager-02) configured
  ☐ Failover test: Packager-01 down → Packager-02 serves ✓

WEEK 2 (CDN):
  ☐ CDN topology documented
  ☐ Origin monitoring live (Inspector LIVE #3)
  ☐ Origin latency baseline established
  ☐ MidCache cache hit ratio > 90% achieved
  ☐ Per-channel cache performance documented
  ☐ Edge POPs pre-warmed with top 20 channels
  ☐ Edge POP failover tested (origin down → edge cache serves)
  ☐ CDN health dashboard live (Grafana)

WEEK 3 (Integration):
  ☐ End-to-end TS → Packager → CDN → Edge validated
  ☐ MOS metric tracked from Packager + CDN layers
  ☐ Alert routing tested: Packager issue → Packager team
  ☐ Alert routing tested: CDN issue → CDN team
  ☐ Thresholds baselined on 24h+ data
  ☐ Runbooks written for Packager team
  ☐ Runbooks written for CDN team
  ☐ Training completed (Packager ops + CDN ops)
  ☐ Redundancy (active-active, active-passive) verified
  ☐ Production readiness sign-off obtained

WEEK 4+ (Operations):
  ☐ Monitoring stable, false alert rate < 5%
  ☐ MTTR (mean time to resolution) < 15 min for issues
  ☐ Weekly review meeting scheduled
  ☐ Incident post-mortems completed
  ☐ Next phase (L1 Headend) planning in progress
```

---

## 🚨 PACKAGER + CDN CRITICAL SUCCESS FACTORS

```
1. SEGMENT CONTINUITY
   └─ No gaps, no duplicates, predictable timing
   └─ If fails → playback stalls, rebuffers
   └─ MONITOR: Sequence number jumps, duration variance

2. CACHE HIT RATIO > 90%
   └─ Reduces origin load, improves edge latency
   └─ If drops < 85% → origin can be overwhelmed
   └─ MONITOR: HIT vs MISS ratio hourly

3. HTTP ERROR RATE < 0.1%
   └─ 404s, 5xx errors mean lost segments
   └─ Users see black screen or buffering
   └─ MONITOR: Every HTTP error status code

4. LATENCY P95 < 500ms (Origin)
   └─ Segment download must complete before buffer empty
   └─ If latency > 1s → client stalls
   └─ MONITOR: Response time percentiles (p50, p95, p99)

5. ABR LADDER INTACT
   └─ All rungs available (4K, HD, SD, LD)
   └─ No "holes" in bitrate ladder
   └─ If 4K missing → can't serve 4K users
   └─ MONITOR: Manifest validation, rendition presence

6. REDUNDANCY WORKING
   └─ Packager failover < 5 sec
   └─ Origin failover < 10 sec
   └─ If failover doesn't work → outage possible
   └─ MONITOR: Failover testing monthly

7. MANIFEST CONSISTENCY
   └─ Master + variant playlists in sync
   └─ Segment count, duration, bitrate consistent
   └─ If inconsistent → player confusion
   └─ MONITOR: Playlist validation rules
```

---

## 📞 TEAM CONTACTS + ESCALATION

```
PACKAGER ISSUES:
├─ Primary: Packager Engineer
│   Name: [Name]
│   Email: packager-team@fpt.com.vn
│   Phone: +84-xxx-yyy-zzzz
│   On-call: Yes (24/7)
│
└─ Escalation: Packager Lead
    Name: [Lead Name]
    Email: [Lead Email]
    Phone: [Lead Phone]

CDN ISSUES:
├─ Primary: CDN Engineer
│   Name: [Name]
│   Email: cdn-team@fpt.com.vn
│   Phone: +84-xxx-yyy-zzzz
│   On-call: Yes (24/7)
│
└─ Escalation: CDN Lead
    Name: [Lead Name]
    Email: [Lead Email]
    Phone: [Lead Phone]

NOC (Monitoring Center):
├─ Shift 1 (08:00-16:00): [NOC Ops 1]
├─ Shift 2 (16:00-00:00): [NOC Ops 2]
├─ Shift 3 (00:00-08:00): [NOC Ops 3]
└─ Emergency: +84-xxx-yyy-zzzz (24/7 hotline)

MANAGEMENT:
├─ Platform Lead: [Name] - platform-lead@fpt.com.vn
└─ Ops Director: [Name] - ops-director@fpt.com.vn
```

---

## ✅ GO-LIVE READINESS (END OF WEEK 3)

Before go-live, VERIFY:

```
☐ All 50 channels streaming OTT via Packager + CDN
☐ No client reports of buffering or quality issues
☐ Baseline MOS on ABR tracks TS MOS
☐ Alert response time < 5 min for Critical alerts
☐ Failover tests successful (no user impact)
☐ Team trained and on-call ready
☐ Documentation complete and accessible
☐ Incident playbooks reviewed
☐ Escalation list updated
☐ Management sign-off obtained
☐ Customer (business stakeholders) notified

DATE GO-LIVE AUTHORIZED: _______________
SIGNED BY: ___________________________
```

---

**END - Packager + CDN Deployment First Strategy**

🎯 **NEXT PHASE**: After Packager + CDN stable (Week 4+)
   → Deploy L1 (Headend Encoder Probe)
   → Then L4 (Edge POP Probes)
   → Finally L0 (Contribution monitoring)

