import { Plugin } from "@opencode/plugin/tui";
import { CopyLastRpc, type CopyLastStatusVariant } from "./rpc.js";

const TOAST_DURATION_MS = 4000;

interface CopyLastStatus {
  message: string;
  variant: CopyLastStatusVariant;
}

function readStatus(data: unknown): CopyLastStatus | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const { message, variant } = data as { message?: unknown; variant?: unknown };
  if (typeof message !== "string") {
    return undefined;
  }
  if (variant !== "success" && variant !== "error") {
    return undefined;
  }

  return { message, variant };
}

/**
 * Renders the copy outcome as a toast, because an OpenCode 2 server cannot show toasts itself.
 */
export default Plugin.define({
  id: "copy-last.tui",
  setup(context) {
    const copyLast = context.client.rpc(CopyLastRpc);

    return copyLast.events.on("status", (event) => {
      const status = readStatus(event.data);
      if (!status) {
        return;
      }

      context.ui.toast.show({
        message: status.message,
        variant: status.variant,
        duration: TOAST_DURATION_MS,
      });
    });
  },
});