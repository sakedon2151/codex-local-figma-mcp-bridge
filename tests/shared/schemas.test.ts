import { commandDslSchema, protocolMessageSchema } from "@shared/schemas";

const sentAt = "2026-04-26T00:00:00.000Z";

describe("protocol message schema", () => {
  it("accepts supported protocol message types with matching payloads", () => {
    const result = protocolMessageSchema.safeParse({
      version: 1,
      id: "msg_plugin_hello_01",
      type: "plugin.hello",
      sessionId: "ses_test",
      sentAt,
      payload: {
        pairingToken: "123456",
        pluginVersion: "0.1.0",
        editorType: "figma",
        capabilities: ["read", "mutate", "batch", "progress"]
      }
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported protocol versions", () => {
    const result = protocolMessageSchema.safeParse({
      version: 2,
      id: "msg_ping_01",
      type: "heartbeat.ping",
      sessionId: "ses_test",
      sentAt,
      payload: {
        pluginUptimeMs: 5000
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown message types", () => {
    const result = protocolMessageSchema.safeParse({
      version: 1,
      id: "msg_unknown_01",
      type: "channel.join",
      sessionId: "ses_test",
      sentAt,
      payload: {}
    });

    expect(result.success).toBe(false);
  });
});

describe("command DSL schema", () => {
  it.each(["readNode", "readTree", "createNode", "updateNode", "deleteNode", "batch"])(
    "accepts the %s command",
    (type) => {
      const examples: Record<string, unknown> = {
        readNode: {
          type: "readNode",
          target: { nodeId: "123:456" },
          options: { maxDepth: 2, includeHidden: false, includeGeometry: false }
        },
        readTree: {
          type: "readTree",
          options: { maxDepth: 2, maxNodes: 200, includeHidden: false }
        },
        createNode: {
          type: "createNode",
          payload: { type: "FRAME", name: "Card", x: 0, y: 0, width: 320, height: 180 }
        },
        updateNode: {
          type: "updateNode",
          target: { nodeId: "123:456" },
          payload: { name: "Primary CTA", x: 120, y: 80, visible: true }
        },
        deleteNode: {
          type: "deleteNode",
          target: { nodeId: "123:456" }
        },
        batch: {
          type: "batch",
          payload: {
            operations: [{ type: "deleteNode", target: { nodeId: "123:456" } }],
            options: { dryRun: false, stopOnError: true }
          }
        }
      };

      expect(commandDslSchema.safeParse(examples[type]).success).toBe(true);
    }
  );

  it("rejects unsupported node types", () => {
    const result = commandDslSchema.safeParse({
      type: "createNode",
      payload: { type: "VECTOR", name: "Vector" }
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown update properties", () => {
    const result = commandDslSchema.safeParse({
      type: "updateNode",
      target: { nodeId: "123:456" },
      payload: { name: "Card", unsafeScript: "figma.closePlugin()" }
    });

    expect(result.success).toBe(false);
  });

  it("rejects batches with more than 100 operations", () => {
    const result = commandDslSchema.safeParse({
      type: "batch",
      payload: {
        operations: Array.from({ length: 101 }, (_, index) => ({
          type: "deleteNode",
          target: { nodeId: `123:${index}` }
        }))
      }
    });

    expect(result.success).toBe(false);
  });
});
