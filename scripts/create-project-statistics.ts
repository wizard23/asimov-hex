import { execSync } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import type { RepoSizeMetrics } from '../src/apps/statistics/types';

interface FileStats {
  fileType: string;
  count: number;
  totalLines: number;
  totalWords: number;
  totalBytes: number;
}

interface ProjectStatistics {
  timestamp: string;
  fileTypes: FileStats[];
  excludedFolders: string[];
  excludedFiles: string[];
  repoSizeMetrics?: RepoSizeMetrics;
  totals: {
    files: number;
    lines: number;
    words: number;
    bytes: number;
  };
}

function getFileExtension(filename: string): string {
  if (filename.endsWith('.test.ts')) {
    return '.test.ts';
  }
  const ext = extname(filename);
  return ext || basename(filename);
}

function countLinesAndWords(content: string): { lines: number; words: number } {
  const lines = content.split(/\r?\n/).length;
  const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
  return { lines, words };
}

function getGitIncludedFiles(): string[] {
  try {
    const output = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    console.error('Error getting git included files:', error);
    return [];
  }
}

function parseRepoStatisticsOutput(raw: string): RepoSizeMetrics | undefined {
  const lines = raw.split(/\r?\n/);
  let section: string | null = null;
  const meta: Record<string, string> = {};
  const intrinsic: Partial<RepoSizeMetrics['intrinsic']> = {};
  const gitObjects: Partial<RepoSizeMetrics['gitObjects']> = {};
  const largestBlobs: RepoSizeMetrics['largestBlobs'] = [];
  const diskUsage: Partial<RepoSizeMetrics['diskUsage']> = {
    topLevelDirs: [],
  };

  const parseNumber = (value: string): number | undefined => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    if (line.startsWith('### ')) {
      section = line.slice(4).trim();
      continue;
    }

    if (section === 'META' || section === 'INTRINSIC' || section === 'DISK_USAGE') {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (section === 'META') {
        meta[key] = value;
      } else if (section === 'INTRINSIC') {
        const numeric = parseNumber(value);
        if (numeric !== undefined) {
          (intrinsic as Record<string, number>)[key] = numeric;
        }
      } else {
        const numeric = parseNumber(value);
        if (numeric !== undefined) {
          (diskUsage as Record<string, number>)[key] = numeric;
        }
      }
      continue;
    }

    if (section === 'GIT_OBJECTS') {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) {
        continue;
      }
      const [, key, value] = match;
      const numeric = parseNumber(value);
      if (numeric === undefined) {
        continue;
      }
      const mapping: Record<string, keyof RepoSizeMetrics['gitObjects']> = {
        'count': 'looseObjectCount',
        'size': 'looseObjectSizeKiB',
        'in-pack': 'packedObjectCount',
        'packs': 'packfileCount',
        'size-pack': 'packfileSizeKiB',
        'prune-packable': 'prunePackableSizeKiB',
        'garbage': 'garbageObjectCount',
        'size-garbage': 'garbageSizeKiB',
      };
      const mappedKey = mapping[key.trim()];
      if (mappedKey) {
        gitObjects[mappedKey] = numeric;
      }
      continue;
    }

    if (section === 'LARGEST_BLOBS') {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) {
        continue;
      }
      const [, size, path] = match;
      const sizeBytes = parseNumber(size);
      if (sizeBytes !== undefined) {
        largestBlobs.push({ path, sizeBytes });
      }
      continue;
    }

    if (section === 'TOP_LEVEL_DIRS') {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) {
        continue;
      }
      const [, size, path] = match;
      const sizeBytes = parseNumber(size);
      if (sizeBytes !== undefined && diskUsage.topLevelDirs) {
        diskUsage.topLevelDirs.push({ path, sizeBytes });
      }
    }
  }

  const version = parseNumber(meta.version || '');
  const timestamp = meta.timestamp;
  const headCommit = meta.headCommit;
  const headBranch = meta.headBranch;

  if (version === undefined || !timestamp || !headCommit || !headBranch) {
    return undefined;
  }

  const {
    commitCount,
    totalCommitCount,
    trackedFileCount,
    trackedDirCount,
    trackedContentBytes,
  } = intrinsic;

  if (
    commitCount === undefined ||
    totalCommitCount === undefined ||
    trackedFileCount === undefined ||
    trackedDirCount === undefined ||
    trackedContentBytes === undefined
  ) {
    return undefined;
  }

  const {
    looseObjectCount,
    looseObjectSizeKiB,
    packedObjectCount,
    packfileCount,
    packfileSizeKiB,
    prunePackableSizeKiB,
    garbageObjectCount,
    garbageSizeKiB,
  } = gitObjects;

  if (
    looseObjectCount === undefined ||
    looseObjectSizeKiB === undefined ||
    packedObjectCount === undefined ||
    packfileCount === undefined ||
    packfileSizeKiB === undefined ||
    prunePackableSizeKiB === undefined ||
    garbageObjectCount === undefined ||
    garbageSizeKiB === undefined
  ) {
    return undefined;
  }

  if (
    diskUsage.worktreeBytes === undefined ||
    diskUsage.worktreeExcludingGitBytes === undefined ||
    diskUsage.gitDirBytes === undefined ||
    !diskUsage.topLevelDirs
  ) {
    return undefined;
  }

  return {
    version,
    timestamp,
    repo: {
      headCommit,
      headBranch,
    },
    intrinsic: {
      commitCount,
      totalCommitCount,
      trackedFileCount,
      trackedDirCount,
      trackedContentBytes,
    },
    gitObjects: {
      looseObjectCount,
      looseObjectSizeKiB,
      packedObjectCount,
      packfileCount,
      packfileSizeKiB,
      prunePackableSizeKiB,
      garbageObjectCount,
      garbageSizeKiB,
    },
    largestBlobs,
    diskUsage: {
      worktreeBytes: diskUsage.worktreeBytes,
      worktreeExcludingGitBytes: diskUsage.worktreeExcludingGitBytes,
      gitDirBytes: diskUsage.gitDirBytes,
      topLevelDirs: diskUsage.topLevelDirs,
    },
  };
}

function getRepoSizeMetrics(): RepoSizeMetrics | undefined {
  try {
    const rawOutput = execSync('scripts/repo-statistics.sh', { encoding: 'utf-8' });
    const parsed = parseRepoStatisticsOutput(rawOutput);
    if (!parsed) {
      console.warn('Warning: Could not parse repo statistics output.');
    }
    return parsed;
  } catch (error) {
    console.warn('Warning: Could not run repo statistics script:', error);
    return undefined;
  }
}

function generateStatistics(): ProjectStatistics {
  const allFiles = getGitIncludedFiles();
  const excludedFolders = [
    'docs',
    'public',
  ];
  const excludedFiles = [
    'package-lock.json'
  ];

  const files = allFiles.filter(file => 
    !excludedFolders.some(folder => file.startsWith(folder)) &&
    !excludedFiles.includes(file)
  );
  
  const statsByType = new Map<string, { count: number; lines: number; words: number; bytes: number }>();

  let totalLines = 0;
  let totalWords = 0;
  let totalBytes = 0;

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const { lines, words } = countLinesAndWords(content);
      const stats = statSync(file);
      const bytes = stats.size;
      
      const fileType = getFileExtension(file);
      const current = statsByType.get(fileType) || { count: 0, lines: 0, words: 0, bytes: 0 };
      
      statsByType.set(fileType, {
        count: current.count + 1,
        lines: current.lines + lines,
        words: current.words + words,
        bytes: current.bytes + bytes,
      });

      totalLines += lines;
      totalWords += words;
      totalBytes += bytes;
    } catch (error) {
      // Skip files that can't be read (binary files, etc.)
      console.warn(`Warning: Could not read file ${file}:`, error);
    }
  }

  const fileTypes: FileStats[] = Array.from(statsByType.entries())
    .map(([fileType, stats]) => ({
      fileType,
      count: stats.count,
      totalLines: stats.lines,
      totalWords: stats.words,
      totalBytes: stats.bytes,
    }))
    .sort((a, b) => {
      // Primary sort by count (descending)
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // Secondary sort by totalLines (descending)
      if (b.totalLines !== a.totalLines) {
        return b.totalLines - a.totalLines;
      }
      // Tertiary sort by totalWords (descending)
      return b.totalWords - a.totalWords;
    });

  const repoSizeMetrics = getRepoSizeMetrics();

  return {
    timestamp: new Date().toISOString(),
    fileTypes,
    excludedFolders,
    excludedFiles,
    repoSizeMetrics,
    totals: {
      files: files.length,
      lines: totalLines,
      words: totalWords,
      bytes: totalBytes,
    },
  };
}

function main() {
  const stats = generateStatistics();
  
  // Generate filename with current timestamp
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const filename = `${year}-${month}-${day}_${hours}-${minutes}.json`;
  const outputDir = join(process.cwd(), 'public', 'project-statistics', 'generated');
  const outputPath = join(outputDir, filename);

  // Create directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write statistics to file
  writeFileSync(outputPath, JSON.stringify(stats, null, 2), 'utf-8');
  
  // Update index.json with list of all available statistics files
  const existingFiles = readdirSync(outputDir)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .sort()
    .reverse(); // Newest first
  const indexPath = join(outputDir, 'index.json');
  const indexData = {
    files: existingFiles
  };
  writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
  
  console.log(`Project statistics generated: ${outputPath}`);
  console.log(`Total files: ${stats.totals.files}`);
  console.log(`Total lines: ${stats.totals.lines}`);
  console.log(`Total words: ${stats.totals.words}`);
  console.log(`Total bytes: ${stats.totals.bytes}`);
  console.log(`File types: ${stats.fileTypes.length}`);
}

main();
