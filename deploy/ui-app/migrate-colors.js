#!/usr/bin/env node

/**
 * Color Migration Script
 * Automatically replaces old color values with new professional palette
 *
 * Usage:
 *   node migrate-colors.js <file-path>
 *   node migrate-colors.js src/App.jsx
 *
 * Or migrate all files:
 *   node migrate-colors.js --all
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// COLOR MAPPING - Old colors → New professional palette
// ============================================================================

const colorMappings = {
  // Chart colors
  '#ffc658': '#00E5FF',  // Yellow → Electric Cyan (bitrate line)
  '#FFC658': '#00E5FF',

  // Grid lines
  '#555': '#334455',     // Gray → Blue-gray
  '#555555': '#334455',

  // Status colors - Critical/Error
  '#f56565': '#FF3B3B',  // Red → Vivid Red
  '#F56565': '#FF3B3B',
  '#dc2626': '#FF3B3B',
  '#DC2626': '#FF3B3B',
  '#ef4444': '#FF3B3B',
  '#EF4444': '#FF3B3B',

  // Status colors - Major/Warning
  '#ed8936': '#FF8C00',  // Orange → Bright Orange
  '#ED8936': '#FF8C00',
  '#f59e0b': '#FF8C00',
  '#F59E0B': '#FF8C00',
  '#d97706': '#FF8C00',
  '#D97706': '#FF8C00',

  // Status colors - Minor/Warning
  '#ecc94b': '#FFB800',  // Yellow → Amber
  '#ECC94B': '#FFB800',
  '#fbbf24': '#FFB800',
  '#FBBF24': '#FFB800',

  // Status colors - Success/Healthy
  '#48bb78': '#00D9A3',  // Green → Teal Green
  '#48BB78': '#00D9A3',
  '#10b981': '#00D9A3',
  '#10B981': '#00D9A3',
  '#059669': '#00D9A3',
  '#059669': '#00D9A3',

  // Accent colors
  '#4299e1': '#00E5FF',  // Blue → Electric Cyan
  '#4299E1': '#00E5FF',
  '#3182ce': '#00B8D4',  // Darker blue → Cyan glow
  '#3182CE': '#00B8D4',

  // Background colors (keep as is but document)
  '#0f1419': '#0F1419',  // BG Primary (unchanged)
  '#0F1419': '#0F1419',
  '#1a1f2e': '#1A1F2E',  // BG Secondary (unchanged)
  '#1A1F2E': '#1A1F2E',
  '#2d3748': '#2D3748',  // BG Tertiary (unchanged)
  '#2D3748': '#2D3748',

  // Border colors
  '#4a5568': '#4A5568',  // Border (unchanged but documented)
  '#4A5568': '#4A5568',

  // Text colors
  '#e0e6ed': '#E0E6ED',  // Text Primary (unchanged)
  '#E0E6ED': '#E0E6ED',
  '#a0aec0': '#A0AEC0',  // Text Secondary (unchanged)
  '#A0AEC0': '#A0AEC0',
  '#718096': '#718096',  // Text Tertiary (unchanged)
  '#718096': '#718096',

  // No data / disabled
  '#cbd5e0': '#6B7280',  // Gray → Cool Gray
  '#CBD5E0': '#6B7280',
  '#a0aec0': '#6B7280',

  // Chart specific colors
  '#8884d8': '#00E5FF',  // Generic blue → Electric Cyan
  '#82ca9d': '#00D9A3',  // Generic green → Teal Green
};

// Special replacements for CSS class names and variables
const classNameReplacements = {
  // Status classes
  'severity-critical': 'severity-critical',     // Keep name, just update colors
  'severity-major': 'severity-major',
  'severity-warning': 'severity-warning',
  'severity-success': 'severity-success',

  // Badge classes
  'badge-danger': 'badge-critical',
  'badge-warning': 'badge-major',
  'badge-success': 'badge-success',
};

// Import statement to add
const importStatement = `import { colors } from './theme/colors';`;

// Helper function replacements
const helperReplacements = {
  // Replace inline color logic with helper functions
  "severity === 'CRITICAL' ? '#f56565' : severity === 'MAJOR' ? '#ed8936' : '#48bb78'":
    "getSeverityColor(severity)",

  "mos >= 4.5 ? '#48bb78' : mos >= 4.0 ? '#10b981' : mos >= 3.5 ? '#ecc94b' : '#ed8936'":
    "getMOSColor(mos)",

  "df < 5 ? '#48bb78' : df < 15 ? '#10b981' : df < 30 ? '#ecc94b' : '#ed8936'":
    "getDFColor(df)",
};

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate a single file
 */
function migrateFile(filePath) {
  console.log(`\n🔄 Migrating: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let changeCount = 0;

  // Replace hex colors
  Object.entries(colorMappings).forEach(([oldColor, newColor]) => {
    const regex = new RegExp(oldColor.replace('#', '#'), 'g');
    const matches = (content.match(regex) || []).length;

    if (matches > 0) {
      content = content.replace(regex, newColor);
      changeCount += matches;
      console.log(`  ✓ Replaced ${matches}x: ${oldColor} → ${newColor}`);
    }
  });

  // Replace helper function calls
  Object.entries(helperReplacements).forEach(([oldCode, newCode]) => {
    if (content.includes(oldCode)) {
      content = content.replace(new RegExp(oldCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newCode);
      changeCount++;
      console.log(`  ✓ Replaced helper: ${oldCode.substring(0, 30)}... → ${newCode}`);
    }
  });

  // Add import statement if needed (for .jsx/.js files)
  if ((filePath.endsWith('.jsx') || filePath.endsWith('.js')) &&
      !content.includes("from './theme/colors'") &&
      changeCount > 0) {

    // Find the last import statement
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]);
      const insertPosition = content.indexOf('\n', lastImportIndex) + 1;
      content = content.slice(0, insertPosition) + importStatement + '\n' + content.slice(insertPosition);
      console.log(`  ✓ Added import statement for theme colors`);
    }
  }

  // Write back if changed
  if (content !== originalContent) {
    // Create backup
    const backupPath = filePath + '.backup';
    fs.writeFileSync(backupPath, originalContent);
    console.log(`  💾 Backup created: ${backupPath}`);

    // Write new content
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Migrated successfully! (${changeCount} changes)`);
    return true;
  } else {
    console.log(`  ℹ️  No changes needed`);
    return false;
  }
}

/**
 * Migrate all files in a directory
 */
function migrateDirectory(dirPath, extensions = ['.jsx', '.js', '.css']) {
  console.log(`\n📁 Scanning directory: ${dirPath}`);

  let totalFiles = 0;
  let migratedFiles = 0;

  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!file.startsWith('.') && file !== 'node_modules') {
          walkDir(filePath);
        }
      } else {
        const ext = path.extname(file);
        if (extensions.includes(ext)) {
          totalFiles++;
          if (migrateFile(filePath)) {
            migratedFiles++;
          }
        }
      }
    });
  }

  walkDir(dirPath);

  console.log(`\n✅ Migration complete!`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files migrated: ${migratedFiles}`);
  console.log(`   Files unchanged: ${totalFiles - migratedFiles}`);
}

/**
 * Generate migration report
 */
function generateReport(filePath) {
  console.log(`\n📊 Analyzing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const findings = {};

  Object.entries(colorMappings).forEach(([oldColor, newColor]) => {
    const regex = new RegExp(oldColor.replace('#', '#'), 'g');
    const matches = (content.match(regex) || []).length;

    if (matches > 0) {
      findings[oldColor] = { newColor, count: matches };
    }
  });

  if (Object.keys(findings).length > 0) {
    console.log('\n📋 Colors found that need migration:');
    console.log('─'.repeat(60));
    Object.entries(findings).forEach(([old, { newColor, count }]) => {
      console.log(`  ${old.padEnd(10)} → ${newColor.padEnd(10)} (${count} occurrences)`);
    });
    console.log('─'.repeat(60));
  } else {
    console.log('  ✓ No old colors found - file is up to date!');
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function printUsage() {
  console.log(`
📝 Color Migration Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  node migrate-colors.js <file-path>           Migrate single file
  node migrate-colors.js --all                  Migrate all files in src/
  node migrate-colors.js --dir <directory>      Migrate all files in directory
  node migrate-colors.js --report <file-path>   Generate migration report
  node migrate-colors.js --help                 Show this help

Examples:
  node migrate-colors.js src/App.jsx
  node migrate-colors.js --all
  node migrate-colors.js --dir src/components
  node migrate-colors.js --report src/App.jsx

Color Mappings:
  #ffc658  →  #00E5FF  (Yellow → Electric Cyan)
  #f56565  →  #FF3B3B  (Red → Vivid Red)
  #ed8936  →  #FF8C00  (Orange → Bright Orange)
  #48bb78  →  #00D9A3  (Green → Teal Green)
  #555555  →  #334455  (Gray → Blue-gray grid)

  ... and 20+ more mappings

⚠️  Backups:
  Original files are backed up as .backup before migration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  printUsage();
  process.exit(0);
}

const command = args[0];

switch (command) {
  case '--all':
    migrateDirectory('./src');
    break;

  case '--dir':
    if (args.length < 2) {
      console.error('❌ Please specify directory path');
      process.exit(1);
    }
    migrateDirectory(args[1]);
    break;

  case '--report':
    if (args.length < 2) {
      console.error('❌ Please specify file path');
      process.exit(1);
    }
    generateReport(args[1]);
    break;

  default:
    // Migrate single file
    migrateFile(command);
    break;
}
