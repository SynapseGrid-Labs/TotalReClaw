const INLINE_SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9_-]{16,}/g, "[REDACTED_ANTHROPIC_KEY]"],
  [/sk-[A-Za-z0-9]{16,}/g, "[REDACTED_OPENAI_KEY]"],
  [/gh[pousr]_[A-Za-z0-9]{16,}/g, "[REDACTED_GITHUB_TOKEN]"],
  [/Bearer\s+[A-Za-z0-9._-]{12,}/gi, "Bearer [REDACTED_TOKEN]"],
  [/(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi, "$1[REDACTED_USER]:[REDACTED_PASS]@"],
];

const KEYED_SECRET_PATTERN =
  /\b(api[_-]?key|token|secret|password|passwd|dsn|cookie|session[_-]?key)\b\s*[:=]\s*([^\s'"]+)/gi;

const ENV_ASSIGNMENT_PATTERN =
  /\b([A-Z][A-Z0-9_]{2,})\b\s*=\s*([^\s"']{6,}|"(?:[^"\\]|\\.)+"|'(?:[^'\\]|\\.)+')/g;

const PRIVATE_KEY_BLOCK_PATTERN =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

function maskEnvValue(value: string): string {
  const quote = value[0];
  if (quote === '"' || quote === "'") {
    return `${quote}[REDACTED]${quote}`;
  }
  return "[REDACTED]";
}

export function redactSensitiveText(input: string): string {
  let text = input;

  text = text.replace(PRIVATE_KEY_BLOCK_PATTERN, "[REDACTED_PRIVATE_KEY_BLOCK]");
  text = text.replace(KEYED_SECRET_PATTERN, (_match, key) => `${String(key)}=[REDACTED]`);
  text = text.replace(ENV_ASSIGNMENT_PATTERN, (_match, key, value) => `${String(key)}=${maskEnvValue(String(value))}`);

  for (const [pattern, replacement] of INLINE_SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }

  return text;
}
