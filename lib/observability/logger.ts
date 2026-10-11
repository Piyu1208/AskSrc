import "server-only";

type LogLevel = "info" | "warn" | "error";

type LogData = Record<string, unknown>;

export function log(
  level: LogLevel,
  event: string,
  data: LogData = {}
) {
  console[level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...data,
    })
  );
}
