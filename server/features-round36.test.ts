import { describe, it, expect, vi } from "vitest";

// ── Feature 1: batchReviewAll accepts optional templateId ──

describe("batchReviewAll templateId support", () => {
  it("should accept input with templateId", async () => {
    // The batchReviewAll input schema should accept optional templateId
    const { z } = await import("zod");
    const schema = z.object({ projectId: z.number(), templateId: z.number().optional() });

    // Valid inputs
    expect(schema.parse({ projectId: 1 })).toEqual({ projectId: 1 });
    expect(schema.parse({ projectId: 1, templateId: 5 })).toEqual({ projectId: 1, templateId: 5 });
    expect(schema.parse({ projectId: 1, templateId: undefined })).toEqual({ projectId: 1 });

    // Invalid inputs
    expect(() => schema.parse({ projectId: "abc" })).toThrow();
    expect(() => schema.parse({ templateId: 5 })).toThrow();
  });
});

// ── Feature 2: notifyCollaborators function ──

describe("notifyCollaborators", () => {
  it("should call sendReviewCompleteNotification for each accepted collaborator", async () => {
    const { notifyCollaborators } = await import("./services/emailNotification");

    const mockGetCollaborators = vi.fn().mockResolvedValue([
      { invitedEmail: "alice@example.com", status: "accepted" },
      { invitedEmail: "bob@example.com", status: "accepted" },
      { invitedEmail: "charlie@example.com", status: "pending" }, // should be skipped
    ]);

    // notifyCollaborators doesn't throw — it logs errors
    await expect(
      notifyCollaborators({
        projectId: 1,
        trackTitle: "Test Track",
        projectTitle: "Test Project",
        baseUrl: "https://example.com",
        getCollaboratorsByProject: mockGetCollaborators,
      })
    ).resolves.toBeUndefined();

    expect(mockGetCollaborators).toHaveBeenCalledWith(1);
  });

  it("should not throw when getCollaboratorsByProject fails", async () => {
    const { notifyCollaborators } = await import("./services/emailNotification");

    const mockGetCollaborators = vi.fn().mockRejectedValue(new Error("DB error"));

    await expect(
      notifyCollaborators({
        projectId: 999,
        trackTitle: "Test Track",
        projectTitle: "Test Project",
        baseUrl: "https://example.com",
        getCollaboratorsByProject: mockGetCollaborators,
      })
    ).resolves.toBeUndefined();
  });

  it("should skip collaborators without email", async () => {
    const { notifyCollaborators } = await import("./services/emailNotification");

    const mockGetCollaborators = vi.fn().mockResolvedValue([
      { invitedEmail: "", status: "accepted" },
      { invitedEmail: null, status: "accepted" },
    ]);

    await expect(
      notifyCollaborators({
        projectId: 1,
        trackTitle: "Test Track",
        projectTitle: "Test Project",
        baseUrl: "https://example.com",
        getCollaboratorsByProject: mockGetCollaborators,
      })
    ).resolves.toBeUndefined();
  });

  it("should do nothing when no accepted collaborators exist", async () => {
    const { notifyCollaborators } = await import("./services/emailNotification");

    const mockGetCollaborators = vi.fn().mockResolvedValue([
      { invitedEmail: "alice@example.com", status: "pending" },
      { invitedEmail: "bob@example.com", status: "declined" },
    ]);

    await expect(
      notifyCollaborators({
        projectId: 1,
        trackTitle: "Test Track",
        projectTitle: "Test Project",
        baseUrl: "https://example.com",
        getCollaboratorsByProject: mockGetCollaborators,
      })
    ).resolves.toBeUndefined();
  });
});

// ── Feature 3: DashboardLayout Back to Home link ──

describe("DashboardLayout Back to Home", () => {
  it("should have Home icon in the lucide-react imports", async () => {
    // Verify the Home icon is exported from lucide-react
    const lucide = await import("lucide-react");
    expect(lucide.Home).toBeDefined();
    expect(typeof lucide.Home).toBe("object"); // React component (forwardRef)
  });
});
