import { describe, expect, it, vi } from "vitest";
import plugin from "../src/index.js";

vi.mock("clipboardy", () => ({
  default: { write: vi.fn(async () => undefined) },
}));

const clipboard = (await import("clipboardy")).default;

interface Registered {
  name: string;
  description?: string;
  execute(input: { sessionID: string; prompt: { text: string } }): Promise<void>;
}

function createContext(messages: unknown[]) {
  const registered: Registered[] = [];
  const emit = vi.fn(async () => undefined);
  const dispose = vi.fn(async () => undefined);
  const context = {
    session: { context: vi.fn(async () => messages) },
    command: {
      transform: vi.fn(async (callback: (editor: { add(definition: Registered): void }) => void) => {
        callback({ add: (definition: Registered) => registered.push(definition) });
      }),
    },
    rpc: {
      register: vi.fn(async () => ({ events: { emit }, dispose })),
    },
  };

  return { context, registered, emit, dispose };
}

const SESSION_MESSAGES = [
  { id: "u1", type: "user", text: "first question", time: { created: 1 } },
  { id: "a1", type: "assistant", content: [{ type: "reasoning", text: "hidden" }, { type: "text", text: "first answer" }] },
  { id: "u2", type: "user", text: "second question", time: { created: 3 } },
  { id: "a2", type: "assistant", content: [{ type: "text", text: "second answer" }] },
];

describe("copy-last plugin", () => {
  it("registers the copy-last command with its usage", async () => {
    const { context, registered } = createContext([]);

    await plugin.setup(context as never);

    expect(registered).toHaveLength(1);
    expect(registered[0].name).toBe("copy-last");
    expect(registered[0].description).toContain("/copy-last [agent|user|pair] [count|all]");
  });

  it("copies the selected messages and publishes a success status", async () => {
    const { context, registered, emit } = createContext(SESSION_MESSAGES);
    await plugin.setup(context as never);

    await registered[0].execute({ sessionID: "session-1", prompt: { text: "user 2" } });

    expect(clipboard.write).toHaveBeenCalledWith("first question\n\n---\n\nsecond question");
    expect(emit).toHaveBeenCalledWith("status", {
      message: "Copied 2 user messages to clipboard",
      variant: "success",
    });
  });

  it("formats pairs with user and agent headings", async () => {
    const { context, registered } = createContext(SESSION_MESSAGES);
    await plugin.setup(context as never);

    await registered[0].execute({ sessionID: "session-1", prompt: { text: "pair 1" } });

    expect(clipboard.write).toHaveBeenCalledWith(
      "## User\n\nsecond question\n\n## Agent\n\nsecond answer",
    );
  });

  it("publishes an error status for unknown arguments", async () => {
    const { context, registered, emit } = createContext(SESSION_MESSAGES);
    await plugin.setup(context as never);

    await registered[0].execute({ sessionID: "session-1", prompt: { text: "bogus" } });

    expect(clipboard.write).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("status", {
      message: "Unknown argument: bogus",
      variant: "error",
    });
  });

  it("disposes the RPC registration on cleanup", async () => {
    const { context, dispose } = createContext([]);
    const cleanup = await plugin.setup(context as never);

    await cleanup?.();

    expect(dispose).toHaveBeenCalled();
  });

  it("keeps the OpenCode 1 entrypoint available", () => {
    expect(typeof plugin.server).toBe("function");
  });
});