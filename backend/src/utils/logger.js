const timestamp = () => new Date().toISOString();

export const logError = (context, error, meta = {}) => {
  const entry = {
    level: "error",
    timestamp: timestamp(),
    context,
    message: error?.message ?? String(error),
    statusCode: error?.statusCode,
    name: error?.name,
    ...meta,
  };

  if (process.env.NODE_ENV === "development") {
    console.error(
      `[ERROR] ${entry.timestamp} | ${context} | ${entry.message}`,
      meta
    );
    if (error?.stack) {
      console.error(error.stack);
    }
    return;
  }

  console.error(JSON.stringify({ ...entry, stack: error?.stack }));
};

export const logInfo = (message, meta = {}) => {
  const entry = {
    level: "info",
    timestamp: timestamp(),
    message,
    ...meta,
  };

  if (process.env.NODE_ENV === "development") {
    console.log(`[INFO] ${entry.timestamp} | ${message}`, meta);
    return;
  }

  console.log(JSON.stringify(entry));
};
