#!/usr/bin/env node

/**
 * tracker-stats.mjs — Application Tracker Dashboard
 * 
 * Shows application statistics and status overview.
 * Usage: node tracker-stats.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const APPLICATIONS_FILE = resolve('./data/applications.md');
const OUTPUT_DIR = resolve('./output');

function parseTracker() {
  if (!existsSync(APPLICATIONS_FILE)) {
    console.log('❌ No applications.md found');
    return null;
  }
  
  const content = readFileSync(APPLICATIONS_FILE, 'utf8');
  const lines = content.split('\n');
  
  const stats = {
    total: 0,
    byStatus: {},
    byScore: [],
    withPdf: 0,
    withReport: 0,
    applications: []
  };
  
  // Parse table rows - look for lines starting with | and containing company info
  for (const line of lines) {
    // Skip header and separator lines
    if (!line.startsWith('|') || line.includes('---') || line.includes(' # ')) continue;
    
    // Split by | and clean up
    const parts = line.split('|').slice(1, -1).map(p => p.trim());
    
    if (parts.length < 5) continue;
    
    const num = parts[0];
    const date = parts[1] || '';
    const company = parts[2] || '';
    const role = parts[3] || '';
    const score = parts[4] || '';
    const status = parts[5] || '';
    const pdf = parts[6] || '';
    
    if (num && company && !num.includes('#')) {
      stats.total++;
      stats.applications.push({ num, date, company, role, score, status, pdf });
      
      // Extract clean status (remove emojis)
      const cleanStatus = status.replace(/[✅🎯🏆❌⚠️⏳🟡📬📲🎉🗑️]/g, '').trim() || 'Unknown';
      stats.byStatus[cleanStatus] = (stats.byStatus[cleanStatus] || 0) + 1;
      
      // Score tracking
      const scoreNum = parseFloat(score?.split('/')[0] || '0');
      if (scoreNum > 0) stats.byScore.push(scoreNum);
      
      // PDF tracking
      if (pdf.includes('.pdf') || pdf.includes('✅')) stats.withPdf++;
    }
  }
  
  return stats;
}

function displayDashboard(stats) {
  if (!stats) return;
  
  console.log('\n📊 === APPLICATION TRACKER DASHBOARD ===\n');
  
  console.log(`📈 Total Applications: ${stats.total}\n`);
  
  // Status breakdown
  console.log('📌 STATUS BREAKDOWN:');
  const statusEmoji = {
    'Aplicar': '🎯',
    'Enviada': '✅',
    'Respondido': '📬',
    'Contacto': '📲',
    'Entrevista': '🎤',
    'Oferta': '🎉',
    'Rechazada': '❌',
    'Descartada': '🗑️',
    'TOP PRIORIDAD': '🏆'
  };
  
  for (const [status, count] of Object.entries(stats.byStatus)) {
    const emoji = statusEmoji[status] || '•';
    console.log(`   ${emoji} ${status}: ${count}`);
  }
  console.log('');
  
  // Score average
  if (stats.byScore.length > 0) {
    const avg = stats.byScore.reduce((a, b) => a + b, 0) / stats.byScore.length;
    console.log(`📊 Average Score: ${avg.toFixed(1)}/5`);
  }
  
  // PDF/Report coverage
  console.log(`📄 PDFs Generated: ${stats.withPdf}/${stats.total} (${Math.round(stats.withPdf/stats.total*100)}%)`);
  console.log('');
  
  // Recent applications
  console.log('🎯 TOP PRIORITY (Score 4.0+):');
  const highPriority = stats.applications
    .filter(a => parseFloat(a.score?.split('/')[0] || '0') >= 4.0)
    .slice(0, 5);
  
  for (const app of highPriority) {
    const statusEmoji = app.status.includes('✅') ? '✅' : '🎯';
    console.log(`   ${statusEmoji} #${app.num} ${app.company} — ${app.role} (${app.score})`);
  }
  console.log('');
  
  // Ready to apply
  console.log('📤 READY TO APPLY:');
  const ready = stats.applications.filter(a => a.status === '🎯 Aplicar');
  for (const app of ready.slice(0, 5)) {
    console.log(`   #${app.num} ${app.company} — ${app.role}`);
  }
  
  console.log('\n' + '='.repeat(40) + '\n');
}

function listRecent(limit = 10) {
  const stats = parseTracker();
  if (!stats) return;
  
  console.log(`\n📋 LAST ${limit} APPLICATIONS:\n`);
  for (const app of stats.applications.slice(-limit).reverse()) {
    const score = app.score || 'N/A';
    const status = app.status.replace(/✅|🎯|🏆/g, '').trim();
    console.log(`#${app.num} | ${app.company} | ${app.role} | ${score} | ${status}`);
  }
}

const command = process.argv[2];

if (command === 'list' || command === 'recent') {
  listRecent(parseInt(process.argv[3]) || 10);
} else if (command === 'stats') {
  displayDashboard(parseTracker());
} else {
  displayDashboard(parseTracker());
}