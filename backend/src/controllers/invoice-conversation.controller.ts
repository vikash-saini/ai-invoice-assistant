import type { Request, Response } from "express";
import type { MultiInvoiceChatService } from "../services/multi-invoice-chat.service";

export class InvoiceConversationController {
  constructor(private readonly conversations: MultiInvoiceChatService) {}

  list = (_req: Request, res: Response): void => {
    res.status(200).json({ success: true, data: this.conversations.listConversations() });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body;
    const message = typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { message?: unknown }).message
      : undefined;
    const result = await this.conversations.createConversation(message);
    res.status(201).json({
      success: true,
      data: { conversation: result.conversation, ...result.exchange },
    });
  };

  get = (req: Request, res: Response): void => {
    res.status(200).json({ success: true, data: this.conversations.getConversation(req.params.conversationId) });
  };

  sendMessage = async (req: Request, res: Response): Promise<void> => {
    const body = req.body;
    const message = typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { message?: unknown }).message
      : undefined;
    const result = await this.conversations.sendMessage(req.params.conversationId, message);
    res.status(201).json({
      success: true,
      data: { conversationId: result.conversationId, ...result.exchange },
    });
  };
}
