// Utility Functions for Inspector Dashboard

/**
 * Format date to localized string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  return new Date(date).toLocaleString('en-US', defaultOptions);
};

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (date) => {
  if (!date) return 'Never';

  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;

  return formatDate(date, { month: 'short', day: 'numeric' });
};

/**
 * Format file size
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format bitrate
 */
export const formatBitrate = (mbps) => {
  if (mbps == null) return 'N/A';

  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(2)} Gbps`;
  }
  if (mbps >= 1) {
    return `${mbps.toFixed(3)} Mbps`;
  }
  return `${(mbps * 1000).toFixed(0)} Kbps`;
};

/**
 * Get severity color class
 */
export const getSeverityColor = (severity) => {
  const colors = {
    CRITICAL: 'error',
    MAJOR: 'warning',
    MINOR: 'info',
    INFO: 'success',
  };
  return colors[severity] || 'default';
};

/**
 * Get status badge color
 */
export const getStatusBadgeClass = (status) => {
  if (status === 'active' || status === 'healthy' || status === 'enabled') {
    return 'badge-success';
  }
  if (status === 'inactive' || status === 'disabled') {
    return 'badge-danger';
  }
  if (status === 'warning') {
    return 'badge-warning';
  }
  return 'badge-default';
};

/**
 * Truncate string with ellipsis
 */
export const truncate = (str, maxLength = 50) => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Group array by key
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return ((value / total) * 100).toFixed(1);
};

/**
 * Export data to CSV
 */
export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Copy to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err2) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};

/**
 * Filter items by search term
 */
export const filterBySearch = (items, searchTerm, fields) => {
  if (!searchTerm) return items;

  const term = searchTerm.toLowerCase();

  return items.filter(item => {
    return fields.some(field => {
      const value = item[field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(term);
    });
  });
};

/**
 * Calculate MOS (Mean Opinion Score) from TR 101 290 errors
 */
export const calculateMOS = (p1Errors = 0, p2Errors = 0, p3Errors = 0) => {
  let mos = 5.0;

  // Deduct for Priority 1 errors (critical)
  mos -= Math.min(p1Errors * 0.1, 2.0);

  // Deduct for Priority 2 errors (less severe)
  mos -= Math.min(p2Errors * 0.02, 0.5);

  // Deduct for Priority 3 errors (informational)
  mos -= Math.min(p3Errors * 0.01, 0.3);

  // Ensure MOS is between 1.0 and 5.0
  return Math.max(1.0, Math.min(5.0, mos));
};

/**
 * Get MOS rating label
 */
export const getMOSRating = (mos) => {
  if (mos >= 4.5) return 'Excellent';
  if (mos >= 4.0) return 'Good';
  if (mos >= 3.5) return 'Fair';
  if (mos >= 2.5) return 'Poor';
  return 'Bad';
};

/**
 * Get MOS color
 */
export const getMOSColor = (mos) => {
  if (mos >= 4.5) return 'success';
  if (mos >= 3.5) return 'warning';
  return 'error';
};

/**
 * Validate URL format
 */
export const isValidURL = (url) => {
  const patterns = [
    /^udp:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/,  // udp://IP:port
    /^https?:\/\/.+/,  // http(s)://
    /^rtmp:\/\/.+/,    // rtmp://
    /^srt:\/\/.+/,     // srt://
  ];

  return patterns.some(pattern => pattern.test(url));
};

/**
 * Parse URL to extract components
 */
export const parseURL = (url) => {
  const match = url.match(/^(\w+):\/\/([^:]+):?(\d+)?/);

  if (!match) return null;

  return {
    protocol: match[1],
    host: match[2],
    port: match[3] ? parseInt(match[3]) : null,
  };
};

/**
 * Get health indicator status
 */
export const getHealthStatus = (metrics) => {
  if (!metrics) return 'unknown';

  const { tr101290_p1_errors = 0, tr101290_p2_errors = 0 } = metrics;

  if (tr101290_p1_errors > 10) return 'critical';
  if (tr101290_p1_errors > 0) return 'warning';
  if (tr101290_p2_errors > 5) return 'minor';
  return 'healthy';
};

/**
 * Generate random ID
 */
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Safe JSON parse
 */
export const safeJSONParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
};

/**
 * Merge class names
 */
export const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Format number with commas
 */
export const formatNumber = (num) => {
  if (num == null) return 'N/A';
  return num.toLocaleString();
};

/**
 * Check if element is in viewport
 */
export const isInViewport = (element) => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

/**
 * Smooth scroll to element
 */
export const scrollToElement = (elementId, offset = 0) => {
  const element = document.getElementById(elementId);
  if (element) {
    const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
};

/**
 * Format duration (seconds to HH:MM:SS)
 */
export const formatDuration = (seconds) => {
  if (seconds == null || seconds < 0) return '00:00:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Retry async function with exponential backoff
 */
export const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};
