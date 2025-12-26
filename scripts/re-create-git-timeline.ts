import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import * as readline from "node:readline";


export type ParsedCommit = {
  hash: string;
  timestamp: number;
  authorName: string;
  authorEmail: string;
  message: string;
  addedLines: number;
  removedLines: number;
};

type ParseOptions = {
  /**
   * If true, do NOT count numstat lines for merge commits (parents.length > 1).
   * This avoids huge / confusing stats for merges.
   */
  suppressMergeStats?: boolean;
  /**
   * If true, skip merge commits entirely (they will not appear in the result).
   */
  skipMerges?: boolean;
};

type InternalCommit = ParsedCommit & {
  parents: string[];
  isMerge: boolean;
};

const COMMIT_MARKER = "@@@";

/**
 * Parse `git log --numstat` output produced by:
 *
 *   git log <branch> \
 *     --no-decorate \
 *     --pretty=format:'@@@%n%H|%P|%ct|%an|%ae|%s' \
 *     --numstat
 */
export async function getCommitsWithLineStats(
  repoDir: string,
  branch: string,
  options: ParseOptions = {},
): Promise<ParsedCommit[]> {
  const suppressMergeStats = options.suppressMergeStats ?? true;
  const skipMerges = options.skipMerges ?? false;

  // Run git
  const child = spawn(
    "git",
    [
      "log",
      branch,
      "--no-decorate",
      "--pretty=format:@@@%n%H|%P|%ct|%an|%ae|%s",
      "--numstat",
    ],
    {
      cwd: repoDir,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const rl = readline.createInterface({ input: child.stdout });

  const commits: ParsedCommit[] = [];
  let current: InternalCommit | null = null;
  let expectHeaderNext = false;

  function finalizeCurrent() {
    if (!current) return;
    if (!(skipMerges && current.isMerge)) {
      // Drop internal fields
      const { parents: _p, isMerge: _m, ...publicCommit } = current;
      commits.push(publicCommit);
    }
    current = null;
  }

  rl.on("line", (line) => {
    // Marker line indicates the next non-empty line is the header
    if (line === COMMIT_MARKER) {
      finalizeCurrent();
      expectHeaderNext = true;
      return;
    }

    if (expectHeaderNext) {
      if (line.trim() === "") return; // skip accidental blanks
      expectHeaderNext = false;

      // Header format: %H|%P|%ct|%an|%ae|%s
      // NOTE: %s is last so it may contain '|' — we join the tail back.
      const parts = line.split("|");
      if (parts.length < 6) {
        throw new Error(`Malformed commit header: ${line}`);
      }

      const hash = parts[0];
      const parentsRaw = parts[1];
      const timestampRaw = parts[2];
      const authorName = parts[3];
      const authorEmail = parts[4];
      const message = parts.slice(5).join("|"); // keep any '|' inside subject

      const parents = parentsRaw.trim() === "" ? [] : parentsRaw.trim().split(/\s+/);
      const isMerge = parents.length > 1;

      current = {
        hash,
        timestamp: Number(timestampRaw),
        authorName,
        authorEmail,
        message,
        addedLines: 0,
        removedLines: 0,
        parents,
        isMerge,
      };

      if (!Number.isFinite(current.timestamp)) {
        throw new Error(`Invalid timestamp in header: ${line}`);
      }

      return;
    }

    // If we don't currently have a commit, ignore stray lines.
    if (!current) return;

    // numstat line: "<added>\t<removed>\t<path>"
    // added/removed can be "-" for binaries.
    // Example: "12\t3\tsrc/foo.ts"
    const m = /^(\d+|-)\t(\d+|-)\t/.exec(line);
    if (!m) return; // ignore anything unexpected (shouldn’t happen much)

    // Option: suppress stats for merge commits
    if (suppressMergeStats && current.isMerge) {
      return;
    }

    const addedStr = m[1];
    const removedStr = m[2];

    if (addedStr !== "-" && removedStr !== "-") {
      const added = Number(addedStr);
      const removed = Number(removedStr);
      // Be paranoid: ensure numeric
      if (Number.isFinite(added)) current.addedLines += added;
      if (Number.isFinite(removed)) current.removedLines += removed;
    }
  });

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  // Finish last commit (if any)
  finalizeCurrent();
  rl.close();

  // Read stderr if command failed
  if (exitCode !== 0) {
    const stderr = await streamToString(child.stderr);
    throw new Error(`git log failed (exit ${exitCode}): ${stderr.trim()}`);
  }

  return commits;
}

function streamToString(stream: NodeJS.ReadableStream | null | undefined): Promise<string> {
  if (!stream) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    let s = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => (s += chunk));
    stream.on("end", () => resolve(s));
    stream.on("error", reject);
  });
}


import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  getCommitsWithLineStats(process.cwd(), "main")
    .then(async (commits) => {
            //   commits
            //     .sort((a, b) => b.timestamp - a.timestamp)
            //     .forEach((c) => console.log(c))

            const sorted = commits.sort((a, b) => b.timestamp - a.timestamp);

            const outDir = join(process.cwd(), "public/project-history");
            const outFile = join(outDir, "git-timeline.json");

            await mkdir(outDir, { recursive: true });
            await writeFile(outFile, JSON.stringify(sorted, null, 2), "utf8");

            console.log(`Saved ${sorted.length} commits to ${outFile}`);
        }
    )
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
