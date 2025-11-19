# Inspector Dashboard - Color Palette Integration Example

## 📋 Tích hợp Color Palette mới vào Dashboard hiện tại

Guide này hướng dẫn cách thay thế màu cũ bằng **Professional Color Palette** mới.

---

## 🎯 Step-by-Step Integration

### Step 1: Import Theme Colors

Thêm vào đầu `App.jsx`:

```javascript
// OLD
const API_BASE = '/api/v1';

// NEW - Add these imports
import { colors, getMOSColor, getDFColor, getTR101290Color, getHealthColor } from './theme/colors';
import { BitrateChart, TR101290Chart, MDIChart, MOSChart } from './components/ChartComponents';

const API_BASE = '/api/v1';
```

### Step 2: Update Bitrate Chart

**Before:**
```jsx
<LineChart data={streamMetrics}>
  <Line
    type="monotone"
    dataKey="bitrate"
    stroke="#ffc658"  // Old yellow color
    strokeWidth={2}
    name="Bitrate (Mbps)"
  />
</LineChart>
```

**After:**
```jsx
<BitrateChart data={streamMetrics} height={300} />
```

Hoặc nếu muốn customize:

```jsx
import { colors } from './theme/colors';

<AreaChart data={streamMetrics}>
  <defs>
    <linearGradient id="bitrateGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={colors.chart.bitrate} stopOpacity={0.3} />
      <stop offset="100%" stopColor={colors.chart.bitrate} stopOpacity={0} />
    </linearGradient>
  </defs>

  <CartesianGrid
    strokeDasharray="3 3"
    stroke={colors.chart.gridLines}  // New blue-gray grid
    strokeOpacity={0.3}
  />

  <XAxis
    dataKey="time"
    stroke={colors.chart.axisText}
    tick={{ fill: colors.chart.axisText }}
  />

  <YAxis
    stroke={colors.chart.axisText}
    tick={{ fill: colors.chart.axisText }}
    label={{
      value: 'Mbps',
      angle: -90,
      position: 'insideLeft',
      fill: colors.chart.axisText,
    }}
  />

  <Tooltip content={<CustomTooltip />} />

  <Area
    type="monotone"
    dataKey="bitrate"
    stroke={colors.chart.bitrate}  // Electric Cyan!
    strokeWidth={3}
    fill="url(#bitrateGradient)"
    name="Bitrate (Mbps)"
  />
</AreaChart>
```

### Step 3: Update TR 101 290 Display

**Before:**
```jsx
<div className="tr101290-section p1">
  <span className="error-badge">
    {p1Errors}
  </span>
</div>
```

**After:**
```jsx
import { colors } from './theme/colors';

<div className="tr101290-section p1">
  <span
    className="error-badge"
    style={{
      color: colors.tr101290.p1,
      background: colors.tr101290.p1Bg,
      border: `1px solid ${colors.tr101290.p1Border}`,
      padding: '6px 12px',
      borderRadius: '6px',
      fontWeight: 700,
    }}
  >
    {p1Errors}
  </span>
</div>
```

Hoặc sử dụng Chart component:

```jsx
<TR101290Chart
  data={tr101290Data}
  height={300}
/>
```

### Step 4: Update Status Badges

**Before:**
```jsx
<span className={`badge severity-${alert.severity.toLowerCase()}`}>
  {alert.severity}
</span>
```

**After:**
```jsx
import { getSeverityColor } from './theme/colors';

const getSeverityStyles = (severity) => {
  const colorMap = {
    CRITICAL: {
      color: colors.status.critical,
      bg: colors.status.criticalBg,
      border: colors.status.criticalBorder,
    },
    MAJOR: {
      color: colors.status.major,
      bg: colors.status.majorBg,
      border: colors.status.majorBorder,
    },
    WARNING: {
      color: colors.status.warning,
      bg: colors.status.warningBg,
      border: colors.status.warningBorder,
    },
  };
  return colorMap[severity] || colorMap.WARNING;
};

const { color, bg, border } = getSeverityStyles(alert.severity);

<span
  className="severity-badge"
  style={{
    color,
    background: bg,
    border: `1px solid ${border}`,
    padding: '4px 12px',
    borderRadius: '6px',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '11px',
    letterSpacing: '0.5px',
  }}
>
  {alert.severity}
</span>
```

### Step 5: Update MOS Display

**Before:**
```jsx
<div className="mos-card">
  <div className="mos-value">
    {calculateEstimatedMOS(tr101290Metrics)}
  </div>
</div>
```

**After:**
```jsx
import { getMOSColor } from './theme/colors';

const mos = calculateEstimatedMOS(tr101290Metrics);
const mosColor = getMOSColor(mos);

<div
  className="mos-card"
  style={{
    background: colors.ui.bgSecondary,
    border: `2px solid ${mosColor}`,
    borderRadius: '12px',
    padding: '24px',
    boxShadow: `0 0 20px ${mosColor}40`,  // Add glow effect
  }}
>
  <div
    className="mos-value"
    style={{
      color: mosColor,
      fontSize: '48px',
      fontWeight: 700,
      textShadow: `0 0 20px ${mosColor}`,  // Text glow
    }}
  >
    {mos}
  </div>
  <div
    className="mos-label"
    style={{ color: colors.ui.textSecondary }}
  >
    Estimated MOS
  </div>
</div>
```

Hoặc sử dụng Chart:

```jsx
<MOSChart data={mosData} height={300} />
```

### Step 6: Update MDI Metrics Display

**Before:**
```jsx
<MDIMetric
  label="DF (Delay Factor)"
  value={`${metrics.df?.toFixed(2) || 0} ms`}
/>
```

**After:**
```jsx
import { getDFColor } from './theme/colors';

const dfColor = getDFColor(metrics.df);

<MDIMetric
  label="DF (Delay Factor)"
  value={`${metrics.df?.toFixed(2) || 0} ms`}
  style={{
    color: dfColor,
    background: `${dfColor}10`,  // 10% opacity
    border: `1px solid ${dfColor}40`,
    padding: '16px',
    borderRadius: '8px',
  }}
/>
```

Hoặc sử dụng Chart:

```jsx
<MDIChart data={mdiData} height={300} />
```

### Step 7: Update Health Status Indicator

**Before:**
```jsx
<div className={`health-indicator health-${statusColor}`}>
  ● {statusColor === 'success' ? 'Healthy' : 'Critical'}
</div>
```

**After:**
```jsx
import { getHealthColor } from './theme/colors';

const healthStatus = getHealthStatus(metrics);
const healthColor = getHealthColor(healthStatus);

<div
  className="health-indicator"
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: colors.ui.bgTertiary,
    borderRadius: '8px',
    border: `1px solid ${healthColor}`,
  }}
>
  <span
    className="status-dot"
    style={{
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: healthColor,
      boxShadow: `0 0 10px ${healthColor}`,
      animation: 'statusPulse 2s ease-in-out infinite',
    }}
  />
  <span style={{ color: healthColor, fontWeight: 600 }}>
    {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
  </span>
</div>
```

---

## 🎨 Complete Component Example

### MetricsTab với New Colors

```jsx
const MetricsTab = () => {
  const [selectedInput, setSelectedInput] = useState(null);
  const [streamMetrics, setStreamMetrics] = useState([]);
  const [tr101290Metrics, setTR101290Metrics] = useState(null);
  const [mdiMetrics, setMDIMetrics] = useState(null);
  const [qoeMetrics, setQoEMetrics] = useState(null);

  return (
    <div className="metrics-tab">
      {/* Input Selector */}
      <div className="metrics-controls">
        <label>
          <strong>Select Input:</strong>
          <select
            value={selectedInput || ''}
            onChange={(e) => setSelectedInput(parseInt(e.target.value))}
            style={{
              background: colors.ui.bgTertiary,
              border: `1px solid ${colors.ui.borderPrimary}`,
              color: colors.ui.textPrimary,
              padding: '8px 12px',
              borderRadius: '6px',
            }}
          >
            <option value="">-- Select Input --</option>
            {inputs.map(input => (
              <option key={input.input_id} value={input.input_id}>
                {input.input_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Stream Status Panel với New Colors */}
      {inputStatus && (
        <div
          className="stream-status-panel"
          style={{
            background: colors.ui.bgSecondary,
            border: `1px solid ${colors.ui.borderPrimary}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ color: colors.ui.textPrimary }}>
            Stream Status: {inputStatus.input_name}
          </h3>

          <div className="status-grid">
            <div className="status-item">
              <div style={{ color: colors.ui.textSecondary }}>
                Current Bitrate
              </div>
              <div style={{
                color: colors.chart.bitrate,
                fontSize: '24px',
                fontWeight: 700,
              }}>
                {inputStatus.bitrate_mbps?.toFixed(3) || 'N/A'} Mbps
              </div>
            </div>

            <div className="status-item">
              <div style={{ color: colors.ui.textSecondary }}>
                TR 101 290 P1 Errors
              </div>
              <div style={{
                color: inputStatus.tr101290_p1_errors > 0
                  ? colors.tr101290.p1
                  : colors.status.success,
                fontSize: '24px',
                fontWeight: 700,
              }}>
                {inputStatus.tr101290_p1_errors || 0}
              </div>
            </div>

            <div className="status-item">
              <div style={{ color: colors.ui.textSecondary }}>
                Stream Health
              </div>
              {(() => {
                const healthStatus = getHealthStatus(inputStatus);
                const healthColor = getHealthColor(healthStatus);
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: healthColor,
                      boxShadow: `0 0 10px ${healthColor}`,
                    }} />
                    <span style={{
                      color: healthColor,
                      fontWeight: 600,
                      fontSize: '16px',
                    }}>
                      {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bitrate Chart với Electric Cyan */}
      {streamMetrics.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            color: colors.ui.textPrimary,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{
              width: '4px',
              height: '24px',
              background: colors.chart.bitrate,
              borderRadius: '2px',
            }} />
            Stream Bitrate
          </h3>
          <BitrateChart data={streamMetrics} height={300} />
        </div>
      )}

      {/* TR 101 290 Metrics với Priority Colors */}
      {tr101290Metrics && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            color: colors.ui.textPrimary,
            marginBottom: '16px',
          }}>
            TR 101 290 DVB Stream Analysis
          </h3>
          <TR101290Chart
            data={convertTR101290ToChartData(tr101290Metrics)}
            height={300}
          />
        </div>
      )}

      {/* MDI Metrics Chart */}
      {mdiMetrics && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            color: colors.ui.textPrimary,
            marginBottom: '16px',
          }}>
            MDI Network Transport Metrics
          </h3>
          <MDIChart
            data={convertMDIToChartData(mdiMetrics)}
            height={300}
          />
        </div>
      )}

      {/* MOS Quality Chart */}
      {qoeMetrics && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            color: colors.ui.textPrimary,
            marginBottom: '16px',
          }}>
            MOS Quality Score
          </h3>
          <MOSChart
            data={convertQoEToMOSData(qoeMetrics)}
            height={300}
          />
        </div>
      )}
    </div>
  );
};

// Helper function to get health status
const getHealthStatus = (metrics) => {
  if (!metrics || !metrics.enabled) return 'disabled';
  if (metrics.tr101290_p1_errors > 10) return 'critical';
  if (metrics.tr101290_p1_errors > 0) return 'warning';
  return 'healthy';
};
```

---

## 📊 CSS Updates

### Update Dashboard.css

**Add these new classes:**

```css
/* Status Badges với New Colors */
.severity-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
}

.severity-badge.critical {
  color: #FF3B3B;
  background: rgba(255, 59, 59, 0.15);
  border: 1px solid rgba(255, 59, 59, 0.4);
}

.severity-badge.major {
  color: #FF8C00;
  background: rgba(255, 140, 0, 0.15);
  border: 1px solid rgba(255, 140, 0, 0.4);
}

.severity-badge.warning {
  color: #FFB800;
  background: rgba(255, 184, 0, 0.15);
  border: 1px solid rgba(255, 184, 0, 0.4);
}

.severity-badge.success {
  color: #00D9A3;
  background: rgba(0, 217, 163, 0.15);
  border: 1px solid rgba(0, 217, 163, 0.4);
}

/* Status Pulse Animation */
@keyframes statusPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.status-dot {
  animation: statusPulse 2s ease-in-out infinite;
}

/* MOS Card Glow Effect */
.mos-card {
  position: relative;
  transition: all 0.3s ease;
}

.mos-card::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(135deg, #00E5FF, #00D9A3);
  border-radius: 14px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.mos-card:hover::before {
  opacity: 0.3;
}

/* Grid Lines Enhancement */
.recharts-cartesian-grid-horizontal line,
.recharts-cartesian-grid-vertical line {
  stroke: #334455 !important;
  stroke-opacity: 0.3 !important;
}
```

---

## 🚀 Migration Checklist

### Phase 1: Charts
- [ ] Replace Bitrate chart color từ `#ffc658` → `#00E5FF`
- [ ] Add gradient fill cho area charts
- [ ] Update grid lines từ gray → blue-gray `#334455`
- [ ] Update axis labels color → `#94A3B8`

### Phase 2: Status Colors
- [ ] Update CRITICAL badges → `#FF3B3B`
- [ ] Update MAJOR badges → `#FF8C00`
- [ ] Update WARNING badges → `#FFB800`
- [ ] Update SUCCESS badges → `#00D9A3`

### Phase 3: TR 101 290
- [ ] Update P1 errors → Red `#FF3B3B`
- [ ] Update P2 errors → Orange `#FF8C00`
- [ ] Update P3 errors → Amber `#FFB800`
- [ ] Add background colors với opacity

### Phase 4: MDI/QoE
- [ ] Update DF colors based on thresholds
- [ ] Update Jitter colors
- [ ] Update Buffer utilization colors
- [ ] Update MOS score colors

### Phase 5: Components
- [ ] Import new Chart components
- [ ] Replace old LineChart với BitrateChart
- [ ] Add TR101290Chart
- [ ] Add MDIChart
- [ ] Add MOSChart

---

## ✅ Testing

### Visual Testing
1. Open Dashboard
2. Check Bitrate chart → Should see Electric Cyan (#00E5FF)
3. Check grid lines → Should see blue-gray (#334455)
4. Check status badges → Should see vivid colors
5. Check MOS display → Should have glow effect
6. Hover over charts → Should see glow effects

### Contrast Testing
1. Use Chrome DevTools Lighthouse
2. Check Color Contrast Analyzer
3. Verify all text meets WCAG AA (4.5:1) or AAA (7:1)

### Responsive Testing
1. Test on desktop (1920x1080)
2. Test on tablet (768x1024)
3. Test on mobile (375x667)
4. Check chart responsiveness
5. Check badge sizing

---

## 📚 Resources

- **Color Palette Reference**: `theme/colors.js`
- **Chart Components**: `components/ChartComponents.jsx`
- **Complete Guide**: `COLOR_PALETTE_GUIDE.md`
- **Original App**: `App.jsx`

---

**Ready to implement?** Start với Phase 1 (Charts) và dần dần migrate sang phases khác!
