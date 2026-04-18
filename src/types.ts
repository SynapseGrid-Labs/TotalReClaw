export type RecallVerdict = "prior_fix_found" | "context_found" | "conflicting_memory" | "no_match";

export type MemoryCategory =
  | "failure_fix"
  | "decision"
  | "environment_state"
  | "procedure"
  | "blocker"
  | "outcome";

export type DraftStatus = "pending" | "accepted" | "rejected" | "superseded";
export type DraftType = "manual_record" | "session_summary";
export type RecallItemKind = "record" | "session";

export interface LegacyLesson {
  lesson_id: string;
  scope: "openclaw";
  source_type: "openclaw_session";
  task_summary: string;
  failure_symptom: string;
  root_cause: string;
  fix: string;
  commands_involved: string[];
  files_involved: string[];
  tools_involved: string[];
  source_pointer: string;
  trust_class: string;
  confidence: number;
  created_at: string;
  last_validated_at: string;
  supersedes?: string[];
  conflicts_with?: string[];
  resolution_note?: string;
}

export interface MemoryRecord {
  record_id: string;
  category: MemoryCategory;
  summary: string;
  details: string;
  commands_involved: string[];
  files_involved: string[];
  tools_involved: string[];
  source_pointer: string;
  session_id: string;
  channel_id: string;
  trust_class: string;
  confidence: number;
  created_at: string;
  last_validated_at: string;
  supersedes: string[];
  conflicts_with: string[];
  resolution_note?: string;
}

export interface SessionSummary {
  session_id: string;
  session_key: string;
  channel_id: string;
  source_surface: string;
  started_at: string;
  ended_at: string;
  goal: string;
  outcome: string;
  decisions: string[];
  blockers: string[];
  notable_commands: string[];
  notable_files: string[];
  notable_tools: string[];
  linked_record_ids: string[];
  summary_text: string;
  source_pointer: string;
  confidence: number;
}

export interface ManualRecordDraftPayload {
  category: MemoryCategory;
  summary: string;
  details: string;
  commands_involved: string[];
  files_involved: string[];
  tools_involved: string[];
  source_pointer: string;
  session_id: string;
  channel_id: string;
  trust_class: string;
  confidence: number;
}

export interface SessionSummaryDraftPayload {
  session_summary: SessionSummary;
  linked_records: MemoryRecord[];
}

export interface DraftRecord {
  draft_id: string;
  draft_type: DraftType;
  status: DraftStatus;
  created_at: string;
  accepted_at?: string;
  raw_excerpt: string;
  notes: string[];
  needs_llm_generation: boolean;
  manual_record?: ManualRecordDraftPayload;
  session_summary?: SessionSummary;
  linked_records: MemoryRecord[];
}

export interface SessionAccumulator {
  session_id: string;
  session_key: string;
  channel_id: string;
  source_surface: string;
  started_at: string;
  updated_at: string;
  goal: string;
  texts: string[];
  commands: string[];
  files: string[];
  tools: string[];
  source_pointer: string;
}

export interface ScoreBreakdown {
  retrieval_relevance: number;
  evidence_quality: number;
  recency: number;
  operational_overlap: number;
}

export interface RecallMatch {
  kind: RecallItemKind;
  id: string;
  category?: MemoryCategory;
  summary: string;
  excerpt: string;
  source_pointer: string;
  trust_class: string;
  confidence: number;
  last_updated_at: string;
  score_breakdown: ScoreBreakdown;
}

export interface EvidenceEntry {
  kind: RecallItemKind;
  id: string;
  summary: string;
  trust_class: string;
  last_updated_at: string;
  score: number;
}

export interface RecallResult {
  verdict: RecallVerdict;
  confidence: number;
  summary: string;
  matched_items: RecallMatch[];
  recommended_next_step: string;
  evidence: EvidenceEntry[];
}

export type CheckResult = RecallResult;

export interface RankedItem {
  kind: RecallItemKind;
  confidence: number;
  breakdown: ScoreBreakdown;
  trust_class: string;
  updated_at: string;
  record?: MemoryRecord;
  session?: SessionSummary;
}

export interface ResolvedConfig {
  enabled: boolean;
  enableAutoRecall: boolean;
  enableAutoCheck: boolean;
  enableAutoCapture: boolean;
  dbPath: string;
  storePath: string;
  draftPath: string;
  sessionStatePath: string;
  hookTimeoutMs: number;
  summaryModel: string;
  priorFixThreshold: number;
  noMatchThreshold: number;
  conflictWindow: number;
  maxRecordsInjected: number;
  maxTokensInjected: number;
  demoStorePath: string;
  pluginRoot: string;
}

export interface CommandExecution {
  text: string;
  details?: Record<string, unknown>;
}

export interface SessionRef {
  session_id: string;
  session_key: string;
  channel_id: string;
  source_surface: string;
  source_pointer: string;
}
