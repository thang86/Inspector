-- FPT Play Monitoring - Database Schema
-- PostgreSQL 14+

-- ============================================================================
-- PROBES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS probes (
    probe_id SERIAL PRIMARY KEY,
    probe_name VARCHAR(50) UNIQUE NOT NULL,
    layer INTEGER NOT NULL CHECK (layer BETWEEN 1 AND 5),
    location VARCHAR(100),
    ip_address VARCHAR(50) NOT NULL,
    port INTEGER DEFAULT 8443,
    api_token VARCHAR(255),
    snmp_enabled BOOLEAN DEFAULT TRUE,
    snmp_version VARCHAR(10) DEFAULT 'v2c',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
    template_id SERIAL PRIMARY KEY,
    template_name VARCHAR(50) NOT NULL,
    description TEXT,
    codec VARCHAR(20),
    min_mos FLOAT DEFAULT 2.0,
    max_mos FLOAT DEFAULT 5.0,
    loudness_target FLOAT DEFAULT -23.0,
    loudness_tolerance FLOAT DEFAULT 2.0,
    macroblocking_threshold FLOAT DEFAULT 0.15,
    freeze_threshold_ms INTEGER DEFAULT 1000,
    black_threshold_ms INTEGER DEFAULT 500,
    pcr_jitter_threshold_ns INTEGER DEFAULT 500,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CHANNELS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS channels (
    channel_id SERIAL PRIMARY KEY,
    channel_code VARCHAR(50) UNIQUE NOT NULL,
    channel_name VARCHAR(200) NOT NULL,
    channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('LIVE', 'VOD', 'EVENT')),
    tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    codec VARCHAR(20),
    resolution VARCHAR(20),
    fps FLOAT,
    is_4k BOOLEAN DEFAULT FALSE,
    is_hdr BOOLEAN DEFAULT FALSE,
    has_atmos BOOLEAN DEFAULT FALSE,
    probe_id INTEGER NOT NULL REFERENCES probes(probe_id),
    input_url TEXT,
    template_id INTEGER NOT NULL REFERENCES templates(template_id),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROBE INPUTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS probe_inputs (
    input_id SERIAL PRIMARY KEY,
    probe_id INTEGER NOT NULL REFERENCES probes(probe_id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
    input_name VARCHAR(100) NOT NULL,
    input_type VARCHAR(20) NOT NULL CHECK (input_type IN ('MPEGTS_UDP', 'MPEGTS_HTTP', 'MPEGTS_RTP', 'SRT', 'RTMP')),
    input_url TEXT NOT NULL,
    input_port INTEGER,
    input_protocol VARCHAR(10),
    bitrate_mbps FLOAT,
    is_primary BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    snapshot_url TEXT,
    last_snapshot_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(probe_id, channel_id, input_name)
);

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(channel_id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'INFO')),
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_channels_tier ON channels(tier);
CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled);
CREATE INDEX IF NOT EXISTS idx_channels_probe ON channels(probe_id);
CREATE INDEX IF NOT EXISTS idx_probe_inputs_probe ON probe_inputs(probe_id);
CREATE INDEX IF NOT EXISTS idx_probe_inputs_channel ON probe_inputs(channel_id);
CREATE INDEX IF NOT EXISTS idx_probe_inputs_enabled ON probe_inputs(enabled);
CREATE INDEX IF NOT EXISTS idx_alerts_channel ON alerts(channel_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert default probe
INSERT INTO probes (probe_name, layer, location, ip_address, port)
VALUES ('L2-Packager-01', 2, 'Hanoi DC1', '10.10.10.100', 8443)
ON CONFLICT (probe_name) DO NOTHING;

-- Insert default template
INSERT INTO templates (template_name, description, codec, min_mos, loudness_target)
VALUES ('Standard HD', 'Standard HD monitoring template', 'H.264', 3.0, -23.0)
ON CONFLICT DO NOTHING;

-- Insert sample channels
INSERT INTO channels (channel_code, channel_name, channel_type, tier, codec, resolution, probe_id, input_url, template_id)
SELECT
    'CH_TV_HD_001',
    'Channel HD 001',
    'LIVE',
    1,
    'H.264',
    '1920x1080',
    1,
    'http://packager-01.internal/live/CH_TV_HD_001',
    1
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channel_code = 'CH_TV_HD_001');

INSERT INTO channels (channel_code, channel_name, channel_type, tier, codec, resolution, is_4k, probe_id, input_url, template_id)
SELECT
    'CH_TV_4K_001',
    'Channel 4K 001',
    'LIVE',
    1,
    'HEVC',
    '3840x2160',
    TRUE,
    1,
    'http://packager-01.internal/live/CH_TV_4K_001',
    1
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channel_code = 'CH_TV_4K_001');

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
