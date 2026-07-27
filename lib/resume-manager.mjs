/**
 * lib/resume-manager.mjs — Multi-Resume Registry & JD Matcher
 *
 * Central module for managing multiple resume personas:
 *  - Discovers and loads all resume files from resumes/
 *  - Matches a JD to the best-fit resume type
 *  - Provides resume content for tailoring and application
 *  - Manages search queries per resume type
 *
 * Each resume file has YAML frontmatter:
 *   ---
 *   id: java-backend-engineer
 *   label: "Senior Java Backend Engineer"
 *   level: Senior
 *   fit: primary
 *   search_queries:
 *     - "Java backend engineer"
 *     - "Spring Boot developer"
 *   target_regions: global, europe, middle-east
 *   ---
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { resolveRegionCountries } from './scan/scanner-core.mjs';

const ROOT = process.cwd();
const RESUMES_DIR = join(ROOT, 'resumes');
const CV_PATH = join(ROOT, 'cv.md');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

let _resumeCache = null;

/**
 * Parse a resume file's YAML frontmatter and content.
 */
function parseResumeFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return null;

  let metadata;
  try {
    metadata = yaml.load(match[1]);
  } catch {
    return null;
  }

  // Normalize targetRegions: may be YAML array or comma-separated string
  let targetRegions = metadata.target_regions || [];
  if (typeof targetRegions === 'string') {
    targetRegions = targetRegions.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Normalize searchQueries: may be YAML array or comma-separated string
  let searchQueries = metadata.search_queries || [];
  if (typeof searchQueries === 'string') {
    searchQueries = searchQueries.split(',').map(s => s.trim()).filter(Boolean);
  }

  return {
    id: metadata.id || filePath,
    label: metadata.label || metadata.id || 'Unknown',
    level: metadata.level || 'Mid',
    fit: metadata.fit || 'adjacent',
    description: metadata.description || '',
    searchQueries,
    targetRegions,
    content: match[2].trim(),
    filePath,
  };
}

/**
 * Load all resume files from resumes/ directory.
 * Skips files without valid frontmatter.
 * @returns {Array<object>} Array of resume objects
 */
export function loadAllResumes() {
  if (_resumeCache) return _resumeCache;

  if (!existsSync(RESUMES_DIR)) {
    _resumeCache = [];
    return _resumeCache;
  }

  const files = readdirSync(RESUMES_DIR).filter(f => f.endsWith('.md'));
  const resumes = [];

  for (const file of files) {
    const filePath = join(RESUMES_DIR, file);
    const parsed = parseResumeFile(filePath);
    if (parsed) {
      resumes.push(parsed);
    }
  }

  // Sort: primary fits first, then secondary, then adjacent
  const fitOrder = { primary: 0, secondary: 1, adjacent: 2 };
  resumes.sort((a, b) => (fitOrder[a.fit] ?? 99) - (fitOrder[b.fit] ?? 99));

  _resumeCache = resumes;
  return resumes;
}

/**
 * Get a specific resume by its ID.
 * @param {string} id - Resume ID (matches frontmatter id field)
 * @returns {object|null}
 */
export function getResumeById(id) {
  if (!id) return null;
  const resumes = loadAllResumes();
  return resumes.find(r => r.id === id) || null;
}

/**
 * Get resume content (markdown body) for a specific resume ID.
 * Falls back to cv.md if resume not found.
 * @param {string} resumeId
 * @returns {string}
 */
export function getResumeContent(resumeId) {
  if (resumeId) {
    const resume = getResumeById(resumeId);
    if (resume) return resume.content;
  }

  // Fallback: read cv.md
  if (existsSync(CV_PATH)) {
    return readFileSync(CV_PATH, 'utf-8');
  }

  return '';
}

/**
 * Match a job description to the best-fit resume type.
 * Uses keyword overlap scoring between the JD and each resume's
 * description, label, and search queries.
 *
 * @param {object} job - { url, company, role, description?, jd? }
 * @returns {{ resumeId: string, resumeLabel: string, score: number }}
 */
export function matchResumeToJob(job) {
  const resumes = loadAllResumes();
  if (resumes.length === 0) {
    return { resumeId: null, resumeLabel: 'Default', score: 0 };
  }

  const description = (job.description || job.jd || '').toLowerCase();
  const role = (job.role || '').toLowerCase();
  const company = (job.company || '').toLowerCase();

  // Extract keywords from JD
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'this',
    'that', 'these', 'those', 'it', 'its', 'we', 'our', 'you', 'your',
    'they', 'their', 'not', 'no', 'nor', 'so', 'as', 'if', 'then', 'than',
    'very', 'just', 'about', 'also', 'more', 'some', 'any', 'each', 'every',
    'all', 'both', 'few', 'many', 'much',
  ]);
  const words = (description + ' ' + role + ' ' + company)
    .replace(/[^a-z0-9\s+#.-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  const jdKeywords = new Set(words);

  let bestMatch = null;
  let bestScore = 0;

  for (const resume of resumes) {
    let score = 0;

    // Score from search queries matching role/description
    for (const query of resume.searchQueries) {
      const queryWords = query.toLowerCase().split(/\s+/);
      const matchCount = queryWords.filter(qw => jdKeywords.has(qw)).length;
      score += matchCount * 3; // High weight: search queries define the persona
    }

    // Score from resume label matching role
    const labelWords = resume.label.toLowerCase().split(/\s+/);
    const labelMatch = labelWords.filter(lw => jdKeywords.has(lw)).length;
    score += labelMatch * 5; // Highest weight: explicit label match

    // Score from description keywords
    const descWords = (resume.description || '').toLowerCase().split(/\s+/);
    for (const dw of descWords) {
      if (dw.length > 2 && jdKeywords.has(dw)) {
        score += 2;
      }
    }

    // Skill-specific keyword bonuses
    if (resume.id === 'java-backend-engineer') {
      const keywords = ['spring boot', 'jakarta ee', 'jpa', 'hibernate', 'enterprise java',
        'java ee', 'ejb', 'jdbc', 'jms', 'middleware', 'rest api', 'microservice'];
      for (const kw of keywords) {
        if (description.includes(kw)) score += 10;
      }
    } else if (resume.id === 'full-stack-developer') {
      const keywords = ['full stack', 'full-stack', 'angular', 'react', 'frontend',
        'front-end', 'typescript', 'ui', 'javascript', 'css', 'web application'];
      for (const kw of keywords) {
        if (description.includes(kw)) score += 10;
      }
    } else if (resume.id === 'solutions-architect') {
      const keywords = ['architect', 'architecture', 'system design', 'migration',
        'technical lead', 'tech lead', 'solution', 'modernization', 'strategy',
        'proof of concept', 'sdlc', 'technical vision'];
      for (const kw of keywords) {
        if (description.includes(kw)) score += 10;
      }
    } else if (resume.id === 'ai-llm-engineer') {
      const keywords = ['ai', 'artificial intelligence', 'llm', 'gpt', 'openai',
        'machine learning', 'ml', 'deep learning', 'nlp', 'prompt', 'neural',
        'rag', 'vector', 'embedding', 'langchain', 'training data'];
      for (const kw of keywords) {
        if (description.includes(kw)) score += 10;
      }
    } else if (resume.id === 'data-platform-engineer') {
      const keywords = ['etl', 'data pipeline', 'data engineering', 'spring batch',
        'batch processing', 'data migration', 'platform', 'data warehouse',
        'oracle', 'postgresql', 'data integration', 'data lake', 'big data'];
      for (const kw of keywords) {
        if (description.includes(kw)) score += 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = resume;
    }
  }

  // If no clear match, pick the first primary fit resume
  if (!bestMatch) {
    const primary = resumes.find(r => r.fit === 'primary');
    if (primary) {
      bestMatch = primary;
    } else {
      bestMatch = resumes[0];
    }
  }

  return {
    resumeId: bestMatch.id,
    resumeLabel: bestMatch.label,
    score: bestScore,
  };
}

/**
 * Get search queries for all resumes, grouped by resume ID.
 * @returns {Array<{resumeId: string, queries: string[], regions: string[]}>}
 */
export function getAllResumeSearchConfigs() {
  const resumes = loadAllResumes();
  return resumes.map(r => ({
    resumeId: r.id,
    label: r.label,
    queries: r.searchQueries.length > 0
      ? r.searchQueries
      : [`${r.label.toLowerCase()} job`],
    regions: r.targetRegions.length > 0
      ? r.targetRegions
      : ['global'],
    fit: r.fit,
  }));
}

/**
 * Get resume search configs grouped by their target regions.
 * Resolves region keys to country codes for search filtering.
 * @returns {Array<{resumeId: string, queries: string[], countryCodes: string[]}>}
 */
export function getResumeSearchWithCountries() {
  return getAllResumeSearchConfigs().map(cfg => {
    const resolved = resolveRegionCountries(cfg.regions);
    return {
      ...cfg,
      countryCodes: resolved.codes,
    };
  });
}

/**
 * Invalidate the internal resume cache (useful after adding new resumes).
 */
export function invalidateResumeCache() {
  _resumeCache = null;
}

/**
 * Get a summary of all loaded resumes.
 */
export function getResumeSummary() {
  const resumes = loadAllResumes();
  return resumes.map(r => ({
    id: r.id,
    label: r.label,
    level: r.level,
    fit: r.fit,
    queries: r.searchQueries.length,
    regions: r.targetRegions,
    contentLength: r.content.length,
  }));
}

export default {
  loadAllResumes,
  getResumeById,
  getResumeContent,
  matchResumeToJob,
  getAllResumeSearchConfigs,
  getResumeSearchWithCountries,
  invalidateResumeCache,
  getResumeSummary,
};
