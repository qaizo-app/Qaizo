#!/usr/bin/env node
// scripts/check-tasks.js
// Checks git log for completed tasks and updates history
// Run: npm run check-tasks

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TASKS_DIR = path.join(__dirname, '..', 'tasks');
const HISTORY_FILE = path.join(TASKS_DIR, 'history.json');

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

function checkTasks() {
  const history = loadHistory();
  const today = getToday();

  // Get today's task files
  const devs = ['alex', 'sean'];
  let newlyCompleted = [];

  devs.forEach(dev => {
    const taskFile = path.join(TASKS_DIR, `${dev}-${today}.md`);
    if (!fs.existsSync(taskFile)) return;

    let content = fs.readFileSync(taskFile, 'utf8');
    let changed = false;

    // Check for manually marked completed tasks: [x]
    const lines = content.split('\n');
    lines.forEach(line => {
      const match = line.match(/- \[x\] Completed/i);
      if (match) {
        // Find the task ID from the section above
        const idMatch = content.substring(0, content.indexOf(line)).match(/\*\*ID:\*\* `([^`]+)`[^]*$/);
        if (idMatch) {
          const taskId = idMatch[1];
          if (!history.completed.includes(taskId)) {
            history.completed.push(taskId);
            history.inProgress = history.inProgress.filter(id => id !== taskId);
            newlyCompleted.push(taskId);
          }
        }
      }
    });
  });

  // Also check git log for today's commits - try to match task IDs in commit messages
  try {
    const log = execSync(`git log --since="${today}" --oneline`, { encoding: 'utf8' });
    const commitLines = log.split('\n').filter(Boolean);

    // Look for task IDs mentioned in commits
    history.inProgress.forEach(taskId => {
      const idLower = taskId.toLowerCase().replace(/-/g, '[ -]?');
      const regex = new RegExp(idLower, 'i');
      if (commitLines.some(line => regex.test(line))) {
        if (!history.completed.includes(taskId)) {
          history.completed.push(taskId);
          history.inProgress = history.inProgress.filter(id => id !== taskId);
          newlyCompleted.push(taskId);
        }
      }
    });
  } catch (e) {
    // git log might fail, that's ok
  }

  saveHistory(history);

  // Report
  console.log(`\n Task Check - ${today}`);
  console.log(`─────────────────────────────`);
  if (newlyCompleted.length > 0) {
    console.log(` Newly completed:`);
    newlyCompleted.forEach(id => console.log(`   ${id}`));
  } else {
    console.log(` No new completions detected.`);
    console.log(` To mark tasks done, edit the task file and change [ ] to [x]`);
  }
  console.log(`\n Total completed: ${history.completed.length}`);
  console.log(` Still in progress: ${history.inProgress.length}`);
  console.log('');
}

checkTasks();
