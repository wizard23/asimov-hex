import { execSync } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, extname, basename } from 'path';

interface FileStats {
  fileType: string;
  count: number;
  totalLines: number;
  totalWords: number;
}

interface ProjectStatistics {
  timestamp: string;
  fileTypes: FileStats[];
  totals: {
    files: number;
    lines: number;
    words: number;
  };
}

function getFileExtension(filename: string): string {
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
    'docs/generated',
    'public/project-statistics/generated'
  ];

  const files = allFiles.filter(file => 
    !excludedFolders.some(folder => file.startsWith(folder))
  );
  
  const statsByType = new Map<string, { count: number; lines: number; words: number }>();

  let totalLines = 0;
  let totalWords = 0;

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const { lines, words } = countLinesAndWords(content);
      
      const fileType = getFileExtension(file);
      const current = statsByType.get(fileType) || { count: 0, lines: 0, words: 0 };
      
      statsByType.set(fileType, {
        count: current.count + 1,
        lines: current.lines + lines,
        words: current.words + words,
      });

      totalLines += lines;
      totalWords += words;
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
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  return {
    timestamp: new Date().toISOString(),
    fileTypes,
    totals: {
      files: files.length,
      lines: totalLines,
      words: totalWords,
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
  console.log(`File types: ${stats.fileTypes.length}`);
}

main();

