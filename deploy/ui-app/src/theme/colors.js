// Inspector Dashboard - Professional Color Palette
// Optimized for monitoring systems with high contrast on dark backgrounds

export const colors = {
  // ============================================================================
  // PRIMARY CHART COLORS - High visibility on dark backgrounds
  // ============================================================================
  chart: {
    // Bitrate line - Electric Cyan (high contrast, tech monitoring standard)
    bitrate: '#00E5FF',           // Vivid Cyan - Main bitrate line
    bitrateGlow: '#00B8D4',       // Darker cyan for glow effect
    bitrateGradientStart: 'rgba(0, 229, 255, 0.3)',
    bitrateGradientEnd: 'rgba(0, 229, 255, 0)',

    // Alternative option - Lime Green (maximum contrast)
    bitrateAlt: '#CCFF00',        // Bright Lime
    bitrateAltGlow: '#A3CC00',

    // Alternative option 2 - Turquoise
    bitrateTurquoise: '#40E0D0',
    bitrateTurquoiseGlow: '#20C9BA',

    // Other metrics
    mos: '#00FF9F',               // Bright Green for MOS
    loudness: '#FFA726',          // Orange for audio loudness
    jitter: '#AB47BC',            // Purple for jitter
    packetLoss: '#FF4444',        // Red for packet loss

    // Grid lines - Blue-tinted gray for better eye tracking
    gridLines: '#334455',         // Blue-gray grid
    gridLinesLight: '#445566',    // Lighter blue-gray for emphasis

    // Axis labels
    axisText: '#94A3B8',          // Light gray-blue

    // Chart background
    chartBg: 'rgba(15, 20, 25, 0.6)',
    chartBgGradient: 'linear-gradient(180deg, rgba(26, 31, 46, 0.8) 0%, rgba(15, 20, 25, 0.9) 100%)',
  },

  // ============================================================================
  // STATUS COLORS - Saturated for high visibility alerts
  // ============================================================================
  status: {
    // CRITICAL - Vivid Red (P1 errors, critical alerts)
    critical: '#FF3B3B',          // Bright vivid red
    criticalBg: 'rgba(255, 59, 59, 0.15)',
    criticalBorder: 'rgba(255, 59, 59, 0.4)',
    criticalGlow: 'rgba(255, 59, 59, 0.6)',

    // MAJOR - Bright Orange (P2 errors, major warnings)
    major: '#FF8C00',             // Bright orange
    majorBg: 'rgba(255, 140, 0, 0.15)',
    majorBorder: 'rgba(255, 140, 0, 0.4)',
    majorGlow: 'rgba(255, 140, 0, 0.5)',

    // WARNING - Amber
    warning: '#FFB800',           // Bright amber
    warningBg: 'rgba(255, 184, 0, 0.15)',
    warningBorder: 'rgba(255, 184, 0, 0.4)',

    // MINOR - Yellow
    minor: '#FFD700',             // Gold yellow
    minorBg: 'rgba(255, 215, 0, 0.15)',
    minorBorder: 'rgba(255, 215, 0, 0.4)',

    // NORMAL/SUCCESS - Teal Green (healthy state)
    success: '#00D9A3',           // Bright teal green
    successBg: 'rgba(0, 217, 163, 0.15)',
    successBorder: 'rgba(0, 217, 163, 0.4)',
    successGlow: 'rgba(0, 217, 163, 0.5)',

    // HEALTHY - Emerald (perfect state)
    healthy: '#10B981',           // Emerald green
    healthyBg: 'rgba(16, 185, 129, 0.15)',
    healthyBorder: 'rgba(16, 185, 129, 0.4)',

    // INFO - Cyan
    info: '#00B8D4',              // Bright cyan
    infoBg: 'rgba(0, 184, 212, 0.15)',
    infoBorder: 'rgba(0, 184, 212, 0.4)',

    // NO DATA - Cool Gray
    noData: '#6B7280',            // Cool gray
    noDataBg: 'rgba(107, 114, 128, 0.1)',
    noDataBorder: 'rgba(107, 114, 128, 0.3)',

    // DISABLED - Darker gray
    disabled: '#4B5563',
    disabledBg: 'rgba(75, 85, 99, 0.1)',

    // UNKNOWN - Purple-gray
    unknown: '#8B5CF6',
    unknownBg: 'rgba(139, 92, 246, 0.15)',
  },

  // ============================================================================
  // TR 101 290 PRIORITY COLORS
  // ============================================================================
  tr101290: {
    // Priority 1 - Critical errors (sync loss, PAT/PMT errors)
    p1: '#FF3B3B',                // Vivid red
    p1Bg: 'rgba(255, 59, 59, 0.15)',
    p1Border: 'rgba(255, 59, 59, 0.5)',

    // Priority 2 - Quality errors (CRC, PCR errors)
    p2: '#FF8C00',                // Bright orange
    p2Bg: 'rgba(255, 140, 0, 0.15)',
    p2Border: 'rgba(255, 140, 0, 0.5)',

    // Priority 3 - Informational (unreferenced PIDs)
    p3: '#FFB800',                // Amber
    p3Bg: 'rgba(255, 184, 0, 0.15)',
    p3Border: 'rgba(255, 184, 0, 0.5)',

    // No errors - Success
    noErrors: '#00D9A3',          // Teal green
    noErrorsBg: 'rgba(0, 217, 163, 0.15)',
  },

  // ============================================================================
  // MDI/QOE METRIC COLORS
  // ============================================================================
  mdi: {
    // Delay Factor (DF)
    df: {
      excellent: '#00D9A3',       // < 5ms - Teal green
      good: '#10B981',            // 5-15ms - Emerald
      fair: '#FFB800',            // 15-30ms - Amber
      poor: '#FF8C00',            // 30-50ms - Orange
      critical: '#FF3B3B',        // > 50ms - Red
    },

    // Media Loss Rate (MLR)
    mlr: {
      zero: '#00D9A3',            // No loss - Teal green
      low: '#FFB800',             // < 0.1% - Amber
      high: '#FF8C00',            // 0.1-1% - Orange
      critical: '#FF3B3B',        // > 1% - Red
    },

    // Jitter
    jitter: {
      low: '#00D9A3',             // < 5ms - Teal green
      medium: '#FFB800',          // 5-15ms - Amber
      high: '#FF3B3B',            // > 15ms - Red
    },

    // Buffer utilization
    buffer: {
      low: '#00D9A3',             // < 60% - Teal green
      medium: '#FFB800',          // 60-85% - Amber
      high: '#FF8C00',            // 85-95% - Orange
      critical: '#FF3B3B',        // > 95% - Red
    },
  },

  // ============================================================================
  // MOS QUALITY COLORS
  // ============================================================================
  mos: {
    excellent: '#00D9A3',         // 4.5-5.0 - Teal green
    good: '#10B981',              // 4.0-4.5 - Emerald
    fair: '#FFB800',              // 3.5-4.0 - Amber
    poor: '#FF8C00',              // 2.5-3.5 - Orange
    bad: '#FF3B3B',               // 1.0-2.5 - Red
  },

  // ============================================================================
  // UI COMPONENT COLORS
  // ============================================================================
  ui: {
    // Backgrounds
    bgPrimary: '#0F1419',         // Main dark background
    bgSecondary: '#1A1F2E',       // Card/panel background
    bgTertiary: '#2D3748',        // Input/button background
    bgHover: '#374151',           // Hover state
    bgActive: '#4B5563',          // Active state

    // Borders
    borderPrimary: '#2D3748',     // Main borders
    borderSecondary: '#4A5568',   // Secondary borders
    borderAccent: '#4299E1',      // Accent borders (focus)
    borderLight: '#374151',       // Light borders

    // Text
    textPrimary: '#E0E6ED',       // Main text
    textSecondary: '#A0AEC0',     // Secondary text
    textTertiary: '#718096',      // Tertiary text/labels
    textMuted: '#6B7280',         // Muted text
    textDisabled: '#4B5563',      // Disabled text

    // Accents
    accentPrimary: '#00E5FF',     // Primary accent (cyan)
    accentSecondary: '#4299E1',   // Secondary accent (blue)
    accentTertiary: '#00D9A3',    // Tertiary accent (teal)

    // Overlays
    overlayLight: 'rgba(255, 255, 255, 0.05)',
    overlayMedium: 'rgba(255, 255, 255, 0.1)',
    overlayDark: 'rgba(0, 0, 0, 0.5)',
  },

  // ============================================================================
  // BADGE COLORS
  // ============================================================================
  badge: {
    // Channel types
    '4k': {
      bg: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      text: '#FFFFFF',
      border: '#A78BFA',
    },
    hdr: {
      bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      text: '#FFFFFF',
      border: '#FBBF24',
    },
    atmos: {
      bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      text: '#FFFFFF',
      border: '#34D399',
    },
    live: {
      bg: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      text: '#FFFFFF',
      border: '#F87171',
    },

    // Input types
    udp: '#00E5FF',
    http: '#4299E1',
    hls: '#10B981',
    rtmp: '#F59E0B',
    srt: '#8B5CF6',
  },

  // ============================================================================
  // GRADIENT OVERLAYS
  // ============================================================================
  gradients: {
    // Chart area fill
    chartAreaCyan: 'linear-gradient(180deg, rgba(0, 229, 255, 0.2) 0%, rgba(0, 229, 255, 0) 100%)',
    chartAreaGreen: 'linear-gradient(180deg, rgba(0, 217, 163, 0.2) 0%, rgba(0, 217, 163, 0) 100%)',
    chartAreaOrange: 'linear-gradient(180deg, rgba(255, 140, 0, 0.2) 0%, rgba(255, 140, 0, 0) 100%)',

    // Card backgrounds
    cardHeader: 'linear-gradient(90deg, #1A1F2E 0%, #2D3748 100%)',
    cardHover: 'linear-gradient(135deg, rgba(66, 153, 225, 0.1) 0%, rgba(0, 229, 255, 0.05) 100%)',

    // Button gradients
    buttonPrimary: 'linear-gradient(135deg, #00E5FF 0%, #00B8D4 100%)',
    buttonSuccess: 'linear-gradient(135deg, #00D9A3 0%, #10B981 100%)',
    buttonDanger: 'linear-gradient(135deg, #FF3B3B 0%, #DC2626 100%)',
    buttonWarning: 'linear-gradient(135deg, #FF8C00 0%, #F59E0B 100%)',
  },

  // ============================================================================
  // SHADOW COLORS (for glow effects)
  // ============================================================================
  shadows: {
    cyan: '0 0 20px rgba(0, 229, 255, 0.4)',
    cyanStrong: '0 0 30px rgba(0, 229, 255, 0.6)',
    green: '0 0 20px rgba(0, 217, 163, 0.4)',
    red: '0 0 20px rgba(255, 59, 59, 0.4)',
    orange: '0 0 20px rgba(255, 140, 0, 0.4)',
    purple: '0 0 20px rgba(139, 92, 246, 0.4)',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get color based on severity
 */
export const getSeverityColor = (severity) => {
  const map = {
    CRITICAL: colors.status.critical,
    MAJOR: colors.status.major,
    WARNING: colors.status.warning,
    MINOR: colors.status.minor,
    INFO: colors.status.info,
  };
  return map[severity] || colors.status.info;
};

/**
 * Get TR 101 290 priority color
 */
export const getTR101290Color = (priority) => {
  const map = {
    1: colors.tr101290.p1,
    2: colors.tr101290.p2,
    3: colors.tr101290.p3,
  };
  return map[priority] || colors.tr101290.noErrors;
};

/**
 * Get MOS quality color
 */
export const getMOSColor = (mos) => {
  if (mos >= 4.5) return colors.mos.excellent;
  if (mos >= 4.0) return colors.mos.good;
  if (mos >= 3.5) return colors.mos.fair;
  if (mos >= 2.5) return colors.mos.poor;
  return colors.mos.bad;
};

/**
 * Get delay factor color
 */
export const getDFColor = (df) => {
  if (df < 5) return colors.mdi.df.excellent;
  if (df < 15) return colors.mdi.df.good;
  if (df < 30) return colors.mdi.df.fair;
  if (df < 50) return colors.mdi.df.poor;
  return colors.mdi.df.critical;
};

/**
 * Get jitter color
 */
export const getJitterColor = (jitter) => {
  if (jitter < 5) return colors.mdi.jitter.low;
  if (jitter < 15) return colors.mdi.jitter.medium;
  return colors.mdi.jitter.high;
};

/**
 * Get buffer utilization color
 */
export const getBufferColor = (utilization) => {
  if (utilization < 60) return colors.mdi.buffer.low;
  if (utilization < 85) return colors.mdi.buffer.medium;
  if (utilization < 95) return colors.mdi.buffer.high;
  return colors.mdi.buffer.critical;
};

/**
 * Get health status color
 */
export const getHealthColor = (status) => {
  const map = {
    healthy: colors.status.healthy,
    success: colors.status.success,
    warning: colors.status.warning,
    critical: colors.status.critical,
    error: colors.status.critical,
    disabled: colors.status.disabled,
    unknown: colors.status.unknown,
  };
  return map[status] || colors.status.noData;
};

export default colors;
