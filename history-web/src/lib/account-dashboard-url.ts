const PROD_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DUMPY_ACCOUNT_DASHBOARD_URL ?? "https://app.dumpy.ai/dashboard";
const LOCAL_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DUMPY_LOCAL_ACCOUNT_DASHBOARD_URL ?? "http://localhost:edge/dashboard";

export function getAccountDashboardUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return LOCAL_DASHBOARD_URL;
  }

  return PROD_DASHBOARD_URL;
}
