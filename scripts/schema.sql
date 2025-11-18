-- Inspector Database Schema
-- PostgreSQL 13+
-- Version: 1.0

-- ============================================================================
-- PROBES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS probes (
    probe_id SERIAL PRIMARY KEY,
    probe_name VARCHAR(50) UNIQUE NOT NULL,
    layer INTEGER NOT NULL CHECK (layer BETWEEN 1 AND 5),
    location VARCHAR(100),
    ip_address VARCHAR(50) NOT NULL,
    port INTEGER DEFAULT 8443 CHECK (port > 0 AND port < 65536),
    api_token VARCHAR(255),
    snmp_enabled BOOLEAN DEFAULT TRUE,
    snmp_version VARCHAR(10) DEFAULT 'v2c',
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE probes IS 'Monitoring probes deployed on packager servers';
COMMENT ON COLUMN probes.layer IS 'Monitoring layer: 1=Headend, 2=Packager, 3=CDN, 4=Edge, 5=Client';

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
    template_id SERIAL PRIMARY KEY,
    template_name VARCHAR(50) NOT NULL,
    description TEXT,
    codec VARCHAR(20),
    min_mos FLOAT DEFAULT 2.0 CHECK (min_mos >= 1.0 AND min_mos <= 5.0),
    max_mos FLOAT DEFAULT 5.0 CHECK (max_mos >= 1.0 AND max_mos <= 5.0),
    loudness_target FLOAT DEFAULT -23.0,
    loudness_tolerance FLOAT DEFAULT 2.0,
    macroblocking_threshold FLOAT DEFAULT 0.15,
    freeze_threshold_ms INTEGER DEFAULT 1000 CHECK (freeze_threshold_ms >= 0),
    black_threshold_ms INTEGER DEFAULT 500 CHECK (black_threshold_ms >= 0),
    pcr_jitter_threshold_ns INTEGER DEFAULT 500 CHECK (pcr_jitter_threshold_ns >= 0),
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE templates IS 'Quality threshold templates for different channel types';

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
    probe_id INTEGER REFERENCES probes(probe_id) NOT NULL,
    input_url TEXT,
    template_id INTEGER REFERENCES templates(template_id) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE channels IS 'TV channels and VOD content to be monitored';
COMMENT ON COLUMN channels.tier IS 'Channel tier: 1=Premium, 2=Standard, 3=Basic';

-- ============================================================================
-- INPUTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS inputs (
    input_id SERIAL PRIMARY KEY,
    input_name VARCHAR(200) NOT NULL,
    input_url TEXT NOT NULL,
    input_type VARCHAR(50) NOT NULL CHECK (input_type IN ('MPEGTS_UDP', 'HTTP', 'HLS', 'RTMP', 'SRT', 'NDI')),
    input_protocol VARCHAR(50),
    input_port INTEGER CHECK (input_port > 0 AND input_port < 65536),
    channel_id INTEGER REFERENCES channels(channel_id),
    probe_id INTEGER NOT NULL REFERENCES probes(probe_id),
    is_primary BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    bitrate_mbps FLOAT,
    input_metadata JSONB,
    snapshot_url TEXT,
    last_snapshot_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE inputs IS 'Input sources monitored by probes';
COMMENT ON COLUMN inputs.is_primary IS 'True if this is the primary input for the channel (vs backup)';

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(channel_id) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO')),
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE alerts IS 'Quality and availability alerts';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Inputs
CREATE INDEX IF NOT EXISTS idx_inputs_enabled ON inputs(enabled);
CREATE INDEX IF NOT EXISTS idx_inputs_probe ON inputs(probe_id);
CREATE INDEX IF NOT EXISTS idx_inputs_channel ON inputs(channel_id);
CREATE INDEX IF NOT EXISTS idx_inputs_type ON inputs(input_type);
CREATE INDEX IF NOT EXISTS idx_inputs_updated ON inputs(updated_at);

-- Channels
CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled);
CREATE INDEX IF NOT EXISTS idx_channels_probe ON channels(probe_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channels_tier ON channels(tier);

-- Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_channel ON alerts(channel_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

-- Probes
CREATE INDEX IF NOT EXISTS idx_probes_layer ON probes(layer);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
CREATE TRIGGER update_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inputs_updated_at ON inputs;
CREATE TRIGGER update_inputs_updated_at
    BEFORE UPDATE ON inputs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default probe
INSERT INTO probes (probe_name, layer, location, ip_address, port)
VALUES ('packager-01-probe', 2, 'Datacenter-HN', '10.0.1.10', 8443)
ON CONFLICT (probe_name) DO NOTHING;

-- Insert default templates
INSERT INTO templates (template_name, description, codec)
VALUES
    ('default-hd', 'Default HD template (1080p H.264)', 'H.264'),
    ('default-4k', 'Default 4K template (2160p HEVC)', 'HEVC'),
    ('default-sd', 'Default SD template (720p H.264)', 'H.264')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Active inputs with channel info
CREATE OR REPLACE VIEW v_active_inputs AS
SELECT
    i.input_id,
    i.input_name,
    i.input_url,
    i.input_type,
    i.input_port,
    i.is_primary,
    i.bitrate_mbps,
    i.snapshot_url,
    i.last_snapshot_at,
    c.channel_id,
    c.channel_name,
    c.channel_code,
    p.probe_name,
    p.location,
    i.created_at,
    i.updated_at
FROM inputs i
LEFT JOIN channels c ON i.channel_id = c.channel_id
JOIN probes p ON i.probe_id = p.probe_id
WHERE i.enabled = TRUE;

COMMENT ON VIEW v_active_inputs IS 'All active inputs with channel and probe information';

-- View: Active alerts with channel info
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT
    a.alert_id,
    a.alert_type,
    a.severity,
    a.message,
    a.acknowledged,
    a.acknowledged_by,
    a.acknowledged_at,
    a.created_at,
    c.channel_id,
    c.channel_name,
    c.channel_code,
    c.tier
FROM alerts a
JOIN channels c ON a.channel_id = c.channel_id
WHERE a.resolved = FALSE
ORDER BY
    CASE a.severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'MAJOR' THEN 2
        WHEN 'MINOR' THEN 3
        WHEN 'WARNING' THEN 4
        WHEN 'INFO' THEN 5
    END,
    a.created_at DESC;

COMMENT ON VIEW v_active_alerts IS 'All unresolved alerts sorted by severity';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant permissions to monitor_app user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO monitor_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO monitor_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitor_app;

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(10) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_version (version, description)
VALUES ('1.0', 'Initial schema with probes, channels, inputs, alerts')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
