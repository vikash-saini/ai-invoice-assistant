import { describe, expect, it } from "vitest";
import { MAX_CHAT_MESSAGE_LENGTH, validateChatMessage } from "../../src/services/chat-message.validation";

describe("validateChatMessage", () => {
  it("trims valid messages", () => {
    expect(validateChatMessage("  What is the total?  ")).toBe("What is the total?");
  });

  it.each(["", "   ", null, undefined, 42, {}])("rejects invalid message %s", (value) => {
    expect(() => validateChatMessage(value)).toThrow();
  });

  it("enforces the message length limit", () => {
    expect(() => validateChatMessage("x".repeat(MAX_CHAT_MESSAGE_LENGTH + 1))).toThrow(
      `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`
    );
  });
});
