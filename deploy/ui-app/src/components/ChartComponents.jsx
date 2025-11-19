// Professional Chart Components with Optimized Color Palette
import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { colors } from '../theme/colors';
import './ChartComponents.css';

// ============================================================================
// BITRATE CHART - Electric Cyan with Gradient Fill
// ============================================================================

export const BitrateChart = ({ data, height = 300 }) => {
  return (
    <div className="chart-container bitrate-chart">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            {/* Gradient fill for area under curve */}
            <linearGradient id="bitrateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.chart.bitrate} stopOpacity={0.3} />
              <stop offset="50%" stopColor={colors.chart.bitrate} stopOpacity={0.15} />
              <stop offset="100%" stopColor={colors.chart.bitrate} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Grid with blue-tinted gray */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.chart.gridLines}
            strokeOpacity={0.3}
          />

          {/* Axes with improved colors */}
          <XAxis
            dataKey="time"
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
            tickLine={{ stroke: colors.chart.gridLines }}
          />
          <YAxis
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
            tickLine={{ stroke: colors.chart.gridLines }}
            label={{
              value: 'Mbps',
              angle: -90,
              position: 'insideLeft',
              fill: colors.chart.axisText,
              fontSize: 13,
              fontWeight: 600,
            }}
          />

          {/* Custom tooltip */}
          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{
              paddingTop: '10px',
              fontSize: '13px',
              color: colors.ui.textPrimary,
            }}
          />

          {/* Area with gradient fill */}
          <Area
            type="monotone"
            dataKey="bitrate"
            stroke={colors.chart.bitrate}
            strokeWidth={3}
            fill="url(#bitrateGradient)"
            name="Bitrate (Mbps)"
            dot={false}
            activeDot={{
              r: 6,
              fill: colors.chart.bitrate,
              stroke: colors.ui.bgPrimary,
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// MOS QUALITY CHART - Color changes based on quality level
// ============================================================================

export const MOSChart = ({ data, height = 300 }) => {
  return (
    <div className="chart-container mos-chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <defs>
            {/* Gradient for MOS line */}
            <linearGradient id="mosGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.mos.excellent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.mos.excellent} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.chart.gridLines}
            strokeOpacity={0.3}
          />

          <XAxis
            dataKey="time"
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
            label={{
              value: 'MOS Score',
              angle: -90,
              position: 'insideLeft',
              fill: colors.chart.axisText,
              fontSize: 13,
              fontWeight: 600,
            }}
          />

          <Tooltip content={<MOSTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} />

          <Line
            type="monotone"
            dataKey="mos"
            stroke={colors.chart.mos}
            strokeWidth={3}
            name="MOS Score"
            dot={{ r: 4, fill: colors.chart.mos }}
            activeDot={{ r: 6, fill: colors.chart.mos }}
          />

          {/* Reference lines for quality thresholds */}
          <Line
            type="monotone"
            dataKey={() => 4.5}
            stroke={colors.mos.excellent}
            strokeWidth={1}
            strokeDasharray="5 5"
            name="Excellent (4.5+)"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={() => 3.5}
            stroke={colors.mos.fair}
            strokeWidth={1}
            strokeDasharray="5 5"
            name="Fair (3.5+)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// TR 101 290 ERRORS CHART - Multi-line with priority colors
// ============================================================================

export const TR101290Chart = ({ data, height = 300 }) => {
  return (
    <div className="chart-container tr101290-chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.chart.gridLines}
            strokeOpacity={0.3}
          />

          <XAxis
            dataKey="time"
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
          />
          <YAxis
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
            label={{
              value: 'Error Count',
              angle: -90,
              position: 'insideLeft',
              fill: colors.chart.axisText,
              fontSize: 13,
              fontWeight: 600,
            }}
          />

          <Tooltip content={<TR101290Tooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} />

          {/* Priority 1 - Critical (Red) */}
          <Line
            type="monotone"
            dataKey="p1_errors"
            stroke={colors.tr101290.p1}
            strokeWidth={3}
            name="Priority 1 (Critical)"
            dot={{ r: 4, fill: colors.tr101290.p1 }}
          />

          {/* Priority 2 - Major (Orange) */}
          <Line
            type="monotone"
            dataKey="p2_errors"
            stroke={colors.tr101290.p2}
            strokeWidth={3}
            name="Priority 2 (Major)"
            dot={{ r: 4, fill: colors.tr101290.p2 }}
          />

          {/* Priority 3 - Minor (Amber) */}
          <Line
            type="monotone"
            dataKey="p3_errors"
            stroke={colors.tr101290.p3}
            strokeWidth={3}
            name="Priority 3 (Minor)"
            dot={{ r: 4, fill: colors.tr101290.p3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// MDI METRICS CHART - Jitter and DF
// ============================================================================

export const MDIChart = ({ data, height = 300 }) => {
  return (
    <div className="chart-container mdi-chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.chart.gridLines}
            strokeOpacity={0.3}
          />

          <XAxis
            dataKey="time"
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
          />
          <YAxis
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
            label={{
              value: 'Milliseconds',
              angle: -90,
              position: 'insideLeft',
              fill: colors.chart.axisText,
              fontSize: 13,
              fontWeight: 600,
            }}
          />

          <Tooltip content={<MDITooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} />

          {/* Delay Factor (DF) */}
          <Line
            type="monotone"
            dataKey="df"
            stroke={colors.chart.bitrate}
            strokeWidth={3}
            name="Delay Factor (DF)"
            dot={{ r: 4, fill: colors.chart.bitrate }}
          />

          {/* Jitter */}
          <Line
            type="monotone"
            dataKey="jitter"
            stroke={colors.chart.jitter}
            strokeWidth={3}
            name="Jitter"
            dot={{ r: 4, fill: colors.chart.jitter }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// CHANNEL DISTRIBUTION BAR CHART
// ============================================================================

export const ChannelDistributionChart = ({ data }) => {
  return (
    <div className="chart-container distribution-chart">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.chart.gridLines}
            strokeOpacity={0.3}
          />

          <XAxis
            dataKey="tier"
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
          />
          <YAxis
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} />

          <Bar
            dataKey="count"
            fill={colors.chart.bitrate}
            name="Channel Count"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================================
// ALERT SEVERITY CHART
// ============================================================================

export const AlertSeverityChart = ({ data }) => {
  return (
    <div className="chart-container alert-chart">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.chart.gridLines}
            strokeOpacity={0.3}
          />

          <XAxis
            dataKey="severity"
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
          />
          <YAxis
            stroke={colors.chart.axisText}
            tick={{ fill: colors.chart.axisText, fontSize: 12 }}
          />

          <Tooltip content={<AlertTooltip />} />

          <Bar
            dataKey="count"
            name="Alert Count"
            radius={[8, 8, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getSeverityBarColor(entry.severity)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Helper function for alert bar colors
const getSeverityBarColor = (severity) => {
  const map = {
    CRITICAL: colors.status.critical,
    MAJOR: colors.status.major,
    MINOR: colors.status.minor,
    INFO: colors.status.info,
  };
  return map[severity] || colors.status.info;
};

// Import Cell for BarChart colors
import { Cell } from 'recharts';

// ============================================================================
// CUSTOM TOOLTIPS
// ============================================================================

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="tooltip-item" style={{ color: entry.color }}>
          <span className="tooltip-name">{entry.name}:</span>
          <span className="tooltip-value">{entry.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
};

const MOSTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const mos = payload[0].value;
  const rating = getMOSRating(mos);
  const color = getMOSColor(mos);

  return (
    <div className="custom-tooltip mos-tooltip">
      <div className="tooltip-label">{label}</div>
      <div className="tooltip-item" style={{ color }}>
        <span className="tooltip-name">MOS Score:</span>
        <span className="tooltip-value">{mos.toFixed(2)}</span>
      </div>
      <div className="tooltip-rating" style={{ color }}>
        {rating}
      </div>
    </div>
  );
};

const TR101290Tooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip tr101290-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="tooltip-item" style={{ color: entry.color }}>
          <span className="tooltip-name">{entry.name}:</span>
          <span className="tooltip-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const MDITooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip mdi-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="tooltip-item" style={{ color: entry.color }}>
          <span className="tooltip-name">{entry.name}:</span>
          <span className="tooltip-value">{entry.value.toFixed(2)} ms</span>
        </div>
      ))}
    </div>
  );
};

const AlertTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip alert-tooltip">
      <div className="tooltip-label">{label}</div>
      <div className="tooltip-item">
        <span className="tooltip-name">Count:</span>
        <span className="tooltip-value">{payload[0].value}</span>
      </div>
    </div>
  );
};

// Helper functions
const getMOSRating = (mos) => {
  if (mos >= 4.5) return 'Excellent';
  if (mos >= 4.0) return 'Good';
  if (mos >= 3.5) return 'Fair';
  if (mos >= 2.5) return 'Poor';
  return 'Bad';
};

const getMOSColor = (mos) => {
  if (mos >= 4.5) return colors.mos.excellent;
  if (mos >= 4.0) return colors.mos.good;
  if (mos >= 3.5) return colors.mos.fair;
  if (mos >= 2.5) return colors.mos.poor;
  return colors.mos.bad;
};

export default {
  BitrateChart,
  MOSChart,
  TR101290Chart,
  MDIChart,
  ChannelDistributionChart,
  AlertSeverityChart,
};
