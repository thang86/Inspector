// FPT Play - React Dashboard Component
// Real-time channel monitoring, alert management, configuration UI

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const API_BASE = 'http://api.monitor.local/api/v1';

// ============================================================================
// COMPONENTS
// ============================================================================

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [channels, setChannels] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [probeInputs, setProbeInputs] = useState([]);
  const [probes, setProbes] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ tier: null, is_4k: null });

  useEffect(() => {
    fetchChannels();
    fetchActiveAlerts();
    fetchProbes();
    fetchProbeInputs();
    const interval = setInterval(() => {
      fetchChannels();
      fetchActiveAlerts();
      fetchProbeInputs();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [filter]);

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

  const fetchProbes = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/probes`);
      const data = await response.json();
      setProbes(data.probes || []);
    } catch (error) {
      console.error('Error fetching probes:', error);
    }
  }, []);

  const fetchProbeInputs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/probe-inputs`);
      const data = await response.json();
      setProbeInputs(data.probe_inputs || []);
    } catch (error) {
      console.error('Error fetching probe inputs:', error);
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
          className={`tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          Alerts ({alerts.length})
        </button>
        <button
          className={`tab ${activeTab === 'inputs' ? 'active' : ''}`}
          onClick={() => setActiveTab('inputs')}
        >
          Probe Inputs
        </button>
        <button
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
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
        
        {activeTab === 'alerts' && (
          <AlertsTab
            alerts={alerts}
            onAcknowledge={acknowledgeAlert}
            onResolve={resolveAlert}
          />
        )}

        {activeTab === 'inputs' && (
          <ProbeInputsTab
            probeInputs={probeInputs}
            channels={channels}
            probes={probes}
            onRefresh={fetchProbeInputs}
          />
        )}

        {activeTab === 'metrics' && <MetricsTab />}
      </div>
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
  const monitoring_hd = channels.filter(c => !c.is_4k && c.tier <= 2).length;

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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="tier" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#8884d8" />
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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="severity" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#82ca9d" />
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
// METRICS TAB
// ============================================================================

const MetricsTab = () => {
  const [metricsData, setMetricsData] = useState([]);

  useEffect(() => {
    // Simulate metrics data
    const data = [];
    for (let i = 0; i < 60; i++) {
      data.push({
        time: `${i}s`,
        mos: 4.0 + Math.sin(i / 10) * 0.5,
        loudness: -23 + Math.random() * 0.5,
        bitrate: 5000 + Math.random() * 500
      });
    }
    setMetricsData(data);
  }, []);

  return (
    <div className="metrics-tab">
      <div className="metric-chart">
        <h3>Video MOS (Last 60s)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metricsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={[2, 5]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="mos" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="metric-chart">
        <h3>Audio Loudness (LUFS)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metricsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={[-24, -22]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="loudness" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="metric-chart">
        <h3>Bitrate (kbps)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metricsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="bitrate" stroke="#ffc658" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ============================================================================
// PROBE INPUTS TAB
// ============================================================================

const ProbeInputsTab = ({ probeInputs, channels, probes, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingInput, setEditingInput] = useState(null);
  const [filterProbeId, setFilterProbeId] = useState(null);
  const [filterChannelId, setFilterChannelId] = useState(null);

  const handleCreate = () => {
    setEditingInput(null);
    setShowForm(true);
  };

  const handleEdit = (input) => {
    setEditingInput(input);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingInput(null);
  };

  const handleFormSubmit = async () => {
    setShowForm(false);
    setEditingInput(null);
    await onRefresh();
  };

  const handleDelete = async (inputId) => {
    if (!window.confirm('Are you sure you want to delete this input?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/probe-inputs/${inputId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await onRefresh();
      } else {
        alert('Failed to delete input');
      }
    } catch (error) {
      console.error('Error deleting input:', error);
      alert('Error deleting input');
    }
  };

  const filteredInputs = probeInputs.filter(input => {
    if (filterProbeId && input.probe_id !== parseInt(filterProbeId)) return false;
    if (filterChannelId && input.channel_id !== parseInt(filterChannelId)) return false;
    return true;
  });

  return (
    <div className="probe-inputs-tab">
      <div className="tab-header">
        <h2>MPEG-TS Probe Inputs</h2>
        <button className="btn btn-primary" onClick={handleCreate}>
          + Add New Input
        </button>
      </div>

      <div className="filter-bar">
        <label>
          Probe:
          <select value={filterProbeId || ''} onChange={(e) => setFilterProbeId(e.target.value || null)}>
            <option value="">All Probes</option>
            {probes.map(probe => (
              <option key={probe.probe_id} value={probe.probe_id}>
                {probe.probe_name} (ID: {probe.probe_id})
              </option>
            ))}
          </select>
        </label>

        <label>
          Channel:
          <select value={filterChannelId || ''} onChange={(e) => setFilterChannelId(e.target.value || null)}>
            <option value="">All Channels</option>
            {channels.map(channel => (
              <option key={channel.channel_id} value={channel.channel_id}>
                {channel.channel_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showForm && (
        <ProbeInputForm
          input={editingInput}
          channels={channels}
          probes={probes}
          onSubmit={handleFormSubmit}
          onCancel={handleFormClose}
        />
      )}

      <ProbeInputList
        inputs={filteredInputs}
        channels={channels}
        probes={probes}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

const ProbeInputForm = ({ input, channels, probes, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    probe_id: input?.probe_id || '',
    channel_id: input?.channel_id || '',
    input_name: input?.input_name || '',
    input_type: input?.input_type || 'MPEGTS_UDP',
    input_url: input?.input_url || '',
    input_port: input?.input_port || '',
    bitrate_mbps: input?.bitrate_mbps || '',
    is_primary: input?.is_primary !== undefined ? input.is_primary : true,
    enabled: input?.enabled !== undefined ? input.enabled : true
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = input
        ? `${API_BASE}/probe-inputs/${input.input_id}`
        : `${API_BASE}/probe-inputs`;

      const method = input ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        probe_id: parseInt(formData.probe_id),
        channel_id: parseInt(formData.channel_id),
        input_port: formData.input_port ? parseInt(formData.input_port) : null,
        bitrate_mbps: formData.bitrate_mbps ? parseFloat(formData.bitrate_mbps) : null
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        onSubmit();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to save input'}`);
      }
    } catch (error) {
      console.error('Error saving input:', error);
      alert('Error saving input');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="input-form-overlay">
      <div className="input-form">
        <h3>{input ? 'Edit Probe Input' : 'Create New Probe Input'}</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Probe *</label>
              <select name="probe_id" value={formData.probe_id} onChange={handleChange} required>
                <option value="">Select Probe</option>
                {probes.map(probe => (
                  <option key={probe.probe_id} value={probe.probe_id}>
                    {probe.probe_name} - {probe.location}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Channel *</label>
              <select name="channel_id" value={formData.channel_id} onChange={handleChange} required>
                <option value="">Select Channel</option>
                {channels.map(channel => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.channel_name} ({channel.channel_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Input Name *</label>
              <input
                type="text"
                name="input_name"
                value={formData.input_name}
                onChange={handleChange}
                placeholder="e.g., Primary Input"
                required
              />
            </div>

            <div className="form-group">
              <label>Input Type *</label>
              <select name="input_type" value={formData.input_type} onChange={handleChange} required>
                <option value="MPEGTS_UDP">MPEG-TS UDP</option>
                <option value="MPEGTS_HTTP">MPEG-TS HTTP</option>
                <option value="MPEGTS_RTP">MPEG-TS RTP</option>
                <option value="SRT">SRT</option>
                <option value="RTMP">RTMP</option>
              </select>
            </div>

            <div className="form-group full-width">
              <label>Input URL *</label>
              <input
                type="text"
                name="input_url"
                value={formData.input_url}
                onChange={handleChange}
                placeholder="e.g., udp://239.1.1.1:5000 or http://encoder:8080/stream.ts"
                required
              />
            </div>

            <div className="form-group">
              <label>Port</label>
              <input
                type="number"
                name="input_port"
                value={formData.input_port}
                onChange={handleChange}
                placeholder="e.g., 5000"
              />
            </div>

            <div className="form-group">
              <label>Bitrate (Mbps)</label>
              <input
                type="number"
                step="0.1"
                name="bitrate_mbps"
                value={formData.bitrate_mbps}
                onChange={handleChange}
                placeholder="e.g., 10.0"
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="is_primary"
                  checked={formData.is_primary}
                  onChange={handleChange}
                />
                Primary Input
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleChange}
                />
                Enabled
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : (input ? 'Update Input' : 'Create Input')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProbeInputList = ({ inputs, channels, probes, onEdit, onDelete }) => {
  const getChannelName = (channelId) => {
    const channel = channels.find(c => c.channel_id === channelId);
    return channel ? channel.channel_name : `Channel ${channelId}`;
  };

  const getProbeName = (probeId) => {
    const probe = probes.find(p => p.probe_id === probeId);
    return probe ? probe.probe_name : `Probe ${probeId}`;
  };

  return (
    <div className="inputs-table">
      {inputs.length === 0 ? (
        <p className="no-data">No probe inputs configured. Click "Add New Input" to create one.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Probe</th>
              <th>Channel</th>
              <th>Type</th>
              <th>URL</th>
              <th>Bitrate</th>
              <th>Primary</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map(input => (
              <tr key={input.input_id} className={!input.enabled ? 'disabled' : ''}>
                <td>{input.input_id}</td>
                <td><strong>{input.input_name}</strong></td>
                <td>{getProbeName(input.probe_id)}</td>
                <td>{getChannelName(input.channel_id)}</td>
                <td><span className="badge type-badge">{input.input_type}</span></td>
                <td className="url-cell" title={input.input_url}>
                  {input.input_url.length > 40 ? input.input_url.substring(0, 40) + '...' : input.input_url}
                </td>
                <td>{input.bitrate_mbps ? `${input.bitrate_mbps} Mbps` : '-'}</td>
                <td>
                  {input.is_primary ? (
                    <span className="badge primary-badge">Primary</span>
                  ) : (
                    <span className="badge backup-badge">Backup</span>
                  )}
                </td>
                <td>
                  <span className={`status-indicator ${input.enabled ? 'active' : 'inactive'}`}>
                    {input.enabled ? '● Active' : '○ Disabled'}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn btn-xs" onClick={() => onEdit(input)}>Edit</button>
                  <button className="btn btn-xs btn-danger" onClick={() => onDelete(input.input_id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Dashboard;
