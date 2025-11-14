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
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ tier: null, is_4k: null });

  useEffect(() => {
    fetchChannels();
    fetchActiveAlerts();
    const interval = setInterval(() => {
      fetchChannels();
      fetchActiveAlerts();
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

export default Dashboard;
