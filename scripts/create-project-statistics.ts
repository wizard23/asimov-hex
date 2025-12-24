import { execSync } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

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

function getGitTrackedFiles(): string[] {
  try {
    const output = execSync('git ls-files', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    console.error('Error getting git tracked files:', error);
    return [];
  }
}

function generateStatistics(): ProjectStatistics {
  const allFiles = getGitTrackedFiles();
  const excludedFolders = [
    'docs',
    'public/project-statistics/generated'
  ];
  const excludedFiles = [
    'TODOS.md'
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

  return {
    timestamp: new Date().toISOString(),
    fileTypes,
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

