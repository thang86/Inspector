// FPT Play - React Dashboard Component
// Real-time channel monitoring, alert management, configuration UI

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ReferenceLine, ReferenceArea } from 'recharts';
import './Dashboard.css';
import { useToast } from './hooks';
import Toast from './components/Toast';

const API_BASE = '/api/v1';

// ============================================================================
// COMPONENTS
// ============================================================================

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [channels, setChannels] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [inputs, setInputs] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ tier: null, is_4k: null });
  const toast = useToast();

  useEffect(() => {
    fetchChannels();
    fetchActiveAlerts();
    fetchInputs();
    if (activeTab === 'debug') {
      fetchDebugInfo();
    }
    const interval = setInterval(() => {
      fetchChannels();
      fetchActiveAlerts();
      fetchInputs();
      if (activeTab === 'debug') {
        fetchDebugInfo();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, activeTab]);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.tier) params.append('tier', filter.tier);
      if (filter.is_4k !== null) params.append('is_4k', filter.is_4k);

      const response = await fetch(`${API_BASE}/channels?${params}`);
      const data = await response.json();
      setChannels(data.channels || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchActiveAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/alerts/active`);
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  const fetchInputs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/inputs`);
      const data = await response.json();
      setInputs(data.inputs || []);
    } catch (error) {
      console.error('Error fetching inputs:', error);
    }
  }, []);

  const fetchDebugInfo = useCallback(async () => {
    try {
      const [inputsRes, systemRes] = await Promise.all([
        fetch(`${API_BASE}/debug/inputs`),
        fetch(`${API_BASE}/debug/system`)
      ]);
      const inputsData = await inputsRes.json();
      const systemData = await systemRes.json();
      setDebugInfo({
        inputs: inputsData,
        system: systemData
      });
    } catch (error) {
      console.error('Error fetching debug info:', error);
    }
  }, []);

  const acknowledgeAlert = async (alertId) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'operator' })
      });
      if (response.ok) {
        fetchActiveAlerts();
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchActiveAlerts();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  return (
    <div className="dashboard">
      <Header />
      
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveTab('channels')}
        >
          Channels
        </button>
        <button
          className={`tab ${activeTab === 'inputs' ? 'active' : ''}`}
          onClick={() => setActiveTab('inputs')}
        >
          Inputs
        </button>
        <button
          className={`tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          Alerts ({alerts.length})
        </button>
        <button
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
        <button
          className={`tab ${activeTab === 'debug' ? 'active' : ''}`}
          onClick={() => setActiveTab('debug')}
        >
          Debug
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && <OverviewTab channels={channels} alerts={alerts} />}

        {activeTab === 'channels' && (
          <ChannelsTab
            channels={channels}
            loading={loading}
            filter={filter}
            onFilterChange={setFilter}
          />
        )}

        {activeTab === 'inputs' && (
          <InputsTab
            inputs={inputs}
            loading={loading}
            onRefresh={fetchInputs}
            toast={toast}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsTab
            alerts={alerts}
            onAcknowledge={acknowledgeAlert}
            onResolve={resolveAlert}
          />
        )}

        {activeTab === 'metrics' && <MetricsTab />}

        {activeTab === 'debug' && (
          <DebugTab
            debugInfo={debugInfo}
            onRefresh={fetchDebugInfo}
          />
        )}
      </div>

      <Toast toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
};

// ============================================================================
// HEADER
// ============================================================================

const Header = () => {
  const [systemStatus, setSystemStatus] = useState({});

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        setSystemStatus(data);
      } catch (error) {
        console.error('Error fetching system status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="header">
      <div className="title">
        <h1>🎬 FPT Play - Video Monitoring Control Center</h1>
      </div>
      
      <div className="status-bar">
        <div className={`status-item ${systemStatus.status === 'healthy' ? 'healthy' : 'unhealthy'}`}>
          <span className="status-indicator">●</span>
          <span>System: {systemStatus.status || 'Loading...'}</span>
        </div>
        <div className="status-item">
          <span>Database: Connected</span>
        </div>
        <div className="status-item">
          <span>Updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// OVERVIEW TAB
// ============================================================================

const OverviewTab = ({ channels, alerts }) => {
  const critical = alerts.filter(a => a.severity === 'CRITICAL').length;
  const major = alerts.filter(a => a.severity === 'MAJOR').length;
  const monitoring_4k = channels.filter(c => c.is_4k).length;

  return (
    <div className="overview-tab">
      <div className="kpi-grid">
        <KPICard 
          title="Active Channels" 
          value={channels.length} 
          status="success"
        />
        <KPICard 
          title="4K Channels" 
          value={monitoring_4k} 
          status="info"
        />
        <KPICard 
          title="CRITICAL Alerts" 
          value={critical} 
          status={critical > 0 ? 'danger' : 'success'}
        />
        <KPICard 
          title="MAJOR Alerts" 
          value={major} 
          status={major > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="charts">
        <div className="chart-container">
          <h3>Channel Distribution by Tier</h3>
          <TierDistributionChart channels={channels} />
        </div>
        
        <div className="chart-container">
          <h3>Alert Severity Breakdown</h3>
          <AlertSeverityChart alerts={alerts} />
        </div>
      </div>

      <div className="recent-events">
        <h3>Recent Alerts (Last 10)</h3>
        <RecentAlertsList alerts={alerts.slice(0, 10)} />
      </div>
    </div>
  );
};

const KPICard = ({ title, value, status }) => (
  <div className={`kpi-card ${status}`}>
    <div className="kpi-title">{title}</div>
    <div className="kpi-value">{value}</div>
  </div>
);

const TierDistributionChart = ({ channels }) => {
  const data = [
    { tier: 'Tier 1', count: channels.filter(c => c.tier === 1).length },
    { tier: 'Tier 2', count: channels.filter(c => c.tier === 2).length },
    { tier: 'Tier 3', count: channels.filter(c => c.tier === 3).length }
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334455" />
        <XAxis dataKey="tier" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#00E5FF" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const AlertSeverityChart = ({ alerts }) => {
  const data = [
    { severity: 'CRITICAL', count: alerts.filter(a => a.severity === 'CRITICAL').length },
    { severity: 'MAJOR', count: alerts.filter(a => a.severity === 'MAJOR').length },
    { severity: 'MINOR', count: alerts.filter(a => a.severity === 'MINOR').length }
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334455" />
        <XAxis dataKey="severity" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#00D9A3" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const RecentAlertsList = ({ alerts }) => (
  <div className="alerts-list">
    {alerts.length === 0 ? (
      <p className="no-data">No recent alerts</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Channel</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(alert => (
            <tr key={alert.alert_id} className={`severity-${alert.severity.toLowerCase()}`}>
              <td>{new Date(alert.created_at).toLocaleTimeString()}</td>
              <td>{alert.channel_id}</td>
              <td>{alert.alert_type}</td>
              <td className={`badge severity-${alert.severity.toLowerCase()}`}>{alert.severity}</td>
              <td>{alert.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ============================================================================
// CHANNELS TAB
// ============================================================================

const ChannelsTab = ({ channels, loading, filter, onFilterChange }) => {
  return (
    <div className="channels-tab">
      <div className="filter-bar">
        <label>
          Tier:
          <select value={filter.tier || ''} onChange={(e) => 
            onFilterChange({ ...filter, tier: e.target.value ? parseInt(e.target.value) : null })
          }>
            <option value="">All</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </label>

        <label>
          Type:
          <select onChange={(e) => 
            onFilterChange({ ...filter, is_4k: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null })
          }>
            <option value="">All</option>
            <option value="true">4K Only</option>
            <option value="false">HD/SD</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="loading">Loading channels...</div>
      ) : (
        <div className="channels-grid">
          {channels.length === 0 ? (
            <p className="no-data">No channels found</p>
          ) : (
            channels.map(channel => (
              <ChannelCard key={channel.channel_id} channel={channel} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ChannelCard = ({ channel }) => (
  <div className={`channel-card ${channel.is_4k ? '4k' : 'hd'}`}>
    <div className="channel-header">
      <h4>{channel.channel_name}</h4>
      <span className={`status-badge ${channel.enabled ? 'active' : 'inactive'}`}>
        {channel.enabled ? '●' : '○'}
      </span>
    </div>
    
    <div className="channel-info">
      <p><strong>Code:</strong> {channel.channel_code}</p>
      <p><strong>Resolution:</strong> {channel.resolution || 'Unknown'}</p>
      <p><strong>FPS:</strong> {channel.fps || 'Unknown'}</p>
      <p><strong>Codec:</strong> {channel.codec || 'Unknown'}</p>
      <p><strong>Tier:</strong> {channel.tier}</p>
      
      {channel.is_4k && <span className="badge 4k">4K</span>}
      {channel.is_hdr && <span className="badge hdr">HDR</span>}
      {channel.has_atmos && <span className="badge atmos">Atmos</span>}
    </div>

    <div className="channel-actions">
      <button className="btn btn-small">View Metrics</button>
      <button className="btn btn-small">Edit</button>
    </div>
  </div>
);

// ============================================================================
// ALERTS TAB
// ============================================================================

const AlertsTab = ({ alerts, onAcknowledge, onResolve }) => {
  const [filter, setFilter] = useState('all');

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'critical') return a.severity === 'CRITICAL';
    if (filter === 'major') return a.severity === 'MAJOR';
    if (filter === 'unack') return !a.acknowledged;
    return true;
  });

  return (
    <div className="alerts-tab">
      <div className="alert-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({alerts.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'critical' ? 'active' : ''}`}
          onClick={() => setFilter('critical')}
        >
          Critical ({alerts.filter(a => a.severity === 'CRITICAL').length})
        </button>
        <button 
          className={`filter-btn ${filter === 'major' ? 'active' : ''}`}
          onClick={() => setFilter('major')}
        >
          Major ({alerts.filter(a => a.severity === 'MAJOR').length})
        </button>
        <button 
          className={`filter-btn ${filter === 'unack' ? 'active' : ''}`}
          onClick={() => setFilter('unack')}
        >
          Unacknowledged ({alerts.filter(a => !a.acknowledged).length})
        </button>
      </div>

      <div className="alerts-table">
        {filteredAlerts.length === 0 ? (
          <p className="no-data">No alerts found</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Channel</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map(alert => (
                <AlertRow 
                  key={alert.alert_id} 
                  alert={alert}
                  onAcknowledge={() => onAcknowledge(alert.alert_id)}
                  onResolve={() => onResolve(alert.alert_id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const AlertRow = ({ alert, onAcknowledge, onResolve }) => (
  <tr className={`alert-row severity-${alert.severity.toLowerCase()}`}>
    <td>{new Date(alert.created_at).toLocaleString()}</td>
    <td>Channel {alert.channel_id}</td>
    <td>{alert.alert_type}</td>
    <td><span className={`badge severity-${alert.severity.toLowerCase()}`}>{alert.severity}</span></td>
    <td>{alert.message}</td>
    <td>
      {alert.acknowledged ? 'ACK' : 'NEW'}
      {alert.resolved ? ' / RESOLVED' : ''}
    </td>
    <td className="actions">
      {!alert.acknowledged && (
        <button className="btn btn-xs" onClick={onAcknowledge}>Acknowledge</button>
      )}
      {!alert.resolved && (
        <button className="btn btn-xs" onClick={onResolve}>Resolve</button>
      )}
    </td>
  </tr>
);

// ============================================================================
// METRICS TAB - Custom Components
// ============================================================================

// Custom Tooltip for Bitrate Chart
const CustomBitrateTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const bitrateValue = parseFloat(data.bitrate);

  return (
    <div
      style={{
        background: 'rgba(30, 35, 45, 0.95)',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{ marginBottom: '6px', fontSize: '11px', color: '#8B95A5', fontWeight: 500 }}>
        {data.timestamp ? new Date(data.timestamp).toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) : data.time}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#00FFFF' }}>
        {bitrateValue.toFixed(3)} Mbps
      </div>
      {bitrateValue < 0.8 && (
        <div style={{ marginTop: '6px', fontSize: '10px', color: '#FF6B6B', fontWeight: 500 }}>
          ⚠ Below target
        </div>
      )}
      {bitrateValue > 1.2 && (
        <div style={{ marginTop: '6px', fontSize: '10px', color: '#FFB800', fontWeight: 500 }}>
          ⚠ Above expected
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CODEC PANEL - ENHANCED WITH COMPARISONS
// ============================================================================

const CodecPanel = ({ codecInfo }) => {
  if (!codecInfo) return null;

  // Video codec details and comparison data
  const getVideoCodecDetails = (codec) => {
    const codecName = codec?.toLowerCase() || 'unknown';
    const details = {
      'h264': {
        fullName: 'H.264 (AVC)',
        generation: '4th Gen',
        efficiency: 'Baseline',
        compression: '1x',
        year: '2003',
        usage: 'Universal compatibility',
        color: '#00D9A3'
      },
      'hevc': {
        fullName: 'H.265 (HEVC)',
        generation: '5th Gen',
        efficiency: 'High',
        compression: '2x better than H.264',
        year: '2013',
        usage: '4K/8K streaming',
        color: '#00E5FF'
      },
      'h265': {
        fullName: 'H.265 (HEVC)',
        generation: '5th Gen',
        efficiency: 'High',
        compression: '2x better than H.264',
        year: '2013',
        usage: '4K/8K streaming',
        color: '#00E5FF'
      },
      'av1': {
        fullName: 'AV1',
        generation: '6th Gen',
        efficiency: 'Very High',
        compression: '30% better than HEVC',
        year: '2018',
        usage: 'Next-gen streaming',
        color: '#A78BFA'
      },
      'vp9': {
        fullName: 'VP9',
        generation: '5th Gen',
        efficiency: 'High',
        compression: 'Similar to HEVC',
        year: '2013',
        usage: 'YouTube, WebRTC',
        color: '#F59E0B'
      },
      'mpeg2video': {
        fullName: 'MPEG-2',
        generation: '2nd Gen',
        efficiency: 'Low',
        compression: 'Legacy',
        year: '1995',
        usage: 'Broadcast TV, DVD',
        color: '#8B95A5'
      }
    };
    return details[codecName] || {
      fullName: codec?.toUpperCase() || 'Unknown',
      generation: 'N/A',
      efficiency: 'Unknown',
      compression: 'N/A',
      year: 'N/A',
      usage: 'Unknown',
      color: '#6B7785'
    };
  };

  // Audio codec details and comparison data
  const getAudioCodecDetails = (codec) => {
    const codecName = codec?.toLowerCase() || 'unknown';
    const details = {
      'aac': {
        fullName: 'AAC (Advanced Audio Coding)',
        profile: 'LC/HE/HEv2',
        channels: 'Up to 48',
        quality: 'High',
        bitrate: '96-320 kbps',
        usage: 'Streaming, broadcasting',
        color: '#00D9A3'
      },
      'ac3': {
        fullName: 'AC-3 (Dolby Digital)',
        profile: '5.1 Surround',
        channels: 'Up to 5.1',
        quality: 'Good',
        bitrate: '192-640 kbps',
        usage: 'DVD, Blu-ray, broadcast',
        color: '#00E5FF'
      },
      'eac3': {
        fullName: 'E-AC-3 (Dolby Digital Plus)',
        profile: '7.1 Surround',
        channels: 'Up to 15.1',
        quality: 'Very High',
        bitrate: '32-6144 kbps',
        usage: 'Streaming, Blu-ray',
        color: '#A78BFA'
      },
      'opus': {
        fullName: 'Opus',
        profile: 'Interactive',
        channels: 'Up to 255',
        quality: 'Excellent',
        bitrate: '6-510 kbps',
        usage: 'WebRTC, gaming, VoIP',
        color: '#F59E0B'
      },
      'mp3': {
        fullName: 'MP3 (MPEG-1 Audio Layer III)',
        profile: 'Stereo',
        channels: 'Up to 2',
        quality: 'Good',
        bitrate: '128-320 kbps',
        usage: 'Legacy audio',
        color: '#8B95A5'
      },
      'mp2': {
        fullName: 'MP2 (MPEG-1 Audio Layer II)',
        profile: 'Broadcast',
        channels: 'Up to 2',
        quality: 'Fair',
        bitrate: '192-384 kbps',
        usage: 'DVB broadcast',
        color: '#6B7785'
      }
    };
    return details[codecName] || {
      fullName: codec?.toUpperCase() || 'Unknown',
      profile: 'N/A',
      channels: 'N/A',
      quality: 'Unknown',
      bitrate: 'N/A',
      usage: 'Unknown',
      color: '#6B7785'
    };
  };

  // Resolution details
  const getResolutionDetails = (resolution) => {
    const resMap = {
      '1920x1080': { name: 'Full HD', pixels: '2.1 MP', aspect: '16:9', category: 'HD' },
      '1280x720': { name: 'HD', pixels: '0.9 MP', aspect: '16:9', category: 'HD' },
      '3840x2160': { name: '4K UHD', pixels: '8.3 MP', aspect: '16:9', category: '4K' },
      '7680x4320': { name: '8K UHD', pixels: '33.2 MP', aspect: '16:9', category: '8K' },
      '720x576': { name: 'PAL SD', pixels: '0.4 MP', aspect: '4:3', category: 'SD' },
      '720x480': { name: 'NTSC SD', pixels: '0.3 MP', aspect: '4:3', category: 'SD' }
    };
    return resMap[resolution] || { name: resolution || 'Unknown', pixels: 'N/A', aspect: 'N/A', category: 'N/A' };
  };

  const videoDetails = getVideoCodecDetails(codecInfo.video_codec);
  const audioDetails = getAudioCodecDetails(codecInfo.audio_codec);
  const resolutionDetails = getResolutionDetails(codecInfo.video_resolution);

  return (
    <div className="codec-panel">
      <h3>🎬 Stream Codec Information</h3>

      <div className="codec-main-grid">
        {/* Video Codec Section */}
        <div className="codec-section video-section">
          <div className="codec-header">
            <h4>📺 Video Codec</h4>
            <span className="codec-badge-large" style={{ background: videoDetails.color }}>
              {videoDetails.fullName}
            </span>
          </div>

          <div className="codec-details-grid">
            <div className="codec-detail-item">
              <span className="detail-label">Codec Family:</span>
              <span className="detail-value">{codecInfo.video_codec?.toUpperCase() || 'Unknown'}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Generation:</span>
              <span className="detail-value">{videoDetails.generation}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Compression:</span>
              <span className="detail-value">{videoDetails.compression}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Efficiency:</span>
              <span className="detail-value">{videoDetails.efficiency}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Profile:</span>
              <span className="detail-value">{codecInfo.video_profile || 'Unknown'}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Level:</span>
              <span className="detail-value">{codecInfo.video_level || 'Unknown'}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Standard Year:</span>
              <span className="detail-value">{videoDetails.year}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Common Usage:</span>
              <span className="detail-value">{videoDetails.usage}</span>
            </div>
          </div>

          <div className="codec-specs">
            <div className="spec-item">
              <div className="spec-icon">📐</div>
              <div className="spec-content">
                <div className="spec-label">Resolution</div>
                <div className="spec-value">{codecInfo.video_resolution || 'Unknown'}</div>
                <div className="spec-detail">{resolutionDetails.name} • {resolutionDetails.pixels} • {resolutionDetails.aspect}</div>
              </div>
            </div>
            <div className="spec-item">
              <div className="spec-icon">🎞️</div>
              <div className="spec-content">
                <div className="spec-label">Frame Rate</div>
                <div className="spec-value">{codecInfo.video_fps || 'Unknown'} fps</div>
                <div className="spec-detail">{parseFloat(codecInfo.video_fps) >= 50 ? 'High frame rate' : 'Standard'}</div>
              </div>
            </div>
            <div className="spec-item">
              <div className="spec-icon">💾</div>
              <div className="spec-content">
                <div className="spec-label">Video Bitrate</div>
                <div className="spec-value">{codecInfo.video_bitrate_kbps?.toFixed(0) || 0} kbps</div>
                <div className="spec-detail">{(codecInfo.video_bitrate_kbps / 1000).toFixed(2)} Mbps</div>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Codec Section */}
        <div className="codec-section audio-section">
          <div className="codec-header">
            <h4>🔊 Audio Codec</h4>
            <span className="codec-badge-large" style={{ background: audioDetails.color }}>
              {audioDetails.fullName}
            </span>
          </div>

          <div className="codec-details-grid">
            <div className="codec-detail-item">
              <span className="detail-label">Codec Family:</span>
              <span className="detail-value">{codecInfo.audio_codec?.toUpperCase() || 'Unknown'}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Profile:</span>
              <span className="detail-value">{audioDetails.profile}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Quality:</span>
              <span className="detail-value">{audioDetails.quality}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Max Channels:</span>
              <span className="detail-value">{audioDetails.channels}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Typical Bitrate:</span>
              <span className="detail-value">{audioDetails.bitrate}</span>
            </div>
            <div className="codec-detail-item">
              <span className="detail-label">Common Usage:</span>
              <span className="detail-value">{audioDetails.usage}</span>
            </div>
          </div>

          <div className="codec-specs">
            <div className="spec-item">
              <div className="spec-icon">🎵</div>
              <div className="spec-content">
                <div className="spec-label">Channels</div>
                <div className="spec-value">{codecInfo.audio_channels || 'Unknown'}</div>
                <div className="spec-detail">{codecInfo.audio_channels === 'stereo' ? '2.0 Stereo' : codecInfo.audio_channels}</div>
              </div>
            </div>
            <div className="spec-item">
              <div className="spec-icon">📊</div>
              <div className="spec-content">
                <div className="spec-label">Sample Rate</div>
                <div className="spec-value">{codecInfo.audio_sample_rate || 'Unknown'}</div>
                <div className="spec-detail">{parseInt(codecInfo.audio_sample_rate) >= 48000 ? 'Professional' : 'Standard'}</div>
              </div>
            </div>
            <div className="spec-item">
              <div className="spec-icon">💿</div>
              <div className="spec-content">
                <div className="spec-label">Audio Bitrate</div>
                <div className="spec-value">{codecInfo.audio_bitrate_kbps?.toFixed(0) || 0} kbps</div>
                <div className="spec-detail">{codecInfo.audio_bitrate_kbps >= 256 ? 'High quality' : codecInfo.audio_bitrate_kbps >= 128 ? 'Good quality' : 'Standard'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Codec Comparison Tables */}
      <div className="codec-comparison-section">
        <h4>📊 Codec Technology Comparison</h4>

        <div className="comparison-tables">
          {/* Video Codecs Comparison */}
          <div className="comparison-table">
            <h5>Video Codecs</h5>
            <table>
              <thead>
                <tr>
                  <th>Codec</th>
                  <th>Generation</th>
                  <th>Compression</th>
                  <th>Efficiency</th>
                  <th>Best For</th>
                </tr>
              </thead>
              <tbody>
                <tr className={codecInfo.video_codec?.toLowerCase() === 'h264' ? 'current-codec' : ''}>
                  <td><strong>H.264 (AVC)</strong></td>
                  <td>4th Gen (2003)</td>
                  <td>Baseline (1x)</td>
                  <td>Standard</td>
                  <td>Universal compatibility</td>
                </tr>
                <tr className={codecInfo.video_codec?.toLowerCase() === 'hevc' || codecInfo.video_codec?.toLowerCase() === 'h265' ? 'current-codec' : ''}>
                  <td><strong>H.265 (HEVC)</strong></td>
                  <td>5th Gen (2013)</td>
                  <td>2x better</td>
                  <td>High</td>
                  <td>4K/8K streaming</td>
                </tr>
                <tr className={codecInfo.video_codec?.toLowerCase() === 'av1' ? 'current-codec' : ''}>
                  <td><strong>AV1</strong></td>
                  <td>6th Gen (2018)</td>
                  <td>30% better than HEVC</td>
                  <td>Very High</td>
                  <td>Next-gen streaming</td>
                </tr>
                <tr className={codecInfo.video_codec?.toLowerCase() === 'vp9' ? 'current-codec' : ''}>
                  <td><strong>VP9</strong></td>
                  <td>5th Gen (2013)</td>
                  <td>Similar to HEVC</td>
                  <td>High</td>
                  <td>YouTube, WebRTC</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Audio Codecs Comparison */}
          <div className="comparison-table">
            <h5>Audio Codecs</h5>
            <table>
              <thead>
                <tr>
                  <th>Codec</th>
                  <th>Max Channels</th>
                  <th>Bitrate Range</th>
                  <th>Quality</th>
                  <th>Best For</th>
                </tr>
              </thead>
              <tbody>
                <tr className={codecInfo.audio_codec?.toLowerCase() === 'aac' ? 'current-codec' : ''}>
                  <td><strong>AAC</strong></td>
                  <td>Up to 48</td>
                  <td>96-320 kbps</td>
                  <td>High</td>
                  <td>Streaming, broadcast</td>
                </tr>
                <tr className={codecInfo.audio_codec?.toLowerCase() === 'ac3' ? 'current-codec' : ''}>
                  <td><strong>AC-3 (DD)</strong></td>
                  <td>5.1</td>
                  <td>192-640 kbps</td>
                  <td>Good</td>
                  <td>DVD, broadcast</td>
                </tr>
                <tr className={codecInfo.audio_codec?.toLowerCase() === 'eac3' ? 'current-codec' : ''}>
                  <td><strong>E-AC-3 (DD+)</strong></td>
                  <td>15.1</td>
                  <td>32-6144 kbps</td>
                  <td>Very High</td>
                  <td>Streaming, Blu-ray</td>
                </tr>
                <tr className={codecInfo.audio_codec?.toLowerCase() === 'opus' ? 'current-codec' : ''}>
                  <td><strong>Opus</strong></td>
                  <td>255</td>
                  <td>6-510 kbps</td>
                  <td>Excellent</td>
                  <td>WebRTC, VoIP</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// VIDEO MOS PANEL
// ============================================================================

const VideoMOSPanel = ({ qoeMetrics, tr101290Metrics, mdiMetrics }) => {
  if (!qoeMetrics || !tr101290Metrics) return null;

  const getMOSColor = (mos) => {
    if (mos >= 4.5) return 'excellent';
    if (mos >= 4.0) return 'good';
    if (mos >= 3.5) return 'fair';
    if (mos >= 2.5) return 'poor';
    return 'bad';
  };

  const getMOSLabel = (mos) => {
    if (mos >= 4.5) return 'Excellent';
    if (mos >= 4.0) return 'Good';
    if (mos >= 3.5) return 'Fair';
    if (mos >= 2.5) return 'Poor';
    return 'Bad';
  };

  const mosColor = getMOSColor(qoeMetrics.overall_mos || 0);

  return (
    <div className="mos-panel">
      <h3>Video MOS (Mean Opinion Score)</h3>

      <div className="mos-display">
        <div className={`mos-score mos-${mosColor}`}>
          <div className="mos-value">{qoeMetrics.overall_mos?.toFixed(2) || 'N/A'}</div>
          <div className="mos-label">{getMOSLabel(qoeMetrics.overall_mos || 0)}</div>
        </div>

        <div className="mos-factors">
          <h4>Quality Factors</h4>

          <div className="factor-item">
            <span className="factor-label">TR 101 290 P1 Errors:</span>
            <span className={`factor-value ${tr101290Metrics.priority_1?.total_p1_errors > 0 ? 'error' : 'success'}`}>
              {tr101290Metrics.priority_1?.total_p1_errors || 0}
            </span>
          </div>

          <div className="factor-item">
            <span className="factor-label">TR 101 290 P2 Errors:</span>
            <span className={`factor-value ${tr101290Metrics.priority_2?.total_p2_errors > 0 ? 'warning' : 'success'}`}>
              {tr101290Metrics.priority_2?.total_p2_errors || 0}
            </span>
          </div>

          {mdiMetrics && (
            <>
              <div className="factor-item">
                <span className="factor-label">Packet Loss:</span>
                <span className={`factor-value ${mdiMetrics.packets_lost > 0 ? 'error' : 'success'}`}>
                  {mdiMetrics.packets_lost || 0} packets
                </span>
              </div>

              <div className="factor-item">
                <span className="factor-label">Jitter:</span>
                <span className={`factor-value ${mdiMetrics.jitter_ms > 10 ? 'warning' : 'success'}`}>
                  {mdiMetrics.jitter_ms?.toFixed(2) || '0.00'} ms
                </span>
              </div>
            </>
          )}

          <div className="factor-item">
            <span className="factor-label">Video Stream:</span>
            <span className={`factor-value ${qoeMetrics.video_pid_active ? 'success' : 'error'}`}>
              {qoeMetrics.video_pid_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="factor-item">
            <span className="factor-label">Audio Stream:</span>
            <span className={`factor-value ${qoeMetrics.audio_pid_active ? 'success' : 'error'}`}>
              {qoeMetrics.audio_pid_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// AUDIO LUFS PANEL
// ============================================================================

const AudioLUFSPanel = ({ qoeMetrics }) => {
  if (!qoeMetrics) return null;

  const getLUFSCompliance = (lufs) => {
    if (lufs === null || lufs === undefined) return 'non-compliant';
    // EBU R128 target: -23 LUFS ± 1 LU
    if (Math.abs(lufs + 23) <= 1.0) return 'compliant';
    if (Math.abs(lufs + 23) <= 2.0) return 'acceptable';
    return 'non-compliant';
  };

  const lufs = qoeMetrics.audio_loudness_lufs;
  const compliance = getLUFSCompliance(lufs);

  return (
    <div className="lufs-panel">
      <h3>Audio Loudness (LUFS)</h3>
      <p className="lufs-desc">EBU R128 Compliance Measurement</p>

      <div className="lufs-display">
        <div className={`lufs-meter lufs-${compliance}`}>
          <div className="lufs-value">
            {lufs != null ? lufs.toFixed(1) : 'N/A'}
            <span className="lufs-unit">LUFS</span>
          </div>
          <div className="lufs-label">
            Integrated Loudness
          </div>
        </div>

        <div className="lufs-details">
          <div className="lufs-metric">
            <span className="metric-label">Integrated (I):</span>
            <span className="metric-value">
              {qoeMetrics.audio_loudness_i != null ? `${qoeMetrics.audio_loudness_i.toFixed(1)} LUFS` : 'N/A'}
            </span>
          </div>

          <div className="lufs-metric">
            <span className="metric-label">Loudness Range (LRA):</span>
            <span className="metric-value">
              {qoeMetrics.audio_loudness_lra != null ? `${qoeMetrics.audio_loudness_lra.toFixed(1)} LU` : 'N/A'}
            </span>
          </div>

          <div className="lufs-metric">
            <span className="metric-label">EBU R128 Target:</span>
            <span className="metric-value">-23.0 LUFS ± 1 LU</span>
          </div>

          <div className={`compliance-status status-${compliance}`}>
            <span className="status-icon">
              {compliance === 'compliant' ? '✓' : compliance === 'acceptable' ? '⚠' : '✗'}
            </span>
            <span className="status-text">
              {compliance === 'compliant' ? 'EBU R128 Compliant' :
               compliance === 'acceptable' ? 'Acceptable Range' :
               'Non-Compliant'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// METRICS TAB
// ============================================================================

const MetricsTab = () => {
  const [inputs, setInputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState(null);
  const [streamMetrics, setStreamMetrics] = useState([]);
  const [tr101290Metrics, setTR101290Metrics] = useState(null);
  const [mdiMetrics, setMDIMetrics] = useState(null);
  const [qoeMetrics, setQoEMetrics] = useState(null);
  const [codecInfo, setCodecInfo] = useState(null);
  const [inputStatus, setInputStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Zoom and pan state for Bitrate chart
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [zoomDomain, setZoomDomain] = useState(null);

  // Fetch available inputs
  useEffect(() => {
    const fetchInputs = async () => {
      try {
        const response = await fetch(`${API_BASE}/inputs`);
        const data = await response.json();
        const activeInputs = (data.inputs || []).filter(i => i.enabled);
        setInputs(activeInputs);

        // Select first enabled input by default
        if (activeInputs.length > 0 && !selectedInput) {
          setSelectedInput(activeInputs[0].input_id);
        }
      } catch (error) {
        console.error('Error fetching inputs:', error);
      }
    };

    fetchInputs();
  }, [selectedInput]);

  // Handle zoom functionality
  const handleZoom = useCallback(() => {
    if (refAreaLeft === refAreaRight || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    // Get the indices
    const data = streamMetrics;
    const leftIndex = data.findIndex(item => item.time === refAreaLeft);
    const rightIndex = data.findIndex(item => item.time === refAreaRight);

    if (leftIndex === -1 || rightIndex === -1) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    // Ensure left is before right
    const [startIdx, endIdx] = leftIndex < rightIndex
      ? [leftIndex, rightIndex]
      : [rightIndex, leftIndex];

    // Calculate Y domain (bitrate range)
    const zoomedData = data.slice(startIdx, endIdx + 1);
    const bitrateValues = zoomedData.map(d => parseFloat(d.bitrate));
    const minBitrate = Math.min(...bitrateValues);
    const maxBitrate = Math.max(...bitrateValues);
    const padding = (maxBitrate - minBitrate) * 0.1; // 10% padding

    setZoomDomain({
      x1: data[startIdx].time,
      x2: data[endIdx].time,
      y1: (minBitrate - padding).toFixed(3),
      y2: (maxBitrate + padding).toFixed(3)
    });

    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, streamMetrics]);

  // Fetch metrics for selected input
  useEffect(() => {
    if (!selectedInput) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const [streamRes, tr101290Res, statusRes, mdiRes, qoeRes, codecRes] = await Promise.all([
          fetch(`${API_BASE}/metrics/stream/${selectedInput}?minutes=60`),
          fetch(`${API_BASE}/metrics/tr101290/${selectedInput}`),
          fetch(`${API_BASE}/metrics/status/${selectedInput}`),
          fetch(`${API_BASE}/metrics/mdi/${selectedInput}`),
          fetch(`${API_BASE}/metrics/qoe/${selectedInput}`),
          fetch(`${API_BASE}/metrics/codec/${selectedInput}`)
        ]);

        if (streamRes.ok) {
          const streamData = await streamRes.json();
          // Transform data for charts - CHANGED: Keep in Mbps
          const bitrateData = streamData.metrics
            .filter(m => m.field === 'bitrate_mbps' && m.value != null)
            .map(m => ({
              time: new Date(m.time).toLocaleTimeString(),
              bitrate: m.value.toFixed(3), // Keep as Mbps
              timestamp: m.time
            }))
            .slice(-60); // Last 60 data points

          setStreamMetrics(bitrateData);
        }

        if (tr101290Res.ok) {
          const tr101290Data = await tr101290Res.json();
          setTR101290Metrics(tr101290Data);
        }

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setInputStatus(statusData.data);
        }

        if (mdiRes.ok) {
          const mdiData = await mdiRes.json();
          setMDIMetrics(mdiData.data);
        }

        if (qoeRes.ok) {
          const qoeData = await qoeRes.json();
          setQoEMetrics(qoeData.data);
        }

        if (codecRes.ok) {
          const codecData = await codecRes.json();
          setCodecInfo(codecData.data);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Auto-refresh every 10 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedInput, autoRefresh]);

  const selectedInputName = inputs.find(i => i.input_id === selectedInput)?.input_name || 'Unknown';

  return (
    <div className="metrics-tab">
      <div className="metrics-header">
        <div className="metrics-controls">
          <label>
            <strong>Select Input:</strong>
            <select
              value={selectedInput || ''}
              onChange={(e) => setSelectedInput(parseInt(e.target.value))}
            >
              <option value="">-- Select Input --</option>
              {inputs.map(input => (
                <option key={input.input_id} value={input.input_id}>
                  {input.input_name} ({input.input_url})
                </option>
              ))}
            </select>
          </label>

          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (10s)
          </label>
        </div>

        {loading && <div className="loading-indicator">Loading metrics...</div>}
      </div>

      {!selectedInput ? (
        <div className="no-data">
          <p>Please select an input to view metrics</p>
        </div>
      ) : (
        <>
          {/* Stream Status Overview */}
          {inputStatus && (
            <StreamStatusPanel status={inputStatus} />
          )}

          {/* Stream Snapshot */}
          {selectedInput && (
            <div className="snapshot-panel">
              <h3>Stream Snapshot - {selectedInputName}</h3>
              <div className="snapshot-container">
                <img
                  src={`${API_BASE}/inputs/${selectedInput}/snapshot`}
                  alt={`Snapshot of ${selectedInputName}`}
                  className="stream-snapshot"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect fill="%231e2530" width="640" height="360"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%238B95A5" font-family="monospace"%3ENo snapshot available%3C/text%3E%3C/svg%3E';
                  }}
                />
                {inputStatus?.last_snapshot && (
                  <div className="snapshot-timestamp">
                    Last captured: {new Date(inputStatus.last_snapshot).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TR 101 290 DVB Errors */}
          {tr101290Metrics && (
            <TR101290Panel
              metrics={tr101290Metrics}
              inputName={selectedInputName}
            />
          )}

          {/* MDI Network Transport Metrics */}
          {mdiMetrics && (
            <MDIPanel metrics={mdiMetrics} inputName={selectedInputName} />
          )}

          {/* QoE Quality Metrics */}
          {qoeMetrics && (
            <QoEPanel metrics={qoeMetrics} inputName={selectedInputName} />
          )}

          {/* Stream Bitrate Chart - Enhanced */}
          {streamMetrics.length > 0 && (
            <div className="metric-chart bitrate-chart-enhanced">
              <div className="chart-header">
                <h3>Stream Bitrate - {selectedInputName}</h3>
                {zoomDomain && (
                  <button className="reset-zoom-btn" onClick={() => setZoomDomain(null)}>
                    Reset Zoom
                  </button>
                )}
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={streamMetrics}
                  onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                  onMouseMove={(e) => e && refAreaLeft && setRefAreaRight(e.activeLabel)}
                  onMouseUp={handleZoom}
                >
                  <defs>
                    {/* Gradient Fill for Area */}
                    <linearGradient id="bitrateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00FFFF" stopOpacity={0.4} />
                      <stop offset="50%" stopColor="#00FFFF" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#000000" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  {/* Grid with Cool Grey */}
                  <CartesianGrid strokeDasharray="3 3" stroke="#3E4A5C" />

                  {/* X-Axis - Time with optimized labels */}
                  <XAxis
                    dataKey="time"
                    stroke="#8B95A5"
                    tick={{ fill: '#B0BAC9', fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                    domain={zoomDomain ? [zoomDomain.x1, zoomDomain.x2] : ['auto', 'auto']}
                    allowDataOverflow
                  />

                  {/* Y-Axis - Bitrate with unit */}
                  <YAxis
                    stroke="#8B95A5"
                    tick={{ fill: '#B0BAC9', fontSize: 12 }}
                    label={{
                      value: 'Bitrate (Mbps)',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: '#B0BAC9', fontSize: 13, fontWeight: 500 }
                    }}
                    domain={zoomDomain ? [zoomDomain.y1, zoomDomain.y2] : ['auto', 'auto']}
                    allowDataOverflow
                  />

                  {/* Custom Enhanced Tooltip */}
                  <Tooltip content={<CustomBitrateTooltip />} />

                  {/* Reference Line for Target Bitrate (1.0 Mbps) */}
                  <ReferenceLine
                    y={1.0}
                    stroke="#6B7785"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{
                      value: 'Target: 1.0 Mbps',
                      position: 'insideTopRight',
                      fill: '#8B95A5',
                      fontSize: 11
                    }}
                  />

                  {/* Area Fill with Gradient */}
                  <Area
                    type="monotone"
                    dataKey="bitrate"
                    stroke="none"
                    fill="url(#bitrateGradient)"
                    fillOpacity={1}
                  />

                  {/* Main Data Line - Vivid Cyan */}
                  <Line
                    type="monotone"
                    dataKey="bitrate"
                    stroke="#00FFFF"
                    strokeWidth={2.5}
                    dot={false}
                    name="Bitrate"
                    animationDuration={300}
                  />

                  {/* Zoom Selection Area */}
                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea
                      x1={refAreaLeft}
                      x2={refAreaRight}
                      strokeOpacity={0.3}
                      fill="#00FFFF"
                      fillOpacity={0.2}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Codec Information */}
          {codecInfo && (
            <CodecPanel codecInfo={codecInfo} />
          )}

          {/* Video MOS */}
          {qoeMetrics && tr101290Metrics && (
            <VideoMOSPanel
              qoeMetrics={qoeMetrics}
              tr101290Metrics={tr101290Metrics}
              mdiMetrics={mdiMetrics}
            />
          )}

          {/* Audio LUFS */}
          {qoeMetrics && (
            <AudioLUFSPanel qoeMetrics={qoeMetrics} />
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// STREAM STATUS PANEL
// ============================================================================

const StreamStatusPanel = ({ status }) => {
  const getStatusColor = () => {
    if (!status.enabled) return 'inactive';
    if (status.tr101290_p1_errors > 10) return 'error';
    if (status.tr101290_p1_errors > 0) return 'warning';
    return 'success';
  };

  const statusColor = getStatusColor();

  return (
    <div className={`stream-status-panel status-${statusColor}`}>
      <h3>Stream Status: {status.input_name}</h3>

      <div className="status-grid">
        <div className="status-item">
          <div className="status-label">Input URL</div>
          <div className="status-value url-value">{status.input_url}</div>
        </div>

        <div className="status-item">
          <div className="status-label">Type</div>
          <div className="status-value">
            <span className="badge">{status.input_type}</span>
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Current Bitrate</div>
          <div className="status-value">
            {status.bitrate_mbps ? `${status.bitrate_mbps.toFixed(3)} Mbps` : 'N/A'}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">TR 101 290 P1 Errors</div>
          <div className={`status-value error-count ${status.tr101290_p1_errors > 0 ? 'has-errors' : ''}`}>
            {status.tr101290_p1_errors || 0}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Last Snapshot</div>
          <div className="status-value">
            {status.last_snapshot ? new Date(status.last_snapshot).toLocaleString() : 'Never'}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Last Update</div>
          <div className="status-value">
            {status.last_update ? new Date(status.last_update).toLocaleString() : 'N/A'}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Stream Health</div>
          <div className="status-value">
            <span className={`health-indicator health-${statusColor}`}>
              ● {statusColor === 'success' ? 'Healthy' : statusColor === 'warning' ? 'Minor Issues' : statusColor === 'error' ? 'Critical' : 'Disabled'}
            </span>
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Status</div>
          <div className="status-value">
            <span className={`badge ${status.enabled ? 'badge-success' : 'badge-danger'}`}>
              {status.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TR 101 290 PANEL
// ============================================================================

const TR101290Panel = ({ metrics, inputName }) => {
  const { priority_1, priority_2, priority_3, metadata } = metrics;

  const getTotalErrors = () => {
    return (priority_1?.total_p1_errors || 0) +
           (priority_2?.total_p2_errors || 0) +
           (priority_3?.total_p3_errors || 0);
  };

  const getSeverityLevel = () => {
    const p1 = priority_1?.total_p1_errors || 0;
    const p2 = priority_2?.total_p2_errors || 0;

    if (p1 > 10) return 'critical';
    if (p1 > 0) return 'warning';
    if (p2 > 0) return 'info';
    return 'success';
  };

  const severity = getSeverityLevel();

  return (
    <div className={`tr101290-panel severity-${severity}`}>
      <div className="tr101290-header">
        <h3>TR 101 290 DVB Stream Analysis - {inputName}</h3>
        <div className="total-errors">
          <span className="error-count">{getTotalErrors()}</span>
          <span className="error-label">Total Errors</span>
        </div>
      </div>

      <div className="tr101290-grid">
        {/* Priority 1 - Critical */}
        <div className="tr101290-section p1">
          <div className="section-header">
            <h4>Priority 1 - Critical Errors</h4>
            <span className={`error-badge ${priority_1.total_p1_errors > 0 ? 'has-errors' : ''}`}>
              {priority_1.total_p1_errors}
            </span>
          </div>
          <div className="error-list">
            <ErrorItem label="TS Sync Loss" value={priority_1.ts_sync_loss} />
            <ErrorItem label="Sync Byte Error" value={priority_1.sync_byte_error} />
            <ErrorItem label="PAT Error" value={priority_1.pat_error} />
            <ErrorItem label="Continuity Count Error" value={priority_1.continuity_count_error} critical />
            <ErrorItem label="PMT Error" value={priority_1.pmt_error} />
            <ErrorItem label="PID Error" value={priority_1.pid_error} />
          </div>
        </div>

        {/* Priority 2 - Quality */}
        <div className="tr101290-section p2">
          <div className="section-header">
            <h4>Priority 2 - Quality Errors</h4>
            <span className={`error-badge ${priority_2.total_p2_errors > 0 ? 'has-errors' : ''}`}>
              {priority_2.total_p2_errors}
            </span>
          </div>
          <div className="error-list">
            <ErrorItem label="Transport Error" value={priority_2.transport_error} />
            <ErrorItem label="CRC Error" value={priority_2.crc_error} />
            <ErrorItem label="PCR Error" value={priority_2.pcr_error} />
            <ErrorItem label="PCR Accuracy Error" value={priority_2.pcr_accuracy_error} />
            <ErrorItem label="PTS Error" value={priority_2.pts_error} />
            <ErrorItem label="CAT Error" value={priority_2.cat_error} />
          </div>
        </div>

        {/* Priority 3 - Informational */}
        <div className="tr101290-section p3">
          <div className="section-header">
            <h4>Priority 3 - Informational</h4>
            <span className={`error-badge ${priority_3.total_p3_errors > 0 ? 'has-errors' : ''}`}>
              {priority_3.total_p3_errors}
            </span>
          </div>
          <div className="error-list">
            <ErrorItem label="NIT Error" value={priority_3.nit_error} />
            <ErrorItem label="SI Repetition Error" value={priority_3.si_repetition_error} />
            <ErrorItem label="Unreferenced PID" value={priority_3.unreferenced_pid} />
          </div>
        </div>

        {/* Metadata */}
        <div className="tr101290-section metadata">
          <div className="section-header">
            <h4>Stream Metadata</h4>
          </div>
          <div className="metadata-list">
            <MetadataItem label="Total Packets" value={metadata.total_packets} />
            <MetadataItem
              label="PAT Received"
              value={metadata.pat_received ? 'Yes' : 'No'}
              success={metadata.pat_received}
            />
            <MetadataItem
              label="PMT Received"
              value={metadata.pmt_received ? 'Yes' : 'No'}
              success={metadata.pmt_received}
            />
            <MetadataItem
              label="PCR Interval"
              value={metadata.pcr_interval_ms != null ? `${metadata.pcr_interval_ms.toFixed(2)} ms` : 'N/A'}
              success={metadata.pcr_interval_ms != null && metadata.pcr_interval_ms >= 10 && metadata.pcr_interval_ms <= 40}
            />
          </div>
        </div>
      </div>

      {/* Continuity Tracking */}
      {priority_1.continuity_count_error > 0 && (
        <div className="continuity-alert">
          <strong>⚠ Continuity Issues Detected:</strong> {priority_1.continuity_count_error} continuity count errors indicate packet loss or reordering.
          This may cause video/audio artifacts or decoder issues.
        </div>
      )}
    </div>
  );
};

const ErrorItem = ({ label, value, critical }) => (
  <div className={`error-item ${value > 0 ? 'has-error' : ''} ${critical && value > 0 ? 'critical' : ''}`}>
    <span className="error-label">{label}</span>
    <span className="error-value">{value}</span>
  </div>
);

const MetadataItem = ({ label, value, success }) => (
  <div className={`metadata-item ${success !== undefined ? (success ? 'success' : 'warning') : ''}`}>
    <span className="metadata-label">{label}</span>
    <span className="metadata-value">{value}</span>
  </div>
);

// Calculate estimated MOS based on errors
const calculateEstimatedMOS = (tr101290Metrics) => {
  const p1Errors = tr101290Metrics.priority_1.total_p1_errors || 0;
  const p2Errors = tr101290Metrics.priority_2.total_p2_errors || 0;

  // Start with perfect score
  let mos = 5.0;

  // Deduct for P1 errors (critical)
  mos -= Math.min(p1Errors * 0.1, 2.0);

  // Deduct for P2 errors (less severe)
  mos -= Math.min(p2Errors * 0.02, 0.5);

  // Ensure MOS is between 1.0 and 5.0
  mos = Math.max(1.0, Math.min(5.0, mos));

  return mos.toFixed(2);
};

// ============================================================================
// MDI PANEL - RFC 4445 Network Transport Metrics
// ============================================================================

const MDIPanel = ({ metrics, inputName }) => {
  if (!metrics || !metrics.df) return null;

  const getJitterSeverity = () => {
    const jitter = metrics.jitter_ms || 0;
    if (jitter < 5) return 'success';
    if (jitter < 15) return 'warning';
    return 'error';
  };

  const getBufferHealth = () => {
    const util = metrics.buffer_utilization || 0;
    if (util < 60) return 'success';
    if (util < 85) return 'warning';
    return 'error';
  };

  return (
    <div className={`mdi-panel severity-${getJitterSeverity()}`}>
      <div className="mdi-header">
        <h3>🌐 MDI Network Transport Metrics (RFC 4445) - {inputName}</h3>
        <div className="mdi-summary">
          <span className={`mdi-indicator ${getJitterSeverity()}`}>
            Jitter: {metrics.jitter_ms?.toFixed(2) || 0} ms
          </span>
        </div>
      </div>

      <div className="mdi-grid">
        {/* Core MDI Metrics */}
        <div className="mdi-section">
          <div className="section-header">
            <h4>Core MDI Metrics</h4>
          </div>
          <div className="mdi-metrics">
            <MDIMetric
              label="DF (Delay Factor)"
              value={`${metrics.df?.toFixed(2) || 0} ms`}
              description="IP packet jitter/delay"
              severity={getJitterSeverity()}
            />
            <MDIMetric
              label="MLR (Media Loss Rate)"
              value={`${metrics.mlr?.toFixed(2) || 0} pps`}
              description="Packet loss rate"
              severity={metrics.mlr > 0 ? 'error' : 'success'}
            />
            <MDIMetric
              label="Jitter"
              value={`${metrics.jitter_ms?.toFixed(2) || 0} ms`}
              description="Packet delay variation"
              severity={getJitterSeverity()}
            />
            <MDIMetric
              label="Max Jitter"
              value={`${metrics.max_jitter_ms?.toFixed(2) || 0} ms`}
              description="Peak jitter observed"
              severity={getJitterSeverity()}
            />
          </div>
        </div>

        {/* Buffer Management */}
        <div className="mdi-section">
          <div className="section-header">
            <h4>Buffer Management</h4>
          </div>
          <div className="mdi-metrics">
            <MDIMetric
              label="Buffer Utilization"
              value={`${metrics.buffer_utilization?.toFixed(1) || 0}%`}
              description="Current buffer fill"
              severity={getBufferHealth()}
            />
            <MDIMetric
              label="Buffer Depth"
              value={`${((metrics.buffer_depth ?? 0) / 1024).toFixed(1)} KB`}
              description="Current buffer size"
            />
            <MDIMetric
              label="Buffer Max"
              value={`${((metrics.buffer_max ?? 0) / 1024).toFixed(1)} KB`}
              description="Maximum buffer capacity"
            />
          </div>
        </div>

        {/* Network Statistics */}
        <div className="mdi-section">
          <div className="section-header">
            <h4>Network Statistics</h4>
          </div>
          <div className="mdi-metrics">
            <MDIMetric
              label="Packets Lost"
              value={metrics.packets_lost || 0}
              description="Total packets lost"
              severity={metrics.packets_lost > 0 ? 'warning' : 'success'}
            />
            <MDIMetric
              label="Out of Order"
              value={metrics.packets_out_of_order || 0}
              description="Packets received out of sequence"
              severity={metrics.packets_out_of_order > 0 ? 'warning' : 'success'}
            />
            <MDIMetric
              label="Input Rate"
              value={`${metrics.input_rate_mbps?.toFixed(3) || 0} Mbps`}
              description="Actual input bitrate"
            />
          </div>
        </div>

        {/* Analysis */}
        <div className="mdi-section analysis">
          <div className="section-header">
            <h4>Network Analysis</h4>
          </div>
          <div className="mdi-analysis">
            {metrics.df > 30 && (
              <div className="analysis-alert warning">
                ⚠ High delay factor ({metrics.df?.toFixed(2)}ms) indicates network congestion or jitter issues
              </div>
            )}
            {metrics.mlr > 0 && (
              <div className="analysis-alert error">
                🔴 Packet loss detected ({metrics.mlr?.toFixed(2)} pps) - This causes Continuity Count Errors
              </div>
            )}
            {metrics.buffer_utilization > 85 && (
              <div className="analysis-alert error">
                🔴 Buffer near capacity ({metrics.buffer_utilization?.toFixed(1)}%) - Risk of overflow
              </div>
            )}
            {metrics.jitter_ms < 5 && metrics.mlr === 0 && (
              <div className="analysis-alert success">
                ✓ Excellent network quality - Low jitter, no packet loss
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MDIMetric = ({ label, value, description, severity }) => (
  <div className={`mdi-metric ${severity ? `severity-${severity}` : ''}`}>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    {description && <div className="metric-desc">{description}</div>}
  </div>
);

// ============================================================================
// QoE PANEL - Quality of Experience Metrics
// ============================================================================

const QoEPanel = ({ metrics, inputName }) => {
  if (!metrics || metrics.overall_mos === null) return null;

  const getMOSColor = (mos) => {
    if (mos >= 4.5) return 'success';
    if (mos >= 3.5) return 'warning';
    return 'error';
  };

  const getMOSRating = (mos) => {
    if (mos >= 4.5) return 'Excellent';
    if (mos >= 4.0) return 'Good';
    if (mos >= 3.5) return 'Fair';
    if (mos >= 2.5) return 'Poor';
    return 'Bad';
  };

  return (
    <div className={`qoe-panel severity-${getMOSColor(metrics.overall_mos)}`}>
      <div className="qoe-header">
        <h3>✨ Quality of Experience (QoE) - {inputName}</h3>
        <div className="overall-mos">
          <div className={`mos-score ${getMOSColor(metrics.overall_mos)}`}>
            {metrics.overall_mos?.toFixed(2) || 'N/A'}
          </div>
          <div className="mos-rating">{getMOSRating(metrics.overall_mos)}</div>
        </div>
      </div>

      <div className="qoe-grid">
        {/* Video Quality */}
        <div className="qoe-section video">
          <div className="section-header">
            <h4>📺 Video Quality</h4>
            <span className={`status-badge ${metrics.video_pid_active ? 'active' : 'inactive'}`}>
              {metrics.video_pid_active ? '● Active' : '○ Inactive'}
            </span>
          </div>
          <div className="qoe-metrics">
            <QoEMetric
              label="Quality Score"
              value={`${metrics.video_quality_score?.toFixed(2) || 'N/A'} / 5.0`}
              severity={getMOSColor(metrics.video_quality_score || 0)}
            />
            <QoEMetric
              label="Video Bitrate"
              value={`${metrics.video_bitrate_mbps?.toFixed(3) || 0} Mbps`}
            />
            <QoEMetric
              label="Black Frames"
              value={metrics.black_frames_detected || 0}
              severity={metrics.black_frames_detected > 0 ? 'warning' : 'success'}
            />
            <QoEMetric
              label="Freeze Frames"
              value={metrics.freeze_frames_detected || 0}
              severity={metrics.freeze_frames_detected > 0 ? 'warning' : 'success'}
            />
          </div>
        </div>

        {/* Audio Quality */}
        <div className="qoe-section audio">
          <div className="section-header">
            <h4>🔊 Audio Quality</h4>
            <span className={`status-badge ${metrics.audio_pid_active ? 'active' : 'inactive'}`}>
              {metrics.audio_pid_active ? '● Active' : '○ Inactive'}
            </span>
          </div>
          <div className="qoe-metrics">
            <QoEMetric
              label="Quality Score"
              value={`${metrics.audio_quality_score?.toFixed(2) || 'N/A'} / 5.0`}
              severity={getMOSColor(metrics.audio_quality_score || 0)}
            />
            <QoEMetric
              label="Audio Bitrate"
              value={`${metrics.audio_bitrate_kbps?.toFixed(0) || 0} kbps`}
            />
            <QoEMetric
              label="Silence Detected"
              value={metrics.audio_silence_detected || 0}
              severity={metrics.audio_silence_detected > 0 ? 'error' : 'success'}
            />
            <QoEMetric
              label="Loudness (LUFS)"
              value={metrics.audio_loudness_lufs !== 0 ? `${metrics.audio_loudness_lufs?.toFixed(1)} LUFS` : 'N/A'}
              description="EBU R128 target: -23 LUFS"
            />
          </div>
        </div>
      </div>

      {/* Quality Alerts */}
      {(metrics.black_frames_detected > 0 || metrics.freeze_frames_detected > 0 || metrics.audio_silence_detected > 0) && (
        <div className="qoe-alerts">
          <h4>Quality Issues Detected:</h4>
          {metrics.black_frames_detected > 0 && (
            <div className="qoe-alert warning">
              ⚠ Black frames detected - possible signal loss or content issues
            </div>
          )}
          {metrics.freeze_frames_detected > 0 && (
            <div className="qoe-alert warning">
              ⚠ Freeze frames detected - decoder or bitrate issues
            </div>
          )}
          {metrics.audio_silence_detected > 0 && (
            <div className="qoe-alert error">
              🔴 Audio silence detected - audio stream may be missing or muted
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const QoEMetric = ({ label, value, description, severity }) => (
  <div className={`qoe-metric ${severity ? `severity-${severity}` : ''}`}>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    {description && <div className="metric-desc">{description}</div>}
  </div>
);

// ============================================================================
// INPUTS TAB
// ============================================================================

const InputsTab = ({ inputs, loading, onRefresh, toast }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInput, setSelectedInput] = useState(null);

  const handleEdit = (input) => {
    setSelectedInput(input);
    setShowEditModal(true);
  };

  const handleInfo = (input) => {
    setSelectedInput(input);
    setShowInfoModal(true);
  };

  const handleDelete = async (inputId) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete this input?')) return;

    try {
      const response = await fetch(`${API_BASE}/inputs/${inputId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        toast.success('Input deleted successfully');
        onRefresh();
      } else {
        toast.error('Failed to delete input');
      }
    } catch (error) {
      console.error('Error deleting input:', error);
      toast.error('Error deleting input: ' + error.message);
    }
  };

  return (
    <div className="inputs-tab">
      <div className="inputs-header">
        <h2>Probe Inputs</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add New Input
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading inputs...</div>
      ) : (
        <div className="inputs-table-container">
          {inputs.length === 0 ? (
            <p className="no-data">No inputs found</p>
          ) : (
            <table className="inputs-table">
              <thead>
                <tr>
                  <th>Thumbnail</th>
                  <th>ID</th>
                  <th>Input Name</th>
                  <th>Channel Name</th>
                  <th>Type</th>
                  <th>URL</th>
                  <th>Port</th>
                  <th>Probe ID</th>
                  <th>Primary</th>
                  <th>Status</th>
                  <th>Last Snapshot</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map(input => (
                  <tr key={input.input_id}>
                    <td className="thumbnail-cell">
                      {input.snapshot_url ? (
                        <img
                          src={`${API_BASE}/inputs/${input.input_id}/snapshot`}
                          alt="Snapshot"
                          className="input-thumbnail"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="no-thumbnail">No snapshot</div>
                      )}
                    </td>
                    <td>{input.input_id}</td>
                    <td><strong>{input.input_name}</strong></td>
                    <td>{input.channel_name || 'N/A'}</td>
                    <td><span className="badge type-badge">{input.input_type}</span></td>
                    <td className="url-cell">{input.input_url}</td>
                    <td>{input.input_port || 'N/A'}</td>
                    <td>{input.probe_id}</td>
                    <td>{input.is_primary ? 'Yes' : 'No'}</td>
                    <td>
                      <span className={`badge ${input.enabled ? 'badge-success' : 'badge-danger'}`}>
                        {input.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="timestamp-cell">
                      {input.last_snapshot_at ? new Date(input.last_snapshot_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="actions">
                      <button className="btn btn-xs btn-info" onClick={() => handleInfo(input)}>
                        Info
                      </button>
                      <button className="btn btn-xs btn-primary" onClick={() => handleEdit(input)}>
                        Edit
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => handleDelete(input.input_id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAddModal && (
        <InputFormModal
          toast={toast}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onRefresh();
          }}
        />
      )}

      {showEditModal && selectedInput && (
        <InputFormModal
          input={selectedInput}
          toast={toast}
          onClose={() => {
            setShowEditModal(false);
            setSelectedInput(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedInput(null);
            onRefresh();
          }}
        />
      )}

      {showInfoModal && selectedInput && (
        <InputInfoModal
          input={selectedInput}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedInput(null);
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// INPUT FORM MODAL (Add/Edit)
// ============================================================================

const InputFormModal = ({ input, toast, onClose, onSuccess }) => {
  const isEdit = !!input;
  const [formData, setFormData] = useState(input || {
    input_name: '',
    input_url: '',
    input_type: 'MPEGTS_UDP',
    input_protocol: 'udp',
    input_port: '',
    channel_id: '',
    probe_id: 1,
    is_primary: true,
    enabled: true,
    bitrate_mbps: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const url = isEdit ? `${API_BASE}/inputs/${input.input_id}` : `${API_BASE}/inputs`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(isEdit ? 'Input updated successfully' : 'Input added successfully');
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error saving input:', error);
      toast.error('Error saving input: ' + error.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Input' : 'Add New Input'}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Input Name *</label>
            <input
              type="text"
              value={formData.input_name}
              onChange={(e) => setFormData({ ...formData, input_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Input URL *</label>
            <input
              type="text"
              value={formData.input_url}
              onChange={(e) => setFormData({ ...formData, input_url: e.target.value })}
              placeholder="udp://225.3.3.42:30130"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Input Type *</label>
              <select
                value={formData.input_type}
                onChange={(e) => setFormData({ ...formData, input_type: e.target.value })}
                required
              >
                <option value="MPEGTS_UDP">MPEGTS_UDP</option>
                <option value="HTTP">HTTP</option>
                <option value="HLS">HLS</option>
                <option value="RTMP">RTMP</option>
                <option value="SRT">SRT</option>
              </select>
            </div>

            <div className="form-group">
              <label>Protocol</label>
              <select
                value={formData.input_protocol || ''}
                onChange={(e) => setFormData({ ...formData, input_protocol: e.target.value })}
              >
                <option value="">Auto</option>
                <option value="udp">UDP</option>
                <option value="http">HTTP</option>
                <option value="rtmp">RTMP</option>
                <option value="srt">SRT</option>
              </select>
            </div>

            <div className="form-group">
              <label>Port</label>
              <input
                type="number"
                value={formData.input_port || ''}
                onChange={(e) => setFormData({ ...formData, input_port: parseInt(e.target.value) || '' })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Channel ID</label>
              <input
                type="number"
                value={formData.channel_id || ''}
                onChange={(e) => setFormData({ ...formData, channel_id: parseInt(e.target.value) || '' })}
              />
            </div>

            <div className="form-group">
              <label>Probe ID *</label>
              <input
                type="number"
                value={formData.probe_id}
                onChange={(e) => setFormData({ ...formData, probe_id: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="form-group">
              <label>Bitrate (Mbps)</label>
              <input
                type="number"
                step="0.1"
                value={formData.bitrate_mbps || ''}
                onChange={(e) => setFormData({ ...formData, bitrate_mbps: parseFloat(e.target.value) || '' })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                />
                Primary Input
              </label>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// INPUT INFO MODAL
// ============================================================================

const InputInfoModal = ({ input, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-info" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Input Information: {input.input_name}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="info-grid">
            <div className="info-item">
              <strong>Input ID:</strong>
              <span>{input.input_id}</span>
            </div>
            <div className="info-item">
              <strong>Input Name:</strong>
              <span>{input.input_name}</span>
            </div>
            <div className="info-item">
              <strong>Channel Name:</strong>
              <span>{input.channel_name || 'N/A'}</span>
            </div>
            <div className="info-item">
              <strong>Channel ID:</strong>
              <span>{input.channel_id || 'N/A'}</span>
            </div>
            <div className="info-item">
              <strong>Input Type:</strong>
              <span className="badge">{input.input_type}</span>
            </div>
            <div className="info-item">
              <strong>Protocol:</strong>
              <span>{input.input_protocol || 'Auto'}</span>
            </div>
            <div className="info-item">
              <strong>Input URL:</strong>
              <span className="url-text">{input.input_url}</span>
            </div>
            <div className="info-item">
              <strong>Port:</strong>
              <span>{input.input_port || 'N/A'}</span>
            </div>
            <div className="info-item">
              <strong>Probe ID:</strong>
              <span>{input.probe_id}</span>
            </div>
            <div className="info-item">
              <strong>Primary:</strong>
              <span>{input.is_primary ? 'Yes' : 'No'}</span>
            </div>
            <div className="info-item">
              <strong>Status:</strong>
              <span className={`badge ${input.enabled ? 'badge-success' : 'badge-danger'}`}>
                {input.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="info-item">
              <strong>Bitrate:</strong>
              <span>{input.bitrate_mbps ? `${input.bitrate_mbps} Mbps` : 'N/A'}</span>
            </div>
            <div className="info-item">
              <strong>Created:</strong>
              <span>{new Date(input.created_at).toLocaleString()}</span>
            </div>
            <div className="info-item">
              <strong>Updated:</strong>
              <span>{new Date(input.updated_at).toLocaleString()}</span>
            </div>
            {input.last_snapshot_at && (
              <div className="info-item">
                <strong>Last Snapshot:</strong>
                <span>{new Date(input.last_snapshot_at).toLocaleString()}</span>
              </div>
            )}
            {input.input_metadata && (
              <div className="info-item full-width">
                <strong>Metadata:</strong>
                <pre>{JSON.stringify(input.input_metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DEBUG TAB
// ============================================================================

const DebugTab = ({ debugInfo, onRefresh }) => {
  if (!debugInfo) {
    return (
      <div className="debug-tab">
        <div className="debug-header">
          <h2>Debug Information</h2>
          <button className="btn btn-primary" onClick={onRefresh}>
            Refresh Debug Info
          </button>
        </div>
        <p className="loading">Loading debug information...</p>
      </div>
    );
  }

  return (
    <div className="debug-tab">
      <div className="debug-header">
        <h2>Debug Information</h2>
        <button className="btn btn-primary" onClick={onRefresh}>
          Refresh Debug Info
        </button>
      </div>

      {/* System Info */}
      <div className="debug-section">
        <h3>System Status</h3>
        <div className="debug-info-grid">
          <div className="debug-item">
            <strong>Status:</strong>
            <span className={`badge ${debugInfo.system.status === 'ok' ? 'badge-success' : 'badge-danger'}`}>
              {debugInfo.system.status}
            </span>
          </div>
          <div className="debug-item">
            <strong>Database:</strong>
            <span>{debugInfo.system.database || 'Unknown'}</span>
          </div>
          <div className="debug-item">
            <strong>Timestamp:</strong>
            <span>{new Date(debugInfo.system.timestamp).toLocaleString()}</span>
          </div>
        </div>

        {debugInfo.system.counts && (
          <div className="debug-counts">
            <h4>Record Counts</h4>
            <div className="count-grid">
              <div className="count-item">
                <strong>Channels:</strong> {debugInfo.system.counts.channels}
              </div>
              <div className="count-item">
                <strong>Inputs:</strong> {debugInfo.system.counts.inputs}
              </div>
              <div className="count-item">
                <strong>Probes:</strong> {debugInfo.system.counts.probes}
              </div>
              <div className="count-item">
                <strong>Active Alerts:</strong> {debugInfo.system.counts.active_alerts}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inputs Debug Info */}
      <div className="debug-section">
        <h3>Inputs Debug ({debugInfo.inputs.count})</h3>
        {debugInfo.inputs.count === 0 ? (
          <p className="no-data">No inputs found in database</p>
        ) : (
          <div className="debug-inputs-list">
            {debugInfo.inputs.inputs.map(input => (
              <div key={input.input_id} className="debug-input-card">
                <div className="debug-input-header">
                  <h4>
                    Input #{input.input_id}: {input.input_name}
                    {input.snapshot_url && (
                      <img
                        src={`${API_BASE}/inputs/${input.input_id}/snapshot`}
                        alt="Snapshot"
                        className="debug-thumbnail"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </h4>
                  <span className={`badge ${input.enabled ? 'badge-success' : 'badge-danger'}`}>
                    {input.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="debug-input-details">
                  <div><strong>Channel:</strong> {input.channel_name || 'N/A'} (ID: {input.channel_id || 'N/A'})</div>
                  <div><strong>Type:</strong> {input.input_type}</div>
                  <div><strong>Protocol:</strong> {input.input_protocol || 'Auto'}</div>
                  <div><strong>URL:</strong> <code>{input.input_url}</code></div>
                  <div><strong>Port:</strong> {input.input_port || 'N/A'}</div>
                  <div><strong>Probe ID:</strong> {input.probe_id}</div>
                  <div><strong>Primary:</strong> {input.is_primary ? 'Yes' : 'No'}</div>
                  <div><strong>Bitrate:</strong> {input.bitrate_mbps ? `${input.bitrate_mbps} Mbps` : 'N/A'}</div>
                  <div>
                    <strong>Snapshot:</strong>
                    {input.snapshot_url ? (
                      <span className={input.snapshot_exists ? 'text-success' : 'text-danger'}>
                        {input.snapshot_exists ? ' File exists' : ' File missing'}
                        {' '}<code>{input.snapshot_url}</code>
                      </span>
                    ) : (
                      <span className="text-muted"> None</span>
                    )}
                  </div>
                  <div>
                    <strong>Last Snapshot:</strong>
                    {input.last_snapshot_at ? new Date(input.last_snapshot_at).toLocaleString() : ' Never'}
                  </div>
                  <div><strong>Created:</strong> {new Date(input.created_at).toLocaleString()}</div>
                  <div><strong>Updated:</strong> {new Date(input.updated_at).toLocaleString()}</div>
                  {input.input_metadata && (
                    <div className="metadata-section">
                      <strong>Metadata:</strong>
                      <pre>{JSON.stringify(input.input_metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs Section */}
      <div className="debug-section">
        <h3>Recent Logs</h3>
        <div className="log-viewer">
          <p className="info-text">
            Monitor service logs are written to /var/log/packager-monitor.log
            <br />
            Check the server logs for detailed probe and analysis information.
          </p>
          <div className="log-commands">
            <h4>Useful Commands:</h4>
            <code>tail -f /var/log/packager-monitor.log</code>
            <br />
            <code>grep "UDP probe" /var/log/packager-monitor.log | tail -20</code>
            <br />
            <code>grep "ERROR" /var/log/packager-monitor.log | tail -20</code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
