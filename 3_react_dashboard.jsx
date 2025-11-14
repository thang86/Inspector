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
  const [inputs, setInputs] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ tier: null, is_4k: null });

  useEffect(() => {
    fetchChannels();
    fetchActiveAlerts();
    fetchInputs();
    const interval = setInterval(() => {
      fetchChannels();
      fetchActiveAlerts();
      fetchInputs();
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

  const fetchInputs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/inputs`);
      const data = await response.json();
      setInputs(data.inputs || []);
    } catch (error) {
      console.error('Error fetching inputs:', error);
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
// INPUTS TAB
// ============================================================================

const InputsTab = ({ inputs, loading, onRefresh }) => {
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
    if (!confirm('Are you sure you want to delete this input?')) return;

    try {
      const response = await fetch(`${API_BASE}/inputs/${inputId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        onRefresh();
      } else {
        alert('Failed to delete input');
      }
    } catch (error) {
      console.error('Error deleting input:', error);
      alert('Error deleting input');
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
                  <th>ID</th>
                  <th>Input Name</th>
                  <th>Channel Name</th>
                  <th>Type</th>
                  <th>URL</th>
                  <th>Port</th>
                  <th>Probe ID</th>
                  <th>Primary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map(input => (
                  <tr key={input.input_id}>
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

const InputFormModal = ({ input, onClose, onSuccess }) => {
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
        onSuccess();
      } else {
        const data = await response.json();
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error saving input:', error);
      alert('Error saving input');
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

export default Dashboard;
