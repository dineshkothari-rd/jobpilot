import type { Instrumentation } from "next";
// Keep correlation useful without logging URLs, headers, bodies, error messages or user data.
export const onRequestError: Instrumentation.onRequestError = (
  error,
  _request,
  context,
) => {
  console.error(
    JSON.stringify({
      event: "jobpilot_request_error",
      digest:
        typeof error === "object" &&
        error !== null &&
        "digest" in error &&
        typeof error.digest === "string" &&
        /^\d{1,30}$/.test(error.digest)
          ? error.digest
          : "unavailable",
      route: context.routePath,
      kind: context.routeType,
    }),
  );
};
