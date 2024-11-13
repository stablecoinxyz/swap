import { toHex } from "viem";
import type { EntryPoint, GetEntryPointVersion } from "./types/entrypoint";
import type {
  ENTRYPOINT_ADDRESS_V06_TYPE,
  ENTRYPOINT_ADDRESS_V07_TYPE,
} from "./types/entrypoint";

export const transactionReceiptStatus = {
  "0x0": "reverted",
  "0x1": "success",
} as const;

// biome-ignore lint/suspicious/noExplicitAny: it's a recursive function, so it's hard to type
export function deepHexlify(obj: any): any {
  if (typeof obj === "function") {
    return undefined;
  }
  if (obj == null || typeof obj === "string" || typeof obj === "boolean") {
    return obj;
  }

  if (typeof obj === "bigint") {
    return toHex(obj);
  }

  if (obj._isBigNumber != null || typeof obj !== "object") {
    return toHex(obj).replace(/^0x0/, "0x");
  }
  if (Array.isArray(obj)) {
    return obj.map((member) => deepHexlify(member));
  }
  return Object.keys(obj).reduce(
    // biome-ignore lint/suspicious/noExplicitAny: it's a recursive function, so it's hard to type
    (set: any, key: string) => {
      set[key] = deepHexlify(obj[key]);
      return set;
    },
    {},
  );
}

export const getEntryPointVersion = (
  entryPoint: EntryPoint,
): GetEntryPointVersion<EntryPoint> =>
  entryPoint === ENTRYPOINT_ADDRESS_V06 ? "v0.6" : "v0.7";

export const ENTRYPOINT_ADDRESS_V06: ENTRYPOINT_ADDRESS_V06_TYPE =
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
export const ENTRYPOINT_ADDRESS_V07: ENTRYPOINT_ADDRESS_V07_TYPE =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
