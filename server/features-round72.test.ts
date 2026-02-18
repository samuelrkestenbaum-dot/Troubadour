import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ── Admin Notification Preferences ──

describe("Round 72 – Admin Notification Preferences", () => {
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const dbPath = path.resolve(__dirname, "db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");
  const adminRouterPath = path.resolve(__dirname, "routers/adminRouter.ts");
  const adminRouterContent = fs.readFileSync(adminRouterPath, "utf-8");
  const dashboardPath = path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx");
  const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

  describe("Schema – adminSettings table", () => {
    it("defines adminSettings table with required columns", () => {
      expect(schemaContent).toContain("adminSettings");
      expect(schemaContent).toContain("adminUserId");
      expect(schemaContent).toContain("settingKey");
      expect(schemaContent).toContain("settingValue");
    });

    it("has proper column types for settings", () => {
      expect(schemaContent).toContain("varchar");
      expect(schemaContent).toContain("json");
    });
  });

  describe("DB Helpers – notification preferences", () => {
    it("exports AdminNotificationPreferences interface", () => {
      expect(dbContent).toContain("export interface AdminNotificationPreferences");
    });

    it("defines default notification preferences", () => {
      expect(dbContent).toContain("DEFAULT_ADMIN_NOTIF_PREFS");
      expect(dbContent).toContain("churnAlerts");
      expect(dbContent).toContain("newSignups");
      expect(dbContent).toContain("paymentEvents");
      expect(dbContent).toContain("churnThreshold");
      expect(dbContent).toContain("digestFrequency");
    });

    it("exports getAdminNotificationPrefs function", () => {
      expect(dbContent).toContain("export async function getAdminNotificationPrefs");
    });

    it("exports setAdminNotificationPrefs function", () => {
      expect(dbContent).toContain("export async function setAdminNotificationPrefs");
    });

    it("getAdminNotificationPrefs queries by adminUserId and settingKey", () => {
      expect(dbContent).toContain("notification_preferences");
      expect(dbContent).toContain("adminSettings");
    });

    it("setAdminNotificationPrefs merges with current preferences", () => {
      const setFn = dbContent.substring(dbContent.indexOf("setAdminNotificationPrefs"));
      expect(setFn).toContain("getAdminNotificationPrefs");
      expect(setFn).toContain("merged");
    });
  });

  describe("Admin Router – notification preferences procedures", () => {
    it("has getNotificationPrefs procedure", () => {
      expect(adminRouterContent).toContain("getNotificationPrefs:");
    });

    it("has updateNotificationPrefs procedure", () => {
      expect(adminRouterContent).toContain("updateNotificationPrefs:");
    });

    it("updateNotificationPrefs validates input with zod", () => {
      expect(adminRouterContent).toContain("z.object");
      expect(adminRouterContent).toContain("churnAlerts");
      expect(adminRouterContent).toContain("z.boolean()");
    });

    it("updateNotificationPrefs creates audit log entry", () => {
      const updateSection = adminRouterContent.substring(adminRouterContent.indexOf("updateNotificationPrefs:"));
      expect(updateSection).toContain("createAuditLogEntry");
      expect(updateSection).toContain("update_notification_prefs");
    });
  });

  describe("UI – Admin Settings Tab", () => {
    it("renders AdminSettingsTab component", () => {
      expect(dashboardContent).toContain("AdminSettingsTab");
    });

    it("has notification preference toggles", () => {
      expect(dashboardContent).toContain("Churn Alerts");
      expect(dashboardContent).toContain("New Signup Alerts");
      expect(dashboardContent).toContain("Payment Alerts");
    });

    it("has churn threshold input", () => {
      expect(dashboardContent).toContain("Churn Alert Threshold");
      expect(dashboardContent).toContain("churnThreshold");
    });

    it("has save and cancel buttons", () => {
      expect(dashboardContent).toContain("Save Changes");
      expect(dashboardContent).toContain("Cancel");
    });

    it("shows success toast on save", () => {
      expect(dashboardContent).toContain("Notification preferences saved");
    });

    it("has Settings tab trigger", () => {
      expect(dashboardContent).toContain('value="settings"');
    });
  });
});

// ── User Search / Filter Bar ──

describe("Round 72 – User Search / Filter Bar", () => {
  const adminRouterPath = path.resolve(__dirname, "routers/adminRouter.ts");
  const adminRouterContent = fs.readFileSync(adminRouterPath, "utf-8");
  const dbPath = path.resolve(__dirname, "db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");
  const dashboardPath = path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx");
  const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

  describe("DB Helper – searchAdminUsers", () => {
    it("exports searchAdminUsers function", () => {
      expect(dbContent).toContain("export async function searchAdminUsers");
    });

    it("supports query parameter for name/email search", () => {
      const fn = dbContent.substring(dbContent.indexOf("searchAdminUsers"));
      expect(fn).toContain("query");
      expect(fn).toContain("LIKE");
    });

    it("supports tier filter", () => {
      const fn = dbContent.substring(dbContent.indexOf("searchAdminUsers"));
      expect(fn).toContain("tier");
    });

    it("supports role filter", () => {
      const fn = dbContent.substring(dbContent.indexOf("searchAdminUsers"));
      expect(fn).toContain("role");
    });

    it("supports activity status filter", () => {
      const fn = dbContent.substring(dbContent.indexOf("searchAdminUsers"));
      expect(fn).toContain("active");
    });
  });

  describe("Admin Router – searchUsers procedure", () => {
    it("has searchUsers procedure", () => {
      expect(adminRouterContent).toContain("searchUsers:");
    });

    it("validates search input with zod", () => {
      const searchSection = adminRouterContent.substring(adminRouterContent.indexOf("searchUsers:"));
      expect(searchSection).toContain("z.string()");
    });

    it("is admin-gated", () => {
      expect(adminRouterContent).toContain("assertAdmin");
    });
  });

  describe("UI – UserSearchBar component", () => {
    it("renders UserSearchBar component", () => {
      expect(dashboardContent).toContain("UserSearchBar");
    });

    it("has search input", () => {
      expect(dashboardContent).toContain("Search by name or email");
    });

    it("has tier filter dropdown", () => {
      expect(dashboardContent).toContain("All Tiers");
      expect(dashboardContent).toContain("Free");
      expect(dashboardContent).toContain("Artist");
      expect(dashboardContent).toContain("Pro");
    });

    it("has role filter dropdown", () => {
      expect(dashboardContent).toContain("All Roles");
    });

    it("has activity filter dropdown", () => {
      expect(dashboardContent).toContain("All Activity");
      expect(dashboardContent).toContain("Active (30d)");
      expect(dashboardContent).toContain("Inactive (30d+)");
    });

    it("has clear filters button", () => {
      expect(dashboardContent).toContain("Clear");
    });

    it("shows result count", () => {
      expect(dashboardContent).toContain("result");
    });

    it("search results are clickable to open user detail", () => {
      expect(dashboardContent).toContain("onSelectUser");
    });
  });
});

// ── System Health Dashboard ──

describe("Round 72 – System Health Dashboard", () => {
  const dbPath = path.resolve(__dirname, "db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");
  const adminRouterPath = path.resolve(__dirname, "routers/adminRouter.ts");
  const adminRouterContent = fs.readFileSync(adminRouterPath, "utf-8");
  const dashboardPath = path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx");
  const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

  describe("DB Helper – getSystemHealthMetrics", () => {
    it("exports getSystemHealthMetrics function", () => {
      expect(dbContent).toContain("export async function getSystemHealthMetrics");
    });

    it("returns server uptime", () => {
      const fn = dbContent.substring(dbContent.indexOf("getSystemHealthMetrics"));
      expect(fn).toContain("serverUptime");
      expect(fn).toContain("process.uptime()");
    });

    it("returns database connection status", () => {
      const fn = dbContent.substring(dbContent.indexOf("getSystemHealthMetrics"));
      expect(fn).toContain("databaseConnected");
    });

    it("returns total users, reviews, projects counts", () => {
      const fn = dbContent.substring(dbContent.indexOf("getSystemHealthMetrics"));
      expect(fn).toContain("totalUsers");
      expect(fn).toContain("totalReviews");
      expect(fn).toContain("totalProjects");
    });

    it("returns active and error job counts", () => {
      const fn = dbContent.substring(dbContent.indexOf("getSystemHealthMetrics"));
      expect(fn).toContain("activeJobsCount");
      expect(fn).toContain("errorJobsCount");
    });

    it("returns reviews in last 24h and 7d", () => {
      const fn = dbContent.substring(dbContent.indexOf("getSystemHealthMetrics"));
      expect(fn).toContain("reviewsLast24h");
      expect(fn).toContain("reviewsLast7d");
    });

    it("returns scheduler status", () => {
      const fn = dbContent.substring(dbContent.indexOf("getSystemHealthMetrics"));
      expect(fn).toContain("schedulerStatus");
      expect(fn).toContain("digestScheduler");
      expect(fn).toContain("churnAlertScheduler");
    });
  });

  describe("Admin Router – getSystemHealth procedure", () => {
    it("has getSystemHealth procedure", () => {
      expect(adminRouterContent).toContain("getSystemHealth:");
    });

    it("calls getSystemHealthMetrics", () => {
      expect(adminRouterContent).toContain("getSystemHealthMetrics");
    });
  });

  describe("UI – SystemHealthTab component", () => {
    it("renders SystemHealthTab component", () => {
      expect(dashboardContent).toContain("SystemHealthTab");
    });

    it("has Health tab trigger", () => {
      expect(dashboardContent).toContain('value="health"');
    });

    it("shows database connection status", () => {
      expect(dashboardContent).toContain("Database");
      expect(dashboardContent).toContain("Connected");
    });

    it("shows server uptime", () => {
      expect(dashboardContent).toContain("Server Uptime");
    });

    it("shows active jobs count", () => {
      expect(dashboardContent).toContain("Active Jobs");
      expect(dashboardContent).toContain("activeJobsCount");
    });

    it("shows error jobs count", () => {
      expect(dashboardContent).toContain("Error Jobs");
      expect(dashboardContent).toContain("errorJobsCount");
    });

    it("shows platform metrics", () => {
      expect(dashboardContent).toContain("Platform Metrics");
      expect(dashboardContent).toContain("Total Users");
      expect(dashboardContent).toContain("Total Reviews");
      expect(dashboardContent).toContain("Reviews (7d)");
      expect(dashboardContent).toContain("Avg Reviews/User");
    });

    it("shows scheduler status", () => {
      expect(dashboardContent).toContain("Scheduler Status");
      expect(dashboardContent).toContain("Digest Scheduler");
      expect(dashboardContent).toContain("Churn Alert Scheduler");
    });

    it("has refresh button", () => {
      expect(dashboardContent).toContain("Refresh");
      expect(dashboardContent).toContain("refetch");
    });

    it("auto-refreshes every 30 seconds", () => {
      expect(dashboardContent).toContain("refetchInterval: 30000");
    });
  });
});

// ── Integration Tests ──

describe("Round 72 – Integration", () => {
  const dashboardPath = path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx");
  const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

  it("AdminDashboard has 6 tabs: Users, Audit, Revenue, Activity, Health, Settings", () => {
    expect(dashboardContent).toContain('value="users"');
    expect(dashboardContent).toContain('value="audit"');
    expect(dashboardContent).toContain('value="revenue"');
    expect(dashboardContent).toContain('value="activity"');
    expect(dashboardContent).toContain('value="health"');
    expect(dashboardContent).toContain('value="settings"');
  });

  it("UserSearchBar is placed in the Users tab before the user table", () => {
    const searchBarIdx = dashboardContent.indexOf("UserSearchBar");
    const userTableIdx = dashboardContent.indexOf("All Users");
    expect(searchBarIdx).toBeLessThan(userTableIdx);
  });

  it("SystemHealthTab uses proper return type field names", () => {
    expect(dashboardContent).toContain("activeJobsCount");
    expect(dashboardContent).toContain("errorJobsCount");
    expect(dashboardContent).toContain("reviewsLast7d");
    expect(dashboardContent).not.toContain("d.activeJobs ");
    expect(dashboardContent).not.toContain("d.errorJobs ");
  });

  it("AdminSettingsTab uses correct preference field names", () => {
    expect(dashboardContent).toContain("newSignups");
    expect(dashboardContent).toContain("paymentEvents");
    expect(dashboardContent).toContain("digestFrequency");
  });

  it("imports all required lucide icons", () => {
    expect(dashboardContent).toContain("Search");
    expect(dashboardContent).toContain("Settings");
    expect(dashboardContent).toContain("Server");
    expect(dashboardContent).toContain("RefreshCw");
    expect(dashboardContent).toContain("Clock");
    expect(dashboardContent).toContain("AlertTriangle");
  });

  it("imports Input and Select components", () => {
    expect(dashboardContent).toContain("import { Input }");
    expect(dashboardContent).toContain("import { Select");
  });
});
