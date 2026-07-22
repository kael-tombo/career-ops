#!/usr/bin/env node

import fs from 'fs';
import { resolve, join, basename } from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const REPORTS_DIR = join(ROOT, 'reports');
const TEMPLATES_DIR = join(ROOT, 'templates');
const OUTPUT_DIR = join(ROOT, 'output');

function parseReport(id) {
    const files = fs.readdirSync(REPORTS_DIR);
    const reportFile = files.find(f => f.startsWith(id));
    if (!reportFile) throw new Error(`Report for ID ${id} not found.`);

    const content = fs.readFileSync(join(REPORTS_DIR, reportFile), 'utf-8');
    
    const summaryMatch = content.match(/## E\) Plan de Personalización \(Tailoring\)\s+- \*\*Summary\*\*: "(.+?)"/);
    const keywordMatch = content.match(/- \*\*Keywords\*\*: (.+)/);
    const companyMatch = content.match(/# Evaluación: (.+?) —/);

    return {
        id,
        summary: summaryMatch ? summaryMatch[1] : '',
        keywords: keywordMatch ? keywordMatch[1] : '',
        company: companyMatch ? companyMatch[1].trim() : 'Company'
    };
}

function getBaseData() {
    return {
        INITIALS: 'AR',
        LOCATION: 'Toamasina, Madagascar',
        DATE: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }
}

async function generatePDF(htmlPath, pdfPath) {
    console.log(`🖨️  Converting to PDF: ${basename(pdfPath)}...`);
    execSync(`node generate-pdf.mjs "${htmlPath}" "${pdfPath}"`, { stdio: 'inherit' });
}

async function main() {
    const id = process.argv[2];
    if (!id) {
        console.error('Usage: node tailor-assets.mjs <id>');
        process.exit(1);
    }

    try {
        console.log(`🧵 Tailoring Elite Assets Suite for [${id}]...`);
        const metadata = parseReport(id);
        const base = getBaseData();
        
        // --- 1. CV Tailoring ---
        let cvHtml = fs.readFileSync(join(TEMPLATES_DIR, 'cv-elite.html'), 'utf-8');
        const cvReplacements = {
            ...base,
            HEADLINE: `Senior Full-Stack Java Engineer — ${metadata.company} Focused`,
            SUMMARY_TEXT: metadata.summary,
            SKILL_TAGS: metadata.keywords.split(',').map(k => `<span class="tag">${k.trim()}</span>`).join(''),
            EXPERIENCE: `<div class="job"><div class="job-header"><span class="job-company">Ambatovy</span><span class="job-period">2022-Pres.</span></div><div class="job-role">Full-Stack Java</div><ul class="job-list"><li>Migrated IMS to <span class="metric">Spring Boot 3</span>.</li></ul></div>`,
            PROJECTS: `<div class="project-title">JNoSQL-EMBED</div>`,
            EDUCATION: `Master's Math & Informatics`,
            CERTIFICATIONS_MINIMAL: `AWS Modern Java`,
            LANGUAGES_MINIMAL: `French, English`
        };

        for (const [key, value] of Object.entries(cvReplacements)) {
            cvHtml = cvHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        const cvPathHtml = join(OUTPUT_DIR, `cv-${id}-tailored.html`);
        const cvPathPdf = join(OUTPUT_DIR, `cv-${id}-${metadata.company.toLowerCase().replace(/\s+/g, '-')}-elite.pdf`);
        fs.writeFileSync(cvPathHtml, cvHtml);
        await generatePDF(cvPathHtml, cvPathPdf);

        // --- 2. CL Tailoring ---
        let clHtml = fs.readFileSync(join(TEMPLATES_DIR, 'cl-elite.html'), 'utf-8');
        const clReplacements = {
            ...base,
            COMPANY: metadata.company,
            OPENING_PARA: `I am writing to express my strong interest in the Senior Fullstack role at ${metadata.company}. With 5 years of experience building mission-critical Java/Spring Boot systems, I am excited about the possibility of contributing to your engineering team.`,
            BODY_PARA_1: `At Ambatovy, I led the migration of our Incident Management System to Spring Boot 3, which reduced alert response times by 65%. My experience in industrial-scale Java environments has instilled in me a "reliability-first" mindset that aligns perfectly with ${metadata.company}'s goals.`,
            BODY_PARA_2: `Furthermore, my work on JNoSQL-EMBED and multi-tenant SaaS platforms demonstrates my ability to handle complex system designs and deliver high-performance solutions under tight deadlines.`
        };

        for (const [key, value] of Object.entries(clReplacements)) {
            clHtml = clHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        const clPathHtml = join(OUTPUT_DIR, `cl-${id}-tailored.html`);
        const clPathPdf = join(OUTPUT_DIR, `cl-${id}-${metadata.company.toLowerCase().replace(/\s+/g, '-')}-cover-letter-elite.pdf`);
        fs.writeFileSync(clPathHtml, clHtml);
        await generatePDF(clPathHtml, clPathPdf);

        console.log(`\n🏆 ELITE SUITE READY: CV and Cover Letter generated in /output`);

    } catch (err) {
        console.error('❌ Asset generation failed:', err.message);
        process.exit(1);
    }
}

main();
