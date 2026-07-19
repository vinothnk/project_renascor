type LogLevel = "info" | "error";

type LogContext = Record<string, string | number | boolean | null | undefined>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" || typeof code === "number" ? String(code) : undefined;
  }

  return undefined;
}

function writeLog(level: LogLevel, event: string, context: LogContext = {}) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...Object.fromEntries(
      Object.entries(context).filter(([, value]) => value !== undefined),
    ),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  console.info(line);
}

export function logInfo(event: string, context?: LogContext) {
  writeLog("info", event, context);
}

export function logError(
  event: string,
  error: unknown,
  context: LogContext = {},
) {
  writeLog("error", event, {
    ...context,
    error: errorMessage(error),
    code: errorCode(error),
  });
}
