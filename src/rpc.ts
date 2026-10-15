import { Rpc } from "@opencode/plugin";

export type CopyLastStatusVariant = "success" | "error";

export const CopyLastRpc = Rpc.define({
  id: "copy-last",
  methods: {},
  events: {
    status: {
      schema: {
        type: "object",
        properties: {
          message: { type: "string" },
          variant: { type: "string", enum: ["success", "error"] },
        },
        required: ["message", "variant"],
        additionalProperties: false,
      },
    },
  },
});