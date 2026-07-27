import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export function resolveExtractorMode(profilePath) {
  if (!existsSync(profilePath)) return 'mcp';
  try {
    const cfg = yaml.load(readFileSync(profilePath, 'utf8'));
    return cfg?.scan?.extractor === 'cli' ? 'cli' : 'mcp';
  } catch {
    return 'mcp';
  }
}
