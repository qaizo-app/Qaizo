#!/usr/bin/env node
// scripts/assign-tasks.js
// Generates daily task files for Alex and Sean based on sprint backlog
// Run: npm run assign-tasks

const fs = require('fs');
const path = require('path');

const TASKS_DIR = path.join(__dirname, '..', 'tasks');
const CLAUDE_MD = path.join(__dirname, '..', 'CLAUDE.md');
const HISTORY_FILE = path.join(TASKS_DIR, 'history.json');

// ─── Task Pool ──────────────────────────────────────────
// Each task has: id, title, developer (alex|sean), priority (1-4),
// estimatedHours, dependencies[], status (pending|in_progress|done|blocked)
const TASK_POOL = [
  // Priority 1 - Critical
  { id: 'eas-setup', title: 'Setup EAS Build configuration (eas.json, app.json updates)', dev: 'sean', priority: 1, hours: 3, deps: [], category: 'infrastructure' },
  { id: 'eas-android', title: 'Build Android APK/AAB via EAS', dev: 'sean', priority: 1, hours: 2, deps: ['eas-setup'], category: 'infrastructure' },
  { id: 'voice-input', title: 'Add speech-to-text to SmartInputModal (expo-speech-recognition)', dev: 'sean', priority: 1, hours: 4, deps: [], category: 'feature' },
  { id: 'voice-ui', title: 'Voice input button UI and recording animation in SmartInputModal', dev: 'alex', priority: 1, hours: 3, deps: ['voice-input'], category: 'ui' },
  { id: 'receipt-camera', title: 'Camera integration for receipt scanning (expo-camera)', dev: 'sean', priority: 1, hours: 4, deps: [], category: 'feature' },
  { id: 'receipt-ui', title: 'Receipt scanner screen UI with preview and parsed result card', dev: 'alex', priority: 1, hours: 4, deps: ['receipt-camera'], category: 'ui' },
  { id: 'receipt-vision', title: 'Gemini Vision API for receipt OCR (extract amount, date, VAT)', dev: 'sean', priority: 1, hours: 4, deps: ['receipt-camera'], category: 'feature' },
  { id: 'e2e-dashboard', title: 'E2E test: Dashboard screen on physical device - verify all cards render', dev: 'alex', priority: 1, hours: 2, deps: [], category: 'testing' },
  { id: 'e2e-transactions', title: 'E2E test: Add/edit/delete transaction flow on device', dev: 'alex', priority: 1, hours: 2, deps: [], category: 'testing' },
  { id: 'e2e-advisor', title: 'E2E test: AI Advisor screen loads insights and Gemini tips', dev: 'sean', priority: 1, hours: 2, deps: [], category: 'testing' },

  // Priority 2 - Important
  { id: 'chart-pie-interactive', title: 'Make pie chart interactive (tap to see category details)', dev: 'alex', priority: 2, hours: 3, deps: [], category: 'ui' },
  { id: 'chart-bar-labels', title: 'Improve bar chart with value labels and better scaling', dev: 'alex', priority: 2, hours: 2, deps: [], category: 'ui' },
  { id: 'tx-search', title: 'Add search bar and filters to TransactionsScreen', dev: 'alex', priority: 2, hours: 3, deps: [], category: 'feature' },
  { id: 'tx-search-service', title: 'Add search/filter logic to dataService (by text, category, date range)', dev: 'sean', priority: 2, hours: 2, deps: [], category: 'service' },
  { id: 'account-chart', title: 'Balance history chart on AccountHistoryScreen', dev: 'alex', priority: 2, hours: 3, deps: [], category: 'ui' },
  { id: 'recurring-auto', title: 'Auto-execute recurring payments when due date passes', dev: 'sean', priority: 2, hours: 3, deps: [], category: 'service' },
  { id: 'data-import', title: 'CSV/Excel import service (parse file, map columns, create transactions)', dev: 'sean', priority: 2, hours: 4, deps: [], category: 'service' },
  { id: 'data-import-ui', title: 'Import screen UI with file picker and column mapping', dev: 'alex', priority: 2, hours: 3, deps: ['data-import'], category: 'ui' },
  { id: 'investments-real', title: 'Real investment portfolio: add holdings, track value, show P&L', dev: 'sean', priority: 2, hours: 5, deps: [], category: 'feature' },
  { id: 'investments-ui', title: 'Investments screen redesign with portfolio cards and charts', dev: 'alex', priority: 2, hours: 4, deps: ['investments-real'], category: 'ui' },
  { id: 'report-pdf', title: 'Improve monthly report PDF layout and add charts', dev: 'alex', priority: 2, hours: 3, deps: [], category: 'ui' },
  { id: 'test-aiservice', title: 'Write tests for aiService (parseTransaction, taxCalc, insights)', dev: 'sean', priority: 2, hours: 3, deps: [], category: 'testing' },

  // Priority 3 - Nice to Have
  { id: 'biometric', title: 'Biometric auth (expo-local-authentication) on app launch', dev: 'sean', priority: 3, hours: 3, deps: [], category: 'feature' },
  { id: 'biometric-ui', title: 'Biometric prompt screen and settings toggle', dev: 'alex', priority: 3, hours: 2, deps: ['biometric'], category: 'ui' },
  { id: 'live-rates', title: 'Live exchange rates API integration (replace hardcoded rates)', dev: 'sean', priority: 3, hours: 2, deps: [], category: 'service' },
  { id: 'theme-polish', title: 'Theme animations, transitions, and light mode polish', dev: 'alex', priority: 3, hours: 3, deps: [], category: 'ui' },
  { id: 'onboarding-improve', title: 'Improve onboarding with animated illustrations', dev: 'alex', priority: 3, hours: 3, deps: [], category: 'ui' },
  { id: 'store-assets', title: 'Create App Store / Google Play screenshots and descriptions', dev: 'alex', priority: 3, hours: 4, deps: [], category: 'design' },
  { id: 'store-descriptions', title: 'Write store descriptions in EN/RU/HE', dev: 'alex', priority: 3, hours: 2, deps: [], category: 'design' },
];

// ─── Helpers ────────────────────────────────────────────
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return { completed: [], inProgress: [], assigned: {} };
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getDayOfWeek() {
  return new Date().getDay(); // 0=Sun, 6=Sat
}

// ─── Task Assignment Logic ──────────────────────────────
function assignTasks() {
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });

  const history = loadHistory();
  const today = getToday();
  const dayOfWeek = getDayOfWeek();

  // Weekend (Israel: Friday + Saturday)
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    console.log('Weekend - no tasks assigned. Rest up!');
    generateFile('alex', today, [], history);
    generateFile('sean', today, [], history);
    return;
  }

  // Target hours per day per developer
  const TARGET_HOURS = 6;

  // Get available tasks (not done, not blocked by unfinished deps)
  const available = TASK_POOL.filter(t => {
    if (history.completed.includes(t.id)) return false;
    if (history.inProgress.includes(t.id)) return true; // continue in-progress
    // Check deps
    const depsOk = t.deps.every(d => history.completed.includes(d));
    return depsOk;
  });

  const alexTasks = [];
  const seanTasks = [];
  let alexHours = 0;
  let seanHours = 0;

  // First: add in-progress tasks (carry over)
  available.filter(t => history.inProgress.includes(t.id)).forEach(t => {
    if (t.dev === 'alex' && alexHours < TARGET_HOURS) {
      alexTasks.push({ ...t, continued: true });
      alexHours += Math.ceil(t.hours / 2); // assume half done
    } else if (t.dev === 'sean' && seanHours < TARGET_HOURS) {
      seanTasks.push({ ...t, continued: true });
      seanHours += Math.ceil(t.hours / 2);
    }
  });

  // Then: assign new tasks by priority
  available
    .filter(t => !history.inProgress.includes(t.id))
    .sort((a, b) => a.priority - b.priority || a.hours - b.hours)
    .forEach(t => {
      if (t.dev === 'alex' && alexHours + t.hours <= TARGET_HOURS + 1) {
        alexTasks.push(t);
        alexHours += t.hours;
      } else if (t.dev === 'sean' && seanHours + t.hours <= TARGET_HOURS + 1) {
        seanTasks.push(t);
        seanHours += t.hours;
      }
    });

  // Track assigned
  const allAssigned = [...alexTasks, ...seanTasks].map(t => t.id);
  history.assigned[today] = allAssigned;
  history.inProgress = [...new Set([...history.inProgress, ...allAssigned])];
  saveHistory(history);

  // Generate files
  generateFile('alex', today, alexTasks, history);
  generateFile('sean', today, seanTasks, history);

  console.log(`\n Tasks assigned for ${today}:`);
  console.log(`  Alex: ${alexTasks.length} tasks (~${alexHours}h)`);
  console.log(`  Sean: ${seanTasks.length} tasks (~${seanHours}h)`);
  console.log(`\n Files created:`);
  console.log(`  tasks/alex-${today}.md`);
  console.log(`  tasks/sean-${today}.md`);
}

function generateFile(dev, date, tasks, history) {
  const completedCount = history.completed.filter(id =>
    TASK_POOL.find(t => t.id === id && t.dev === dev)
  ).length;
  const totalCount = TASK_POOL.filter(t => t.dev === dev).length;

  let md = `# ${dev.charAt(0).toUpperCase() + dev.slice(1)} - Daily Tasks\n`;
  md += `**Date:** ${date}\n`;
  md += `**Progress:** ${completedCount}/${totalCount} total tasks completed\n\n`;

  if (tasks.length === 0) {
    md += `## No tasks for today\n\n`;
    md += `All caught up! Take this time to:\n`;
    md += `- Review open PRs\n`;
    md += `- Refactor or optimize existing code\n`;
    md += `- Update documentation\n`;
    md += `- Help the other developer with their tasks\n`;
  } else {
    md += `## Today's Tasks\n\n`;
    md += `| # | Task | Priority | Est. Hours | Status |\n`;
    md += `|---|------|----------|------------|--------|\n`;
    tasks.forEach((t, idx) => {
      const status = t.continued ? 'CONTINUE' : 'NEW';
      const pLabel = ['', 'CRITICAL', 'IMPORTANT', 'NICE-TO-HAVE', 'FUTURE'][t.priority];
      md += `| ${idx + 1} | ${t.title} | ${pLabel} | ${t.hours}h | ${status} |\n`;
    });

    md += `\n## Details\n\n`;
    tasks.forEach((t, idx) => {
      md += `### ${idx + 1}. ${t.title}\n`;
      md += `- **ID:** \`${t.id}\`\n`;
      md += `- **Category:** ${t.category}\n`;
      md += `- **Priority:** P${t.priority}\n`;
      md += `- **Estimated:** ${t.hours} hours\n`;
      if (t.deps.length > 0) md += `- **Depends on:** ${t.deps.join(', ')}\n`;
      if (t.continued) md += `- **Status:** Continued from previous day\n`;
      md += `- [ ] Completed\n\n`;
    });
  }

  md += `---\n`;
  md += `*Generated by assign-tasks. After completing tasks, run: \`npm run check-tasks\`*\n`;

  const filePath = path.join(TASKS_DIR, `${dev}-${date}.md`);
  fs.writeFileSync(filePath, md);
}

// ─── Run ────────────────────────────────────────────────
assignTasks();
