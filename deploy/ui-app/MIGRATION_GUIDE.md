# Color Migration Guide

## 🎯 Overview

Automated script để migrate từ old color palette sang **Professional Color Palette** mới.

---

## 🚀 Quick Start

### Option 1: Migrate Single File

```bash
cd deploy/ui-app
node migrate-colors.js ../../3_react_dashboard.jsx
```

### Option 2: Migrate All Files

```bash
cd deploy/ui-app
node migrate-colors.js --all
```

### Option 3: Migrate Specific Directory

```bash
cd deploy/ui-app
node migrate-colors.js --dir src/components
```

### Option 4: Generate Report (Dry Run)

```bash
cd deploy/ui-app
node migrate-colors.js --report ../../3_react_dashboard.jsx
```

---

## 📊 What Does It Do?

### Automatic Color Replacements

| Old Color | New Color | Description |
|-----------|-----------|-------------|
| `#ffc658` | `#00E5FF` | Yellow → Electric Cyan (bitrate) |
| `#f56565` | `#FF3B3B` | Red → Vivid Red (critical) |
| `#ed8936` | `#FF8C00` | Orange → Bright Orange (major) |
| `#48bb78` | `#00D9A3` | Green → Teal Green (success) |
| `#555555` | `#334455` | Gray → Blue-gray (grid lines) |
| `#ecc94b` | `#FFB800` | Yellow → Amber (warning) |
| `#4299e1` | `#00E5FF` | Blue → Electric Cyan (accent) |
| `#cbd5e0` | `#6B7280` | Light gray → Cool gray (no data) |

**Total:** 25+ color mappings

### Smart Replacements

1. **Hex Color Codes**
   ```javascript
   // Before
   stroke: '#ffc658'

   // After
   stroke: '#00E5FF'
   ```

2. **Helper Functions** (coming soon)
   ```javascript
   // Before
   severity === 'CRITICAL' ? '#f56565' : '#48bb78'

   // After
   import { getSeverityColor } from './theme/colors';
   getSeverityColor(severity)
   ```

3. **Auto-Import**
   ```javascript
   // Automatically adds
   import { colors } from './theme/colors';
   ```

---

## 📋 Step-by-Step Migration

### Step 1: Backup Your Files

```bash
# Script automatically creates .backup files
# But you can also manually backup
cp 3_react_dashboard.jsx 3_react_dashboard.jsx.manual-backup
```

### Step 2: Generate Report

```bash
cd deploy/ui-app
node migrate-colors.js --report ../../3_react_dashboard.jsx
```

**Output:**
```
📊 Analyzing: ../../3_react_dashboard.jsx

📋 Colors found that need migration:
────────────────────────────────────────────────────────────
  #ffc658    → #00E5FF    (15 occurrences)
  #f56565    → #FF3B3B    (8 occurrences)
  #48bb78    → #00D9A3    (12 occurrences)
  #555       → #334455    (3 occurrences)
────────────────────────────────────────────────────────────
```

### Step 3: Run Migration

```bash
node migrate-colors.js ../../3_react_dashboard.jsx
```

**Output:**
```
🔄 Migrating: ../../3_react_dashboard.jsx
  ✓ Replaced 15x: #ffc658 → #00E5FF
  ✓ Replaced 8x: #f56565 → #FF3B3B
  ✓ Replaced 12x: #48bb78 → #00D9A3
  ✓ Replaced 3x: #555 → #334455
  ✓ Added import statement for theme colors
  💾 Backup created: ../../3_react_dashboard.jsx.backup
  ✅ Migrated successfully! (38 changes)
```

### Step 4: Review Changes

```bash
# Compare with backup
diff 3_react_dashboard.jsx 3_react_dashboard.jsx.backup
```

### Step 5: Test

```bash
# Start dev server
npm start

# Check UI in browser
# Verify charts show Electric Cyan (#00E5FF)
# Verify status badges show new colors
```

### Step 6: Commit

```bash
git add 3_react_dashboard.jsx
git commit -m "Migrate to professional color palette"
```

---

## 🎨 Example Migrations

### Example 1: Bitrate Chart

**Before:**
```jsx
<Line
  type="monotone"
  dataKey="bitrate"
  stroke="#ffc658"  // Old yellow
  strokeWidth={2}
/>
```

**After:**
```jsx
<Line
  type="monotone"
  dataKey="bitrate"
  stroke="#00E5FF"  // Electric Cyan!
  strokeWidth={2}
/>
```

### Example 2: Grid Lines

**Before:**
```jsx
<CartesianGrid
  strokeDasharray="3 3"
  stroke="#555"  // Old gray
/>
```

**After:**
```jsx
<CartesianGrid
  strokeDasharray="3 3"
  stroke="#334455"  // Blue-gray
/>
```

### Example 3: Status Badge

**Before:**
```jsx
<span style={{
  color: severity === 'CRITICAL' ? '#f56565' : '#48bb78'
}}>
  {severity}
</span>
```

**After (Manual - Recommended):**
```jsx
import { getSeverityColor } from './theme/colors';

<span style={{ color: getSeverityColor(severity) }}>
  {severity}
</span>
```

---

## 📁 Files to Migrate

### Priority 1: UI Components
- [ ] `3_react_dashboard.jsx` - Main dashboard
- [ ] `deploy/ui-app/src/App.jsx` - New App component
- [ ] `4_dashboard_styles.css` - CSS styles

### Priority 2: Chart Components
- [ ] `deploy/ui-app/src/components/ChartComponents.jsx` - Already updated!
- [ ] `deploy/ui-app/src/components/ChartComponents.css` - Already updated!

### Priority 3: Other Components
- [ ] Any custom components with hardcoded colors
- [ ] Test files
- [ ] Storybook stories (if any)

---

## 🔍 Manual Steps After Migration

### 1. Update Component Imports

Add at top of file:
```javascript
import { colors, getMOSColor, getDFColor, getSeverityColor } from './theme/colors';
```

### 2. Replace Inline Logic with Helpers

**Before:**
```javascript
const color = mos >= 4.5 ? '#48bb78' : mos >= 4.0 ? '#10b981' : '#ecc94b';
```

**After:**
```javascript
const color = getMOSColor(mos);
```

### 3. Use Theme Constants

**Before:**
```javascript
background: '#1a1f2e'
```

**After:**
```javascript
background: colors.ui.bgSecondary
```

### 4. Add Glow Effects

**Before:**
```css
.chart-container {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

**After:**
```css
.chart-container:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4),
              0 0 30px rgba(0, 229, 255, 0.2);
}
```

---

## ⚠️ Important Notes

### Backups

- Script automatically creates `.backup` files
- Original files are preserved
- You can restore with: `mv file.backup file`

### No Changes Needed For

These colors are **already correct**:
- Background: `#0F1419`, `#1A1F2E`, `#2D3748`
- Borders: `#4A5568`
- Text: `#E0E6ED`, `#A0AEC0`, `#718096`

### Manual Review Required

After migration, manually review:
1. Status badges - consider using `getSeverityColor()`
2. MOS displays - consider using `getMOSColor()`
3. TR 101 290 - consider using `getTR101290Color()`
4. Chart components - consider using pre-built components

---

## 🧪 Testing Checklist

After migration:

- [ ] Bitrate chart shows Electric Cyan (#00E5FF) line
- [ ] Grid lines are blue-gray (#334455)
- [ ] CRITICAL alerts are Vivid Red (#FF3B3B)
- [ ] MAJOR alerts are Bright Orange (#FF8C00)
- [ ] SUCCESS badges are Teal Green (#00D9A3)
- [ ] Charts have gradient fills
- [ ] Hover effects show glow
- [ ] No console errors
- [ ] Mobile responsive works
- [ ] Print preview looks good

---

## 🔄 Rollback

If something goes wrong:

### Option 1: Use Backup
```bash
mv 3_react_dashboard.jsx.backup 3_react_dashboard.jsx
```

### Option 2: Git Reset
```bash
git checkout -- 3_react_dashboard.jsx
```

### Option 3: Manual Revert
Edit file and change colors back manually.

---

## 📊 Migration Statistics

Expected results for `3_react_dashboard.jsx`:

| Metric | Value |
|--------|-------|
| Total colors found | ~40-50 |
| Colors to replace | ~30-40 |
| No change needed | ~10 |
| Import statements added | 1 |
| Backup files created | 1 |

---

## 🆘 Troubleshooting

### Issue 1: "Module not found"

**Problem:**
```
Error: Cannot find module 'fs'
```

**Solution:**
```bash
# Run with node (not in browser)
node migrate-colors.js file.jsx
```

### Issue 2: Permission Denied

**Problem:**
```
Error: EACCES: permission denied
```

**Solution:**
```bash
chmod +x migrate-colors.js
./migrate-colors.js file.jsx
```

### Issue 3: No Changes Detected

**Problem:**
```
ℹ️  No changes needed
```

**Solution:**
- File may already be migrated
- Run `--report` to see current colors
- Colors might be in different format (rgba, hsl)

### Issue 4: Import Not Added

**Problem:**
Import statement not automatically added

**Solution:**
Manually add at top of file:
```javascript
import { colors } from './theme/colors';
```

---

## 📚 Advanced Usage

### Custom Color Mappings

Edit `migrate-colors.js` to add custom mappings:

```javascript
const colorMappings = {
  '#yourOldColor': '#yourNewColor',
  // ... existing mappings
};
```

### Batch Migration

```bash
# Migrate multiple files
for file in src/components/*.jsx; do
  node migrate-colors.js "$file"
done
```

### CI/CD Integration

```bash
# Add to package.json
{
  "scripts": {
    "migrate-colors": "node migrate-colors.js --all",
    "check-colors": "node migrate-colors.js --report src/App.jsx"
  }
}
```

---

## ✅ Success Criteria

Migration is successful when:

1. ✅ All old colors replaced with new palette
2. ✅ Backup files created
3. ✅ No console errors
4. ✅ Charts display correctly
5. ✅ Status colors are vivid and saturated
6. ✅ Grid lines are blue-gray
7. ✅ WCAG contrast ratios maintained
8. ✅ Mobile responsive works

---

## 📞 Support

Issues? Check:
- `COLOR_PALETTE_GUIDE.md` - Complete color reference
- `INTEGRATION_EXAMPLE.md` - Manual migration examples
- `UI_OPTIMIZATION_GUIDE.md` - UI best practices

---

**Happy Migrating! 🎨**
