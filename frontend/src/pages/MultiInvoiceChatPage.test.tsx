import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "../services/api.service";
import { MultiInvoiceChatPage } from "./MultiInvoiceChatPage";

vi.mock("../services/api.service", () => ({ apiService: {
  listInvoiceConversations: vi.fn(),
  getInvoiceConversation: vi.fn(),
  createInvoiceConversation: vi.fn(),
  sendInvoiceConversationMessage: vi.fn(),
} }));

const conversation = {
  id: "conversation-1",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:05:00.000Z",
  title: "What is the total amount?",
  latestMessagePreview: "Latest assistant response excerpt",
};

function message(id: string, role: "user" | "assistant", content: string, references: Array<{ invoiceId: string; fileName: string; invoiceNumber: string | null }> = []) {
  return { id, conversationId: conversation.id, role, content, references, createdAt: "2026-10-01T10:05:00.000Z" };
}

const conversationApi = vi.mocked(apiService);

describe("MultiInvoiceChatPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    conversationApi.listInvoiceConversations.mockResolvedValue([]);
    conversationApi.getInvoiceConversation.mockReset();
    conversationApi.createInvoiceConversation.mockReset();
    conversationApi.sendInvoiceConversationMessage.mockReset();
  });

  it("shows the initial empty state when no conversation is selected", async () => {
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    expect(await screen.findByText("Ask across your invoices")).toBeInTheDocument();
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();
  });

  it("creates a conversation on the first submitted message", async () => {
    const user = userEvent.setup();
    conversationApi.listInvoiceConversations.mockResolvedValue([conversation]);
    conversationApi.createInvoiceConversation.mockResolvedValue({
      conversation,
      userMessage: message("user-1", "user", "Show my invoice total"),
      assistantMessage: message("assistant-1", "assistant", "The total is USD 100."),
    });
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /Message the AI Invoice Assistant/ });
    await user.type(input, "Show my invoice total");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("The total is USD 100.")).toBeInTheDocument();
    expect(conversationApi.createInvoiceConversation).toHaveBeenCalledWith("Show my invoice total");
    expect(await screen.findByRole("button", { name: /What is the total amount/ })).toHaveAttribute("aria-current", "true");
    await user.click(screen.getByRole("button", { name: /New chat/ }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue("");
  });

  it("preserves a failed first-message draft and does not add a sidebar conversation", async () => {
    const user = userEvent.setup();
    conversationApi.createInvoiceConversation.mockRejectedValue(new Error("Could not reach the backend. Check that the API server is running."));
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /Message the AI Invoice Assistant/ });
    await user.type(input, "Retry this question");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the backend");
    expect(input).toHaveValue("Retry this question");
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.queryByText("Preparing an answer…")).not.toBeInTheDocument();
  });

  it("uses the existing conversation ID for a follow-up", async () => {
    const user = userEvent.setup();
    conversationApi.createInvoiceConversation.mockResolvedValue({ conversation, userMessage: message("u1", "user", "First"), assistantMessage: message("a1", "assistant", "First answer") });
    conversationApi.sendInvoiceConversationMessage.mockResolvedValue({ conversationId: conversation.id, userMessage: message("u2", "user", "Follow up"), assistantMessage: message("a2", "assistant", "Follow-up answer") });
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /Message the AI Invoice Assistant/ });
    await user.type(input, "First");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("First answer");
    await user.type(input, "Follow up");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Follow-up answer")).toBeInTheDocument();
    expect(conversationApi.sendInvoiceConversationMessage).toHaveBeenCalledWith(conversation.id, "Follow up");
  });

  it("loads existing conversation history and opens its invoice references", async () => {
    const user = userEvent.setup();
    const reference = { invoiceId: "invoice-42", fileName: "sample.pdf", invoiceNumber: "INV-42" };
    conversationApi.listInvoiceConversations.mockResolvedValue([conversation]);
    conversationApi.getInvoiceConversation.mockResolvedValue({ ...conversation, messages: [message("u1", "user", "Find this invoice"), message("a1", "assistant", "Found it.", [reference])] });
    const onOpenInvoice = vi.fn();
    render(<MultiInvoiceChatPage onOpenInvoice={onOpenInvoice} />);
    await user.click(await screen.findByRole("button", { name: /What is the total amount/ }));
    expect(await screen.findByText("Found it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /What is the total amount/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Latest assistant response excerpt/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sample.pdf · INV-42" }));
    expect(onOpenInvoice).toHaveBeenCalledWith("invoice-42");
    expect(conversationApi.getInvoiceConversation).toHaveBeenCalledWith(conversation.id);
  });

  it("keeps cached messages visible and shows a retry banner when refreshing fails", async () => {
    const user = userEvent.setup();
    const originalMessages = [message("u1", "user", "Original question"), message("a1", "assistant", "Cached answer")];
    conversationApi.listInvoiceConversations.mockResolvedValue([conversation]);
    conversationApi.getInvoiceConversation
      .mockResolvedValueOnce({ ...conversation, messages: originalMessages })
      .mockRejectedValueOnce(new Error("Backend unavailable"))
      .mockResolvedValueOnce({ ...conversation, messages: [message("u1", "user", "Original question"), message("a1", "assistant", "Updated answer")] });
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    const conversationButton = await screen.findByRole("button", { name: /What is the total amount/ });
    await user.click(conversationButton);
    expect(await screen.findByText("Cached answer")).toBeInTheDocument();

    await user.click(conversationButton);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not refresh this conversation");
    expect(screen.getByText("Cached answer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Updated answer")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows cached messages for the newly selected conversation, not the previous one", async () => {
    const user = userEvent.setup();
    const second = { ...conversation, id: "conversation-2", title: "Second conversation", latestMessagePreview: "A later reply" };
    let resolveRefresh!: (value: Awaited<ReturnType<typeof apiService.getInvoiceConversation>>) => void;
    conversationApi.listInvoiceConversations.mockResolvedValue([conversation, second]);
    conversationApi.getInvoiceConversation
      .mockResolvedValueOnce({ ...conversation, messages: [message("a-user", "user", "Question A"), message("a-answer", "assistant", "Answer A")] })
      .mockResolvedValueOnce({ ...second, messages: [message("b-user", "user", "Question B"), message("b-answer", "assistant", "Answer B")] })
      .mockResolvedValueOnce({ ...conversation, messages: [message("a-user", "user", "Question A"), message("a-answer", "assistant", "Answer A")] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /What is the total amount/ }));
    expect(await screen.findByText("Answer A")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Second conversation/ }));
    expect(await screen.findByText("Answer B")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /What is the total amount/ }));
    expect(await screen.findByText("Answer A")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Second conversation/ }));
    expect(screen.getByText("Answer B")).toBeInTheDocument();
    expect(screen.queryByText("Answer A")).not.toBeInTheDocument();
    resolveRefresh({ ...second, messages: [message("b-user", "user", "Question B"), message("b-answer", "assistant", "Refreshed answer B")] });
    expect(await screen.findByText("Refreshed answer B")).toBeInTheDocument();
  });

  it("does not show an empty conversation state when an unseen conversation cannot load", async () => {
    const user = userEvent.setup();
    conversationApi.listInvoiceConversations.mockResolvedValue([conversation]);
    conversationApi.getInvoiceConversation.mockRejectedValue(new Error("Backend unavailable"));
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /What is the total amount/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this conversation");
    expect(screen.queryByText("Ask across your invoices")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows API errors without removing existing messages", async () => {
    const user = userEvent.setup();
    conversationApi.createInvoiceConversation.mockResolvedValue({ conversation, userMessage: message("u1", "user", "First"), assistantMessage: message("a1", "assistant", "Saved answer") });
    conversationApi.sendInvoiceConversationMessage.mockRejectedValue(new Error("Service unavailable"));
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /Message the AI Invoice Assistant/ });
    await user.type(input, "First");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Saved answer")).toBeInTheDocument();
    await user.type(input, "Second question");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByText("Saved answer")).toBeInTheDocument();
    expect(input).toHaveValue("Second question");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("prevents duplicate submissions while a request is pending", async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: Awaited<ReturnType<typeof apiService.createInvoiceConversation>>) => void;
    conversationApi.createInvoiceConversation.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    render(<MultiInvoiceChatPage onOpenInvoice={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /Message the AI Invoice Assistant/ });
    await user.type(input, "Only send once");
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.click(send);
    expect(await screen.findByRole("status")).toHaveTextContent("Preparing an answer");
    expect(send).toBeDisabled();
    expect(conversationApi.createInvoiceConversation).toHaveBeenCalledTimes(1);
    resolveCreate({ conversation, userMessage: message("u1", "user", "Only send once"), assistantMessage: message("a1", "assistant", "Done") });
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
  });
});
