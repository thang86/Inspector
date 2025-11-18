-- ============================================================================
-- FPT Play Inspector - Database Initialization Script
-- Creates tables and inserts default data for monitoring system
-- ============================================================================

-- Create Probes table
CREATE TABLE IF NOT EXISTS probes (
    probe_id SERIAL PRIMARY KEY,
    probe_name VARCHAR(50) UNIQUE NOT NULL,
    layer INTEGER NOT NULL CHECK (layer BETWEEN 1 AND 5),
    location VARCHAR(100),
    ip_address VARCHAR(50) NOT NULL,
    port INTEGER DEFAULT 8443,
    api_token VARCHAR(255),
    snmp_enabled BOOLEAN DEFAULT TRUE,
    snmp_version VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Templates table
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
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Channels table
CREATE TABLE IF NOT EXISTS channels (
    channel_id SERIAL PRIMARY KEY,
    channel_code VARCHAR(50) UNIQUE NOT NULL,
    channel_name VARCHAR(200) NOT NULL,
    channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('LIVE', 'VOD', 'EVENT')),
    tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
    codec VARCHAR(20),
    resolution VARCHAR(20),
    fps FLOAT,
    is_4k BOOLEAN DEFAULT FALSE,
    is_hdr BOOLEAN DEFAULT FALSE,
    has_atmos BOOLEAN DEFAULT FALSE,
    probe_id INTEGER NOT NULL REFERENCES probes(probe_id) ON DELETE RESTRICT,
    input_url TEXT,
    template_id INTEGER NOT NULL REFERENCES templates(template_id) ON DELETE RESTRICT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create Inputs table
CREATE TABLE IF NOT EXISTS inputs (
    input_id SERIAL PRIMARY KEY,
    input_name VARCHAR(200) NOT NULL,
    input_url TEXT NOT NULL,
    input_type VARCHAR(50) NOT NULL,
    input_protocol VARCHAR(50),
    input_port INTEGER,
    channel_id INTEGER REFERENCES channels(channel_id) ON DELETE SET NULL,
    probe_id INTEGER NOT NULL REFERENCES probes(probe_id) ON DELETE RESTRICT,
    is_primary BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    bitrate_mbps FLOAT,
    input_metadata JSONB,
    snapshot_url TEXT,
    last_snapshot_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'WARNING')),
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled);
CREATE INDEX IF NOT EXISTS idx_channels_tier ON channels(tier);
CREATE INDEX IF NOT EXISTS idx_channels_probe_id ON channels(probe_id);
CREATE INDEX IF NOT EXISTS idx_inputs_enabled ON inputs(enabled);
CREATE INDEX IF NOT EXISTS idx_inputs_channel_id ON inputs(channel_id);
CREATE INDEX IF NOT EXISTS idx_inputs_probe_id ON inputs(probe_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_channel_id ON alerts(channel_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- ============================================================================
-- Insert default data
-- ============================================================================

-- Insert default probe (L2 Packager Monitor)
INSERT INTO probes (probe_name, layer, location, ip_address, port)
VALUES
    ('PACKAGER-MONITOR-01', 2, 'Dev Environment', 'localhost', 8443),
    ('PACKAGER-MONITOR-02', 2, 'HCM DataCenter', '10.10.1.100', 8443)
ON CONFLICT (probe_name) DO NOTHING;

-- Insert default templates
INSERT INTO templates (template_name, description, codec, min_mos, max_mos, loudness_target, loudness_tolerance)
VALUES
    ('TPL_LIVE_HD', 'Standard HD Live Streaming', 'H.264', 3.5, 5.0, -23.0, 2.0),
    ('TPL_LIVE_4K_HDR', '4K HDR Live Streaming', 'HEVC', 4.0, 5.0, -23.0, 2.0),
    ('TPL_VOD_HD', 'VOD HD Content', 'H.264', 3.0, 5.0, -23.0, 2.5)
ON CONFLICT DO NOTHING;

-- Insert sample channels (if needed for testing)
-- INSERT INTO channels (channel_code, channel_name, channel_type, tier, codec, resolution, fps, probe_id, template_id)
-- VALUES
--     ('CH_TEST_001', 'Test Channel 1', 'LIVE', 1, 'H.264', '1920x1080', 25, 1, 1);

-- Insert sample inputs for testing
-- INSERT INTO inputs (input_name, input_url, input_type, probe_id, enabled)
-- VALUES
--     ('Test UDP Input 1', 'udp://225.3.3.42:30130', 'MPEGTS_UDP', 1, true),
--     ('Test UDP Input 2', 'udp://225.3.3.43:30131', 'MPEGTS_UDP', 1, true);

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO monitor_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO monitor_app;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
    RAISE NOTICE 'Tables created: probes, templates, channels, inputs, alerts';
    RAISE NOTICE 'Default data inserted: 2 probes, 3 templates';
END $$;
