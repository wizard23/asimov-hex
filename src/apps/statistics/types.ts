export interface RepoSizeMetrics {
  /** Format version for forward compatibility */
  version: number;

  /** When this snapshot was taken (ISO 8601, UTC recommended) */
  timestamp: string;

  /** Repository identity */
  repo: {
    headCommit: string;
    headBranch: string;
  };

  /** Intrinsic repository structure (commit-based) */
  intrinsic: {
    commitCount: number;
    totalCommitCount: number;
    trackedFileCount: number;
    trackedDirCount: number;
    trackedContentBytes: number;
  };

  /** Git object database metrics */
  gitObjects: {
    looseObjectCount: number;
    looseObjectSizeKiB: number;
    packedObjectCount: number;
    packfileCount: number;
    packfileSizeKiB: number;
    prunePackableSizeKiB: number;
    garbageObjectCount: number;
    garbageSizeKiB: number;
  };

  /** Largest blobs ever committed */
  largestBlobs: Array<{
    path: string;
    sizeBytes: number;
  }>;

  /** Disk usage (checkout-specific) */
  diskUsage: {
    worktreeBytes: number;
    worktreeExcludingGitBytes: number;
    gitDirBytes: number;

    topLevelDirs: Array<{
      path: string;
      sizeBytes: number;
    }>;
  };
}

export interface ProjectStatistics {
  timestamp: string;
  fileTypes: Array<{
    fileType: string;
    count: number;
    totalLines: number;
    totalWords: number;
    totalBytes?: number;
  }>;
  includedFiles: Array<{
    path: string;
    fileType: string;
    lines: number;
    words: number;
    bytes: number;
  }>;
  excludedFolders: string[];
  excludedFiles: string[];
  repoSizeMetrics?: RepoSizeMetrics;
  totals: {
    files: number;
    lines: number;
    words: number;
    bytes?: number;
  };
}
