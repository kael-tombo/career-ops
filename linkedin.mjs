#!/usr/bin/env node

/**
 * linkedin.mjs — LinkedIn Outreach Automation
 * 
 * Automates LinkedIn connection requests and follow-up messages
 * based on the contacto mode framework.
 * 
 * Usage:
 *   node linkedin.mjs list          # Show available targets from pipeline
 *   node linkedin.mjs send <num>    # Send connection requests to first N targets
 *   node linkedin.mjs followup      # Send follow-up messages to connected contacts
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

const LINKEDIN_URL = 'https://www.linkedin.com';
const LOGIN_URL = `${LINKEDIN_URL}/login`;
const SEARCH_URL = `${LINKEDIN_URL}/search/results/people/`;

const STATE_FILE = resolve('./data/linkedin_state.json');
const REPORTS_DIR = resolve('./reports');
const OUTPUT_DIR = resolve('./output');

class LinkedInAutomation {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    if (existsSync(STATE_FILE)) {
      try {
        return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      } catch (e) {
        console.log('⚠️  Could not load LinkedIn state, starting fresh');
      }
    }
    return {
      sentRequests: [],
      connected: [],
      messagesSent: [],
      lastRun: null
    };
  }

  saveState() {
    this.state.lastRun = new Date().toISOString();
    writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
  }

async login(page) {
    console.log('🔐 Checking LinkedIn session...');
    await page.goto(LINKEDIN_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
        console.log('\n⚠️  Not logged in');
        console.log('Please log in manually in the browser window.');
        console.log('The script will automatically detect when you log in and continue.\n');
        
        for (let i = 0; i < 60; i++) {
            await page.waitForTimeout(2000);
            const newUrl = page.url();
            if (!newUrl.includes('/login') && 
                (newUrl.includes('/feed/') || newUrl.includes('/in/') || 
                 newUrl.includes('/messaging'))) {
                console.log('✅ Login detected! Continuing...');
                break;
            }
            if (i % 5 === 4) console.log(`   Waiting for login... (${(i+1)*2}s)`);
        }
    } else {
        console.log('✅ Already logged in');
    }
    
    await page.waitForTimeout(2000);
    return true;
}

  async searchPeople(page, keyword, company = '') {
    console.log(`🔍 Searching for: ${keyword}${company ? ' at ' + company : ''}`);

    let searchUrl = `${SEARCH_URL}?keywords=${encodeURIComponent(keyword)}`;
    if (company) {
      searchUrl += `&company=${encodeURIComponent(company)}`;
    }

    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Extract results
    const results = await page.evaluate(() => {
      const people = [];
      const cards = document.querySelectorAll('.reusable-search__result-container, .entity-result__item');

      cards.forEach(card => {
        const nameEl = card.querySelector('.entity-result__title-text a, .app-aware-link');
        const titleEl = card.querySelector('.entity-result__primary-subtitle, .entity-result__secondary-subtitle');
        const linkEl = card.querySelector('.entity-result__title-text a, .app-aware-link');

        if (nameEl && linkEl) {
          people.push({
            name: nameEl.textContent.trim(),
            title: titleEl ? titleEl.textContent.trim() : '',
            url: linkEl.href.split('?')[0], // Remove query params
            headline: titleEl ? titleEl.textContent.trim() : ''
          });
        }
      });

      return people.slice(0, 10); // Limit to top 10
    });

    return results;
  }

  async sendConnectionRequest(page, profileUrl, note = '') {
    console.log(`📤 Sending connection request to ${profileUrl}`);

    await page.goto(profileUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Look for Connect button
    const connectButton = await page.$('button:has-text("Connect"), button[aria-label*="Invite"]');

    if (!connectButton) {
      console.log('❌ Connect button not found');
      return false;
    }

    await connectButton.click();
    await page.waitForTimeout(1000);

    // If a note/modal appears
    const addNoteButton = await page.$('button:has-text("Add a note")');
    if (addNoteButton) {
      await addNoteButton.click();
      await page.waitForTimeout(500);

      const textarea = await page.$('textarea[name="message"]');
      if (textarea) {
        await textarea.fill(note);
        await page.waitForTimeout(500);
      }
    }

    // Send request
    const sendButton = await page.$('button:has-text("Send"), button[aria-label*="Send invitation"]');
    if (sendButton) {
      await sendButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Connection request sent');
      return true;
    }

    return false;
  }

async processTarget(page, company, role, reportNum) {
    console.log(`\n🎯 Processing: ${role} at ${company}`);
    
    // Generate personalized message based on role/company
    const message = this.generateMessage(company, role);
    console.log(`   📝 Message: "${message}"`);
    
    // Strategy 1: Search for people
    console.log(`   🔍 Searching LinkedIn for ${role} at ${company}...`);
    const searchUrl = `${LINKEDIN_URL}/search/results/people/?keywords=${encodeURIComponent(role + ' ' + company)}&origin=SWITCH_SEARCH_V2`;
    
    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
    } catch (e) {
        console.log(`   ⚠️  Search navigation failed: ${e.message.substring(0, 60)}`);
        console.log(`   🔄 Trying direct profile approach instead...`);
        // Strategy 2: Go to company LinkedIn page and look for people
        const companyUrl = `${LINKEDIN_URL}/company/${company.toLowerCase()}/people/`;
        try {
            await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(3000);
        } catch (e2) {
            console.log(`   ⚠️  Company page also failed. Skipping ${company} for now.`);
            return { company, role, success: false, reason: 'navigation_failed' };
        }
    }
    
    // Try to extract profiles and send connection requests
    try {
        const results = await page.evaluate(() => {
            const people = [];
            const cards = document.querySelectorAll('.reusable-search__result-container, .entity-result__item');
            cards.forEach(card => {
                const link = card.querySelector('a.app-aware-link');
                const nameEl = card.querySelector('.entity-result__title-text a');
                const titleEl = card.querySelector('.entity-result__primary-subtitle');
                if (link && nameEl) {
                    people.push({
                        name: nameEl.textContent.trim(),
                        title: titleEl ? titleEl.textContent.trim() : '',
                        url: link.href.split('?')[0],
                    });
                }
            });
            return people.slice(0, 5);
        });

        if (results.length === 0) {
            console.log(`   ℹ️  No search results found for ${role} at ${company}`);
            return { company, role, success: false, reason: 'no_results' };
        }

        console.log(`   👥 Found ${results.length} potential connections`);
        let sent = 0;
        for (const person of results) {
            if (sent >= 2) break; // Max 2 connections per target
            try {
                console.log(`   👤 ${person.name} — ${person.title}`);
                await page.goto(person.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForTimeout(2000);
                
                const connected = await this.tryConnect(page, message);
                if (connected) {
                    console.log(`      ✅ Connection sent`);
                    this.state.sentRequests.push({
                        company, role, name: person.name,
                        profile: person.url, date: new Date().toISOString()
                    });
                    sent++;
                    await page.waitForTimeout(3000 + Math.random() * 2000); // Rate limiting
                } else {
                    console.log(`      ℹ️  Could not connect (already connected / no button)`);
                }
            } catch (e) {
                console.log(`      ⚠️  Error with ${person.name}: ${e.message.substring(0, 60)}`);
            }
        }
        return { company, role, success: sent > 0, connectionsSent: sent };
    } catch (e) {
        console.log(`   ⚠️  Could not auto-connect: ${e.message.substring(0, 80)}`);
        return { company, role, success: false };
    }
}
  
  generateMessage(company, role) {
    // 3-sentence framework from contacto mode
    const hooks = {
      'Binance': 'Your trading infrastructure at scale is impressive',
      'EverAI': 'The work on conversational AI at 80M+ tokens daily is fascinating',
      'Match Group': 'Building systems that connect millions of people is meaningful',
      'Starbridge': 'Helping companies sell into the $1.5T public sector is impactful',
      'Secfix': 'Automating security compliance for SMBs is a great mission',
      'default': `Your work in ${role} caught my attention`
    };
    
    const hook = hooks[company] || hooks['default'];
    const proof = 'I built production systems at Ambatovy (nickel mine operations) handling critical infrastructure';
    const ask = "Would love to connect and share some insights from my experience";
    
    // Keep under 300 chars for LinkedIn
    const full = `${hook}. ${proof}. ${ask}`;
    return full.length > 280 ? `${hook}. ${proof.substring(0, 80)}... ${ask}` : full;
  }
  
  async tryConnect(page, message) {
    // Look for Connect button on profile page
    await page.waitForTimeout(1500);
    
    try {
      // Try various selectors for Connect button
      const connectBtn = await page.locator('button:has-text("Connect"), button[aria-label*="Connect"]').first();
      
      if (await connectBtn.isVisible({ timeout: 3000 })) {
        await connectBtn.click();
        await page.waitForTimeout(1000);
        
        // Add note option
        const addNote = await page.locator('button:has-text("Add a note")').first();
        if (await addNote.isVisible({ timeout: 2000 })) {
          await addNote.click();
          await page.waitForTimeout(500);
          
          const textarea = await page.locator('textarea[name="message"]');
          await textarea.fill(message);
          await page.waitForTimeout(300);
        }
        
        // Send
        const sendBtn = await page.locator('button:has-text("Send"), button[aria-label*="Send"]').first();
        if (await sendBtn.isVisible({ timeout: 2000 })) {
          await sendBtn.click();
          await page.waitForTimeout(1500);
          return true;
        }
      }
    } catch (e) {
      // Already connected or other issue
      console.log(`   Could not send: ${e.message}`);
    }
    return false;
  }
}

async function main() {
  const li = new LinkedInAutomation();

  const command = process.argv[2];
  const arg = parseInt(process.argv[3]) || 1;

  if (command === 'list') {
    console.log('📋 Available targets from recent pipeline:');
    console.log('Run: node linkedin.mjs send 5  # to send 5 connection requests');
    return;
  }

  if (command === 'send') {
    console.log(`🚀 Starting LinkedIn outreach - sending ${arg} connection requests`);

    const browser = await chromium.launch({
      headless: false,
      args: ['--start-maximized']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await li.login(page);

      // Process some top pipeline targets
      const targets = [
        { company: 'Binance', role: 'Senior Backend Architect', report: '022' },
        { company: 'EverAI', role: 'Tech Lead LLM & GenAI', report: '026' },
        { company: 'Match Group', role: 'Senior Software Engineer', report: '023' },
        { company: 'Starbridge', role: 'Senior Backend SWE', report: '024' },
        { company: 'Secfix', role: 'Senior Product Engineer', report: '025' }
      ];

      for (let i = 0; i < Math.min(arg, targets.length); i++) {
        const target = targets[i];
        await li.processTarget(page, target.company, target.role, target.report);
        // In real implementation: await li.sendConnectionRequest(...)
        await page.waitForTimeout(3000); // Rate limiting
      }

    } finally {
      // Keep browser open for user to see results
      console.log('\n💡 Browser kept open for you to review results');
      console.log('   Close it manually when done');
      li.saveState();
    }
  }

  if (command === 'help' || !command) {
    console.log(`
🔗 LinkedIn Outreach Automation

Usage:
  node linkedin.mjs list     # Show available targets
  node linkedin.mjs send N   # Send N connection requests
  node linkedin.mjs followup # Send follow-up messages

This automates the "contacto" mode workflow:
1. Search LinkedIn for hiring managers/recruiters/peers
2. Select optimal target
3. Generate personalized 3-sentence message
4. Send connection request with note
`);
  }
}

main().catch(console.error);