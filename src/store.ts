import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import type {
  DraftRecord,
  LegacyLesson,
  MemoryRecord,
  ResolvedConfig,
  SessionAccumulator,
  SessionSummary,
} from "./types.ts";

const initializationCache = new Map<string, Promise<void>>();
const require = createRequire(import.meta.url);
type DatabaseSyncCtor = new (location: string) => DatabaseSync;
let databaseSyncCtor: DatabaseSyncCtor | null = null;

function getDatabaseSyncCtor(): DatabaseSyncCtor {
  if (databaseSyncCtor) {
    return databaseSyncCtor;
  }

  try {
    const loaded = require("node:sqlite") as { DatabaseSync?: DatabaseSyncCtor };
    if (typeof loaded.DatabaseSync !== "function") {
      throw new Error("DatabaseSync export was not available");
    }
    databaseSyncCtor = loaded.DatabaseSync;
    return databaseSyncCtor;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `TotalReClaw requires the Node.js core node:sqlite API. Upgrade the host runtime to a Node 22 build with node:sqlite support before enabling durable storage (${reason}).`,
    );
  }
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function decodeArray(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function ensureDirSync(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

async function ensureParent(filePath: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
}

function initKey(config: ResolvedConfig): string {
  return `${config.dbPath}|${config.storePath}|${config.draftPath}|${config.sessionStatePath}`;
}

function openDatabase(dbPath: string): DatabaseSync {
  const DatabaseSync = getDatabaseSyncCtor();
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_records (
      record_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT NOT NULL,
      commands_involved TEXT NOT NULL,
      files_involved TEXT NOT NULL,
      tools_involved TEXT NOT NULL,
      source_pointer TEXT NOT NULL,
      session_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      trust_class TEXT NOT NULL,
      confidence REAL NOT NULL,
      created_at TEXT NOT NULL,
      last_validated_at TEXT NOT NULL,
      supersedes TEXT NOT NULL,
      conflicts_with TEXT NOT NULL,
      resolution_note TEXT
    );

    CREATE TABLE IF NOT EXISTS session_summaries (
      session_id TEXT PRIMARY KEY,
      session_key TEXT NOT NULL UNIQUE,
      channel_id TEXT NOT NULL,
      source_surface TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      goal TEXT NOT NULL,
      outcome TEXT NOT NULL,
      decisions TEXT NOT NULL,
      blockers TEXT NOT NULL,
      notable_commands TEXT NOT NULL,
      notable_files TEXT NOT NULL,
      notable_tools TEXT NOT NULL,
      linked_record_ids TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      source_pointer TEXT NOT NULL,
      confidence REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memory_records_summary ON memory_records(summary);
    CREATE INDEX IF NOT EXISTS idx_memory_records_category ON memory_records(category);
    CREATE INDEX IF NOT EXISTS idx_memory_records_session_id ON memory_records(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_summaries_ended_at ON session_summaries(ended_at);
  `);
}

function getMeta(db: DatabaseSync, key: string): string | null {
  const row = db.prepare("SELECT value FROM schema_meta WHERE key = ?").get(key) as { value?: string } | undefined;
  return typeof row?.value === "string" ? row.value : null;
}

function setMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    `
      INSERT INTO schema_meta(key, value, updated_at)
      VALUES(?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `,
  ).run(key, value, new Date().toISOString());
}

function rowToMemoryRecord(row: Record<string, unknown>): MemoryRecord {
  return {
    record_id: String(row.record_id ?? ""),
    category: String(row.category ?? "procedure") as MemoryRecord["category"],
    summary: String(row.summary ?? ""),
    details: String(row.details ?? ""),
    commands_involved: decodeArray(row.commands_involved),
    files_involved: decodeArray(row.files_involved),
    tools_involved: decodeArray(row.tools_involved),
    source_pointer: String(row.source_pointer ?? ""),
    session_id: String(row.session_id ?? ""),
    channel_id: String(row.channel_id ?? ""),
    trust_class: String(row.trust_class ?? "manual"),
    confidence: Number(row.confidence ?? 0),
    created_at: String(row.created_at ?? ""),
    last_validated_at: String(row.last_validated_at ?? ""),
    supersedes: decodeArray(row.supersedes),
    conflicts_with: decodeArray(row.conflicts_with),
    resolution_note: typeof row.resolution_note === "string" ? row.resolution_note : undefined,
  };
}

function rowToSessionSummary(row: Record<string, unknown>): SessionSummary {
  return {
    session_id: String(row.session_id ?? ""),
    session_key: String(row.session_key ?? ""),
    channel_id: String(row.channel_id ?? ""),
    source_surface: String(row.source_surface ?? "openclaw"),
    started_at: String(row.started_at ?? ""),
    ended_at: String(row.ended_at ?? ""),
    goal: String(row.goal ?? ""),
    outcome: String(row.outcome ?? ""),
    decisions: decodeArray(row.decisions),
    blockers: decodeArray(row.blockers),
    notable_commands: decodeArray(row.notable_commands),
    notable_files: decodeArray(row.notable_files),
    notable_tools: decodeArray(row.notable_tools),
    linked_record_ids: decodeArray(row.linked_record_ids),
    summary_text: String(row.summary_text ?? ""),
    source_pointer: String(row.source_pointer ?? ""),
    confidence: Number(row.confidence ?? 0),
  };
}

function insertMemoryRecord(db: DatabaseSync, record: MemoryRecord): void {
  db.prepare(
    `
      INSERT INTO memory_records (
        record_id, category, summary, details, commands_involved, files_involved, tools_involved,
        source_pointer, session_id, channel_id, trust_class, confidence, created_at, last_validated_at,
        supersedes, conflicts_with, resolution_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id) DO UPDATE SET
        category = excluded.category,
        summary = excluded.summary,
        details = excluded.details,
        commands_involved = excluded.commands_involved,
        files_involved = excluded.files_involved,
        tools_involved = excluded.tools_involved,
        source_pointer = excluded.source_pointer,
        session_id = excluded.session_id,
        channel_id = excluded.channel_id,
        trust_class = excluded.trust_class,
        confidence = excluded.confidence,
        created_at = excluded.created_at,
        last_validated_at = excluded.last_validated_at,
        supersedes = excluded.supersedes,
        conflicts_with = excluded.conflicts_with,
        resolution_note = excluded.resolution_note
    `,
  ).run(
    record.record_id,
    record.category,
    record.summary,
    record.details,
    encodeJson(dedupe(record.commands_involved)),
    encodeJson(dedupe(record.files_involved)),
    encodeJson(dedupe(record.tools_involved)),
    record.source_pointer,
    record.session_id,
    record.channel_id,
    record.trust_class,
    record.confidence,
    record.created_at,
    record.last_validated_at,
    encodeJson(dedupe(record.supersedes)),
    encodeJson(dedupe(record.conflicts_with)),
    record.resolution_note ?? null,
  );
}

function insertSessionSummary(db: DatabaseSync, summary: SessionSummary): void {
  db.prepare(
    `
      INSERT INTO session_summaries (
        session_id, session_key, channel_id, source_surface, started_at, ended_at, goal, outcome,
        decisions, blockers, notable_commands, notable_files, notable_tools, linked_record_ids,
        summary_text, source_pointer, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        session_key = excluded.session_key,
        channel_id = excluded.channel_id,
        source_surface = excluded.source_surface,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        goal = excluded.goal,
        outcome = excluded.outcome,
        decisions = excluded.decisions,
        blockers = excluded.blockers,
        notable_commands = excluded.notable_commands,
        notable_files = excluded.notable_files,
        notable_tools = excluded.notable_tools,
        linked_record_ids = excluded.linked_record_ids,
        summary_text = excluded.summary_text,
        source_pointer = excluded.source_pointer,
        confidence = excluded.confidence
    `,
  ).run(
    summary.session_id,
    summary.session_key,
    summary.channel_id,
    summary.source_surface,
    summary.started_at,
    summary.ended_at,
    summary.goal,
    summary.outcome,
    encodeJson(dedupe(summary.decisions)),
    encodeJson(dedupe(summary.blockers)),
    encodeJson(dedupe(summary.notable_commands)),
    encodeJson(dedupe(summary.notable_files)),
    encodeJson(dedupe(summary.notable_tools)),
    encodeJson(dedupe(summary.linked_record_ids)),
    summary.summary_text,
    summary.source_pointer,
    summary.confidence,
  );
}

function legacyToMemoryRecord(lesson: LegacyLesson): MemoryRecord {
  const details = [
    `Failure symptom: ${lesson.failure_symptom}`,
    `Root cause: ${lesson.root_cause}`,
    `Fix: ${lesson.fix}`,
  ].join("\n");

  return {
    record_id: lesson.lesson_id,
    category: "failure_fix",
    summary: lesson.task_summary,
    details,
    commands_involved: lesson.commands_involved,
    files_involved: lesson.files_involved,
    tools_involved: lesson.tools_involved,
    source_pointer: lesson.source_pointer,
    session_id: "",
    channel_id: "",
    trust_class: lesson.trust_class,
    confidence: lesson.confidence,
    created_at: lesson.created_at,
    last_validated_at: lesson.last_validated_at,
    supersedes: lesson.supersedes ?? [],
    conflicts_with: lesson.conflicts_with ?? [],
    resolution_note: lesson.resolution_note,
  };
}

export async function loadLegacyLessons(storePath: string): Promise<LegacyLesson[]> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const lessons: LegacyLesson[] = [];

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const parsed = JSON.parse(trimmed) as LegacyLesson;
      if (parsed.scope !== "openclaw" || parsed.source_type !== "openclaw_session") {
        continue;
      }
      lessons.push(parsed);
    }

    return lessons.sort((left, right) => left.created_at.localeCompare(right.created_at));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function migrateLegacyLessons(config: ResolvedConfig): Promise<void> {
  const legacyLessons = await loadLegacyLessons(config.storePath);
  if (legacyLessons.length === 0) {
    return;
  }

  const legacyDir = path.join(path.dirname(config.dbPath), "legacy");
  await ensureDir(legacyDir);
  const backupPath = path.join(legacyDir, `lessons-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
  await fs.copyFile(config.storePath, backupPath);

  const db = openDatabase(config.dbPath);
  try {
    const migrationKey = `legacy_import:${config.storePath}`;
    if (getMeta(db, migrationKey)) {
      return;
    }

    db.exec("BEGIN");
    try {
      for (const lesson of legacyLessons) {
        insertMemoryRecord(db, legacyToMemoryRecord(lesson));
      }
      setMeta(db, migrationKey, backupPath);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

export async function ensureStoreReady(config: ResolvedConfig): Promise<void> {
  const key = initKey(config);
  const existing = initializationCache.get(key);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    await ensureParent(config.dbPath);
    await ensureDir(config.draftPath);
    await ensureDir(config.sessionStatePath);

    const db = openDatabase(config.dbPath);
    try {
      createSchema(db);
    } finally {
      db.close();
    }

    await migrateLegacyLessons(config);
  })();

  initializationCache.set(key, pending);
  try {
    await pending;
  } catch (error) {
    initializationCache.delete(key);
    throw error;
  }
}

export async function loadMemoryRecords(config: ResolvedConfig): Promise<MemoryRecord[]> {
  await ensureStoreReady(config);
  const db = openDatabase(config.dbPath);
  try {
    const rows = db
      .prepare("SELECT * FROM memory_records ORDER BY last_validated_at DESC, created_at DESC")
      .all() as Array<Record<string, unknown>>;
    return rows.map(rowToMemoryRecord);
  } finally {
    db.close();
  }
}

export async function upsertMemoryRecords(config: ResolvedConfig, records: MemoryRecord[]): Promise<void> {
  await ensureStoreReady(config);
  const db = openDatabase(config.dbPath);
  try {
    db.exec("BEGIN");
    try {
      for (const record of records) {
        insertMemoryRecord(db, record);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

export async function loadSessionSummaries(config: ResolvedConfig): Promise<SessionSummary[]> {
  await ensureStoreReady(config);
  const db = openDatabase(config.dbPath);
  try {
    const rows = db
      .prepare("SELECT * FROM session_summaries ORDER BY ended_at DESC, started_at DESC")
      .all() as Array<Record<string, unknown>>;
    return rows.map(rowToSessionSummary);
  } finally {
    db.close();
  }
}

export async function saveAcceptedSessionBundle(
  config: ResolvedConfig,
  summary: SessionSummary,
  linkedRecords: MemoryRecord[],
): Promise<void> {
  await ensureStoreReady(config);
  const db = openDatabase(config.dbPath);
  try {
    db.exec("BEGIN");
    try {
      for (const record of linkedRecords) {
        insertMemoryRecord(db, record);
      }
      insertSessionSummary(db, summary);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

export function createMemoryRecordId(seed: string): string {
  return `trc_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

export function createSessionId(seed: string): string {
  return `trs_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

export function createDraftId(): string {
  return `draft_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function saveDraft(draftDir: string, draft: DraftRecord): Promise<string> {
  await ensureDir(draftDir);
  const filePath = path.join(draftDir, `${draft.draft_id}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  return filePath;
}

export async function loadDraft(draftDir: string, draftId: string): Promise<DraftRecord | null> {
  const filePath = path.join(draftDir, `${draftId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as DraftRecord;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function listDrafts(draftDir: string): Promise<DraftRecord[]> {
  try {
    const entries = await fs.readdir(draftDir, { withFileTypes: true });
    const drafts = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => fs.readFile(path.join(draftDir, entry.name), "utf8").then((raw) => JSON.parse(raw) as DraftRecord)),
    );
    return drafts.sort((left, right) => right.created_at.localeCompare(left.created_at));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function updateDraft(draftDir: string, draft: DraftRecord): Promise<void> {
  await saveDraft(draftDir, draft);
}

function sessionStateFilePath(root: string, sessionKey: string): string {
  const safe = Buffer.from(sessionKey, "utf8").toString("base64url");
  return path.join(root, `${safe}.pending.json`);
}

export async function saveSessionAccumulator(root: string, accumulator: SessionAccumulator): Promise<string> {
  await ensureDir(root);
  const filePath = sessionStateFilePath(root, accumulator.session_key);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(accumulator, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
  return filePath;
}

export function saveSessionAccumulatorSync(root: string, accumulator: SessionAccumulator): string {
  ensureDirSync(root);
  const filePath = sessionStateFilePath(root, accumulator.session_key);
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(accumulator, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
  return filePath;
}

export async function loadSessionAccumulator(
  root: string,
  sessionKey: string,
): Promise<SessionAccumulator | null> {
  const filePath = sessionStateFilePath(root, sessionKey);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as SessionAccumulator;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function loadSessionAccumulatorSync(root: string, sessionKey: string): SessionAccumulator | null {
  const filePath = sessionStateFilePath(root, sessionKey);
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as SessionAccumulator;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function deleteSessionAccumulator(root: string, sessionKey: string): Promise<void> {
  const filePath = sessionStateFilePath(root, sessionKey);
  await fs.rm(filePath, { force: true });
}

export async function listSessionAccumulators(root: string): Promise<SessionAccumulator[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const accumulators = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".pending.json"))
        .map((entry) => fs.readFile(path.join(root, entry.name), "utf8").then((raw) => JSON.parse(raw) as SessionAccumulator)),
    );

    return accumulators.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
