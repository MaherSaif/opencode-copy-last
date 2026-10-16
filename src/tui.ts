import { Plugin } from "@opencode/plugin/tui";
import { CopyLastRpc, type CopyLastStatus } from "./rpc.js";

const TOAST_DURATION_MS = 4000;

interface StatusEvent {
  readonly data: unknown;
  readonly location?: { directory?: string; workspaceID?: string };
}

function readStatus(data: unknown): CopyLastStatus | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const { message, variant, sessionID } = data as Partial<Record<keyof CopyLastStatus, unknown>>;
  if (typeof message !== "string" || typeof sessionID !== "string") {
    return undefined;
  }
  if (variant !== "success" && variant !== "error") {
    return undefined;
  }

  return { message, variant, sessionID };
}

/**
 * RPC events are broadcast to every connected location, so events raised by another
 * workspace are ignored.
 */
function isCurrentLocation(
  current: { directory?: string; workspaceID?: string } | undefined,
  event: StatusEvent,
): boolean {
  if (!current?.directory) {
    return true;
  }

  return current.directory === event.location?.directory
    && (current.workspaceID ?? undefined) === (event.location?.workspaceID ?? undefined);
}

/**
 * Renders the copy outcome as a toast, because an OpenCode 2 server cannot show toasts itself.
 */
export default Plugin.define({
  id: "copy-last.tui",
  setup(context) {
    const copyLast = context.client.rpc(CopyLastRpc);
    const current = context.location ?? context.data.location.default();

    return copyLast.events.on("status", (event) => {
      if (!isCurrentLocation(current, event as StatusEvent)) {
        return;
      }

      const status = readStatus(event.data);
      if (!status) {
        return;
      }

      context.ui.toast.show({
        message: status.message,
        variant: status.variant,
        sessionID: status.sessionID,
        duration: TOAST_DURATION_MS,
      });
    });
  },
});
