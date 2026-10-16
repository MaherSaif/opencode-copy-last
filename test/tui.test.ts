import { describe, expect, it, vi } from "vitest";
import type { Context } from "@opencode/plugin/tui/context";

// The real TUI entrypoint pulls in the renderer, which is not needed to exercise the plugin.
vi.mock("@opencode/plugin/tui", () => ({ Plugin: { define: (definition: unknown) => definition } }));

const { default: plugin } = await import("../src/tui.js");

type StatusEventPayload = { data: unknown; location?: { directory?: string; workspaceID?: string } };
type Handler = (event: StatusEventPayload) => void;

const SESSION_ID = "ses_1";
const DIRECTORY = "/workspace/project";

function createContext(location: { directory?: string; workspaceID?: string } | undefined = { directory: DIRECTORY }) {
  let handler: Handler | undefined;
  const unsubscribe = vi.fn();
  const show = vi.fn();
  const context = {
    location,
    data: { location: { default: vi.fn(() => location) } },
    client: {
      rpc: vi.fn(() => ({
        events: {
          on: vi.fn((_name: string, next: Handler) => {
            handler = next;
            return unsubscribe;
          }),
        },
      })),
    },
    ui: { toast: { show } },
  } as unknown as Context;

  return { context, show, unsubscribe, emit: (event: StatusEventPayload) => handler?.(event) };
}

function status(overrides: Record<string, unknown> = {}, location: StatusEventPayload["location"] = { directory: DIRECTORY }) {
  return {
    data: { message: "Copied 1 user message to clipboard", variant: "success", sessionID: SESSION_ID, ...overrides },
    location,
  };
}

describe("copy-last TUI plugin", () => {
  it("subscribes to the copy-last status event and returns its unsubscribe function", () => {
    const { context, unsubscribe } = createContext();

    const cleanup = plugin.setup(context);

    expect((context.client.rpc as unknown as ReturnType<typeof vi.fn>)).toBeDefined();
    expect(cleanup).toBe(unsubscribe);
  });

  it("shows a success toast for the session that ran the command", () => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit(status());

    expect(show).toHaveBeenCalledWith({
      message: "Copied 1 user message to clipboard",
      variant: "success",
      sessionID: SESSION_ID,
      duration: 4000,
    });
  });

  it("shows an error toast", () => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit(status({ variant: "error", message: "Unknown argument: bogus" }));

    expect(show).toHaveBeenCalledWith(expect.objectContaining({
      message: "Unknown argument: bogus",
      variant: "error",
      sessionID: SESSION_ID,
    }));
  });

  it("ignores events raised for another location", () => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit(status({}, { directory: "/workspace/other" }));

    expect(show).not.toHaveBeenCalled();
  });

  it("ignores events from another workspace of the same directory", () => {
    const { context, show, emit } = createContext({ directory: DIRECTORY, workspaceID: "ws-1" });

    plugin.setup(context);
    emit(status({}, { directory: DIRECTORY, workspaceID: "ws-2" }));

    expect(show).not.toHaveBeenCalled();
  });

  it("accepts events from the current workspace", () => {
    const { context, show, emit } = createContext({ directory: DIRECTORY, workspaceID: "ws-1" });

    plugin.setup(context);
    emit(status({}, { directory: DIRECTORY, workspaceID: "ws-1" }));

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default location when the plugin has none", () => {
    const { context, show, emit } = createContext(undefined);

    plugin.setup(context);
    emit(status({}, { directory: DIRECTORY }));
    emit(status({}, { directory: "/workspace/other" }));

    expect(show).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a non-object payload", "nope"],
    ["a missing message", { variant: "success", sessionID: SESSION_ID }],
    ["a missing session", { message: "Copied 1 user message", variant: "success" }],
    ["an unknown variant", { message: "Copied 1 user message", variant: "info", sessionID: SESSION_ID }],
  ])("ignores %s", (_label, data) => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit({ data, location: { directory: DIRECTORY } });

    expect(show).not.toHaveBeenCalled();
  });
});
