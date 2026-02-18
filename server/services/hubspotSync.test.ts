import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ENV
vi.mock("../_core/env", () => ({
  ENV: {
    hubspotAccessToken: "test-hubspot-token-12345",
  },
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  findContactByEmail,
  findContactByUserId,
  syncSubscriberToHubSpot,
  updateSubscriberTier,
  logSubscriptionEvent,
  isHubSpotConfigured,
} from "./hubspotSync";

describe("HubSpot Sync Service", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isHubSpotConfigured", () => {
    it("returns true when access token is set", () => {
      expect(isHubSpotConfigured()).toBe(true);
    });
  });

  describe("findContactByEmail", () => {
    it("returns contact when found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          results: [{
            id: "123",
            properties: {
              email: "alice@example.com",
              firstname: "Alice",
              lastname: "Smith",
              troubadour_tier: "pro",
            },
          }],
        }),
      });

      const contact = await findContactByEmail("alice@example.com");

      expect(contact).not.toBeNull();
      expect(contact!.id).toBe("123");
      expect(contact!.properties.email).toBe("alice@example.com");

      // Verify correct API call
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/search");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer test-hubspot-token-12345");

      const body = JSON.parse(options.body);
      expect(body.filterGroups[0].filters[0].propertyName).toBe("email");
      expect(body.filterGroups[0].filters[0].value).toBe("alice@example.com");
    });

    it("returns null when not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, results: [] }),
      });

      const contact = await findContactByEmail("nobody@example.com");
      expect(contact).toBeNull();
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      });

      const contact = await findContactByEmail("alice@example.com");
      expect(contact).toBeNull();
    });
  });

  describe("findContactByUserId", () => {
    it("searches by troubadour_user_id property", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          results: [{
            id: "456",
            properties: { troubadour_user_id: "42" },
          }],
        }),
      });

      const contact = await findContactByUserId(42);
      expect(contact).not.toBeNull();
      expect(contact!.id).toBe("456");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.filterGroups[0].filters[0].propertyName).toBe("troubadour_user_id");
      expect(body.filterGroups[0].filters[0].value).toBe("42");
    });
  });

  describe("syncSubscriberToHubSpot", () => {
    it("creates a new contact when none exists", async () => {
      // First call: search returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, results: [] }),
      });

      // Second call: create contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: "789",
          properties: { email: "bob@example.com" },
        }),
      });

      const result = await syncSubscriberToHubSpot({
        userId: 1,
        email: "bob@example.com",
        name: "Bob Jones",
        tier: "artist",
        signupDate: new Date("2026-01-15"),
      });

      expect(result.success).toBe(true);
      expect(result.contactId).toBe("789");
      expect(result.action).toBe("created");

      // Verify create call
      const createCall = mockFetch.mock.calls[1];
      expect(createCall[0]).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
      const body = JSON.parse(createCall[1].body);
      expect(body.properties.email).toBe("bob@example.com");
      expect(body.properties.firstname).toBe("Bob");
      expect(body.properties.lastname).toBe("Jones");
      expect(body.properties.troubadour_tier).toBe("artist");
      expect(body.properties.troubadour_user_id).toBe("1");
      expect(body.properties.troubadour_mrr).toBe("19"); // $19/mo
      expect(body.properties.troubadour_signup_date).toBe("2026-01-15");
    });

    it("updates an existing contact when found by email", async () => {
      // First call: search returns existing contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          results: [{
            id: "existing-123",
            properties: { email: "bob@example.com", troubadour_tier: "free" },
          }],
        }),
      });

      // Second call: update contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "existing-123",
          properties: { email: "bob@example.com", troubadour_tier: "pro" },
        }),
      });

      const result = await syncSubscriberToHubSpot({
        userId: 1,
        email: "bob@example.com",
        tier: "pro",
      });

      expect(result.success).toBe(true);
      expect(result.contactId).toBe("existing-123");
      expect(result.action).toBe("updated");

      // Verify PATCH call
      const updateCall = mockFetch.mock.calls[1];
      expect(updateCall[0]).toBe("https://api.hubapi.com/crm/v3/objects/contacts/existing-123");
      expect(updateCall[1].method).toBe("PATCH");
    });

    it("calculates correct MRR for each tier", async () => {
      // Test pro tier MRR
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, results: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "1", properties: {} }),
      });

      await syncSubscriberToHubSpot({
        userId: 1,
        email: "pro@example.com",
        tier: "pro",
      });

      const proBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(proBody.properties.troubadour_mrr).toBe("49"); // $49/mo

      // Test free tier MRR
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, results: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "2", properties: {} }),
      });

      await syncSubscriberToHubSpot({
        userId: 2,
        email: "free@example.com",
        tier: "free",
      });

      const freeBody = JSON.parse(mockFetch.mock.calls[3][1].body);
      expect(freeBody.properties.troubadour_mrr).toBe("0");
    });
  });

  describe("updateSubscriberTier", () => {
    it("updates tier for existing contact found by userId", async () => {
      // Search by userId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          results: [{ id: "contact-100", properties: {} }],
        }),
      });

      // PATCH update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "contact-100", properties: {} }),
      });

      const result = await updateSubscriberTier({
        userId: 5,
        newTier: "pro",
        previousTier: "artist",
      });

      expect(result.success).toBe(true);

      const patchBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(patchBody.properties.troubadour_tier).toBe("pro");
      expect(patchBody.properties.troubadour_mrr).toBe("49");
    });

    it("falls back to email search when userId not found", async () => {
      // Search by userId returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, results: [] }),
      });

      // Search by email returns contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          results: [{ id: "contact-200", properties: {} }],
        }),
      });

      // PATCH update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "contact-200", properties: {} }),
      });

      const result = await updateSubscriberTier({
        userId: 5,
        email: "fallback@example.com",
        newTier: "free",
      });

      expect(result.success).toBe(true);
    });

    it("returns error when contact not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, results: [] }),
      });

      const result = await updateSubscriberTier({
        userId: 999,
        newTier: "pro",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("logSubscriptionEvent", () => {
    it("creates a note engagement on the contact", async () => {
      // Search by userId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          results: [{ id: "contact-300", properties: {} }],
        }),
      });

      // Create note
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "note-1" }),
      });

      const result = await logSubscriptionEvent({
        userId: 10,
        eventType: "upgrade",
        details: "artist → pro",
      });

      expect(result.success).toBe(true);

      const noteCall = mockFetch.mock.calls[1];
      expect(noteCall[0]).toBe("https://api.hubapi.com/crm/v3/objects/notes");
      const body = JSON.parse(noteCall[1].body);
      expect(body.properties.hs_note_body).toContain("UPGRADE");
      expect(body.properties.hs_note_body).toContain("artist → pro");
      expect(body.associations[0].to.id).toBe("contact-300");
    });
  });
});

describe("HubSpot Sync Service — error handling", () => {
  it("handles network failures gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const contact = await findContactByEmail("fail@example.com");
    expect(contact).toBeNull();
  });

  it("handles 500 server errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal Server Error" }),
    });

    const contact = await findContactByEmail("error@example.com");
    expect(contact).toBeNull();
  });
});
