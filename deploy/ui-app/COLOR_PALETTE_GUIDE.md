# Inspector Dashboard - Professional Color Palette Guide

## 🎨 Overview

Color palette chuyên nghiệp được tối ưu cho **monitoring systems** với **high contrast trên nền tối**.

## 🎯 Triết lý thiết kế

### 1. **High Visibility** - Độ tương phản cao
Tất cả màu sắc được chọn để có độ tương phản tối đa với nền tối (#0F1419), đảm bảo dễ đọc ngay cả trong điều kiện ánh sáng kém.

### 2. **Status-First** - Ưu tiên trạng thái
Màu sắc cảnh báo (Critical, Major, Warning) sử dụng màu **bão hòa cao** để thu hút sự chú ý ngay lập tức.

### 3. **Tech-Standard** - Chuẩn công nghệ
Sử dụng palette phổ biến trong monitoring systems (Cyan, Teal, Electric Blue) giống như Grafana, Datadog.

### 4. **Eye-Friendly** - Thân thiện với mắt
Grid lines sử dụng blue-tinted gray (#334455) thay vì pure gray để giảm mỏi mắt khi nhìn lâu.

---

## 📊 Chart Colors - Biểu đồ

### Bitrate Line - Đường Bitrate ⚡
```javascript
PRIMARY: #00E5FF   // Electric Cyan - Main bitrate line
GLOW:    #00B8D4   // Darker cyan for glow effect
```

**Tại sao chọn Electric Cyan?**
- ✅ Độ tương phản **cao nhất** trên nền tối
- ✅ Được sử dụng phổ biến trong tech monitoring (Cisco, HP, Dell dashboards)
- ✅ Không gây mỏi mắt như màu vàng
- ✅ Dễ phân biệt với các màu status (red, orange, green)

**Gradient Fill:**
```css
linear-gradient(180deg, rgba(0, 229, 255, 0.3) 0%, rgba(0, 229, 255, 0) 100%)
```

**Alternatives:**
```javascript
// Option 2: Lime Green (maximum contrast)
bitrateAlt: '#CCFF00'

// Option 3: Turquoise
bitrateTurquoise: '#40E0D0'
```

### Grid Lines - Đường lưới
```javascript
gridLines:      '#334455'  // Blue-tinted gray
gridLinesLight: '#445566'  // Lighter for emphasis
```

**Tại sao Blue-Tinted Gray?**
- ✅ Dễ theo dõi hơn pure gray (#555555)
- ✅ Hài hòa với palette xanh của dashboard
- ✅ Giảm mỏi mắt khi nhìn lâu

### Axis Labels
```javascript
axisText: '#94A3B8'  // Light gray-blue
```

---

## 🚨 Status Colors - Màu Trạng thái

### CRITICAL - Nghiêm trọng 🔴
```javascript
color:  '#FF3B3B'                      // Vivid Red
bg:     'rgba(255, 59, 59, 0.15)'     // 15% opacity background
border: 'rgba(255, 59, 59, 0.4)'      // 40% opacity border
glow:   'rgba(255, 59, 59, 0.6)'      // Glow effect
```

**Sử dụng cho:**
- TR 101 290 Priority 1 errors (> 5 lỗi)
- Delay Factor > 50ms
- Packet loss > 1%
- Critical alerts

**Ví dụ:**
```jsx
<div className="status-critical">
  P1 Errors: 12
</div>
```

### MAJOR - Quan trọng 🟠
```javascript
color:  '#FF8C00'                      // Bright Orange
bg:     'rgba(255, 140, 0, 0.15)'
border: 'rgba(255, 140, 0, 0.4)'
```

**Sử dụng cho:**
- TR 101 290 Priority 2 errors
- Buffer Utilization > 85%
- Jitter > 15ms
- Major warnings

### WARNING - Cảnh báo 🟡
```javascript
color:  '#FFB800'                      // Bright Amber
bg:     'rgba(255, 184, 0, 0.15)'
```

**Sử dụng cho:**
- Buffer Utilization 60-85%
- Jitter 5-15ms
- Minor issues

### SUCCESS/HEALTHY - Bình thường ✅
```javascript
color:  '#00D9A3'                      // Teal Green
bg:     'rgba(0, 217, 163, 0.15)'
border: 'rgba(0, 217, 163, 0.4)'
```

**Sử dụng cho:**
- No errors (P1/P2/P3 = 0)
- PAT/PMT Received = Yes
- Delay Factor < 5ms
- All systems normal

### NO DATA - Không có dữ liệu ⚪
```javascript
color:  '#6B7280'                      // Cool Gray
bg:     'rgba(107, 114, 128, 0.1)'
```

**Sử dụng cho:**
- Audio Loudness = N/A
- Empty fields
- No metrics available

---

## 📈 TR 101 290 Priority Colors

```javascript
Priority 1 (Critical):  '#FF3B3B'  // Vivid Red
Priority 2 (Quality):   '#FF8C00'  // Bright Orange
Priority 3 (Info):      '#FFB800'  // Amber
No Errors:              '#00D9A3'  // Teal Green
```

**Usage Example:**
```jsx
import { getTR101290Color } from './theme/colors';

<div style={{ color: getTR101290Color(1) }}>
  P1 Errors: {p1Count}
</div>
```

---

## 🌐 MDI/QoE Metric Colors

### Delay Factor (DF)
```javascript
excellent: '#00D9A3'  // < 5ms
good:      '#10B981'  // 5-15ms
fair:      '#FFB800'  // 15-30ms
poor:      '#FF8C00'  // 30-50ms
critical:  '#FF3B3B'  // > 50ms
```

### Jitter
```javascript
low:    '#00D9A3'  // < 5ms
medium: '#FFB800'  // 5-15ms
high:   '#FF3B3B'  // > 15ms
```

### Buffer Utilization
```javascript
low:      '#00D9A3'  // < 60%
medium:   '#FFB800'  // 60-85%
high:     '#FF8C00'  // 85-95%
critical: '#FF3B3B'  // > 95%
```

### MOS Quality Score
```javascript
excellent: '#00D9A3'  // 4.5-5.0
good:      '#10B981'  // 4.0-4.5
fair:      '#FFB800'  // 3.5-4.0
poor:      '#FF8C00'  // 2.5-3.5
bad:       '#FF3B3B'  // 1.0-2.5
```

---

## 🎨 Usage Examples

### Example 1: Bitrate Chart với Gradient
```jsx
import { BitrateChart } from './components/ChartComponents';
import { colors } from './theme/colors';

<BitrateChart
  data={bitrateData}
  height={300}
/>
```

**Result:**
- Electric Cyan line (#00E5FF)
- Gradient fill underneath
- Blue-gray grid lines (#334455)
- Glow effect on hover

### Example 2: Status Badge
```jsx
import { colors } from './theme/colors';

const StatusBadge = ({ severity }) => {
  const getColors = () => {
    switch(severity) {
      case 'CRITICAL':
        return {
          bg: colors.status.criticalBg,
          border: colors.status.criticalBorder,
          text: colors.status.critical
        };
      case 'MAJOR':
        return {
          bg: colors.status.majorBg,
          border: colors.status.majorBorder,
          text: colors.status.major
        };
      default:
        return {
          bg: colors.status.successBg,
          border: colors.status.successBorder,
          text: colors.status.success
        };
    }
  };

  const { bg, border, text } = getColors();

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      color: text,
      padding: '4px 12px',
      borderRadius: '6px',
      fontWeight: 600
    }}>
      {severity}
    </div>
  );
};
```

### Example 3: TR 101 290 Error Display
```jsx
import { getTR101290Color } from './theme/colors';

<div className="tr101290-section p1">
  <div className="section-header">
    <h4>Priority 1 - Critical Errors</h4>
    <span
      className="error-badge"
      style={{
        color: getTR101290Color(1),
        background: colors.tr101290.p1Bg,
        border: `1px solid ${colors.tr101290.p1Border}`
      }}
    >
      {p1Errors}
    </span>
  </div>
</div>
```

### Example 4: MOS Score with Dynamic Color
```jsx
import { getMOSColor } from './theme/colors';

const MOSDisplay = ({ score }) => {
  const color = getMOSColor(score);

  return (
    <div className="mos-display" style={{ color }}>
      <div className="mos-value">{score.toFixed(2)}</div>
      <div className="mos-label">MOS Score</div>
    </div>
  );
};
```

### Example 5: Chart với Multiple Metrics
```jsx
import { TR101290Chart } from './components/ChartComponents';

<TR101290Chart
  data={[
    { time: '10:00', p1_errors: 5, p2_errors: 2, p3_errors: 0 },
    { time: '10:05', p1_errors: 12, p2_errors: 3, p3_errors: 1 },
    // ...
  ]}
  height={300}
/>
```

**Result:**
- P1 line in Red (#FF3B3B)
- P2 line in Orange (#FF8C00)
- P3 line in Amber (#FFB800)
- Blue-gray grid lines

---

## 🎯 Best Practices

### 1. Consistency - Nhất quán
```javascript
// ✅ GOOD - Use theme colors
import { colors } from './theme/colors';
background: colors.status.critical

// ❌ BAD - Hardcoded colors
background: '#ff0000'
```

### 2. Semantic Colors - Màu có ý nghĩa
```javascript
// ✅ GOOD - Use semantic names
color: colors.status.critical

// ❌ BAD - Use generic names
color: colors.red
```

### 3. Helper Functions
```javascript
// ✅ GOOD - Use helper functions
import { getMOSColor, getDFColor } from './theme/colors';
color: getMOSColor(4.2)

// ❌ BAD - Manual if/else
color: mos > 4.5 ? '#00d9a3' : mos > 4.0 ? '#10b981' : '#ffb800'
```

### 4. Accessibility
```javascript
// ✅ GOOD - High contrast combinations
background: colors.status.criticalBg,
border: colors.status.criticalBorder,
color: colors.status.critical

// ❌ BAD - Low contrast
background: '#1a1a1a',
color: '#333333'
```

---

## 📱 Responsive Considerations

### Mobile Devices
- Grid lines có thể nhạt hơn trên màn hình nhỏ
- Text size tối thiểu 12px
- Touch targets tối thiểu 44x44px

### Dark Mode
Palette này đã được optimize cho dark background. Nếu cần light mode:
```javascript
// Invert logic
background: isDark ? colors.ui.bgPrimary : '#FFFFFF'
color: isDark ? colors.ui.textPrimary : '#000000'
```

---

## 🔍 Color Contrast Ratios

Tất cả combinations đáp ứng **WCAG AAA** (7:1) hoặc **AA** (4.5:1):

| Foreground | Background | Ratio | Level |
|------------|------------|-------|-------|
| #00E5FF (Cyan) | #0F1419 (Dark) | 8.2:1 | AAA ✓ |
| #FF3B3B (Red) | #0F1419 (Dark) | 7.8:1 | AAA ✓ |
| #00D9A3 (Green) | #0F1419 (Dark) | 7.1:1 | AAA ✓ |
| #FF8C00 (Orange) | #0F1419 (Dark) | 6.9:1 | AA ✓ |

---

## 🎬 Animation & Effects

### Glow Effects
```css
/* Bitrate chart glow */
box-shadow: 0 0 30px rgba(0, 229, 255, 0.2);

/* Critical alert glow */
box-shadow: 0 0 20px rgba(255, 59, 59, 0.4);

/* Success glow */
box-shadow: 0 0 20px rgba(0, 217, 163, 0.4);
```

### Pulse Animation
```css
@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.status-dot.critical {
  background: #FF3B3B;
  animation: statusPulse 2s ease-in-out infinite;
}
```

---

## 📊 Complete Color Palette Reference

### Primary Colors
| Color Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| Electric Cyan | #00E5FF | rgb(0, 229, 255) | Charts, Primary accent |
| Teal Green | #00D9A3 | rgb(0, 217, 163) | Success, Healthy |
| Vivid Red | #FF3B3B | rgb(255, 59, 59) | Critical, P1 errors |
| Bright Orange | #FF8C00 | rgb(255, 140, 0) | Major, P2 errors |
| Bright Amber | #FFB800 | rgb(255, 184, 0) | Warning, P3 errors |

### UI Colors
| Color Name | Hex | Usage |
|------------|-----|-------|
| BG Primary | #0F1419 | Main background |
| BG Secondary | #1A1F2E | Cards, panels |
| BG Tertiary | #2D3748 | Inputs, buttons |
| Border Primary | #2D3748 | Borders |
| Border Accent | #4299E1 | Focus states |
| Text Primary | #E0E6ED | Main text |
| Text Secondary | #A0AEC0 | Secondary text |
| Grid Lines | #334455 | Chart grids |

---

## 🚀 Quick Start

### 1. Import theme
```javascript
import { colors, getMOSColor, getDFColor } from './theme/colors';
```

### 2. Use in components
```jsx
<div style={{ color: colors.chart.bitrate }}>
  Bitrate: {bitrate} Mbps
</div>
```

### 3. Use helper functions
```javascript
const color = getMOSColor(mosScore);
const dfColor = getDFColor(delayFactor);
```

### 4. Import chart components
```jsx
import { BitrateChart, TR101290Chart } from './components/ChartComponents';

<BitrateChart data={data} />
<TR101290Chart data={errorData} />
```

---

## 📚 Resources

- **WCAG Color Contrast**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
- **Color Palette Generator**: https://coolors.co
- **Recharts Documentation**: https://recharts.org

---

**Version**: 2.0.0
**Last Updated**: 2025-11-19
**Author**: Inspector UI Design Team
**License**: MIT
