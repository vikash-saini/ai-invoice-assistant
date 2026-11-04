import { AppError } from "../utils/app-error";

export const MAX_CHAT_MESSAGE_LENGTH = 4_000;

export function validateChatMessage(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError("Message must be a string", 400);
  }

  const message = value.trim();
  if (!message) {
    throw new AppError("Message cannot be empty", 400);
  }

  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new AppError(
      `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`,
      400
    );
  }

  return message;
}
