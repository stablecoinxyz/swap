import {
  type Chain,
  ChainNotFoundError,
  type Client,
  type GetChainParameter,
  type Hex,
  type Transport,
  type PartialBy,
  toHex,
} from "viem";
// import type { PartialBy } from "viem/types/utils";
import type {
  ENTRYPOINT_ADDRESS_V06_TYPE,
  ENTRYPOINT_ADDRESS_V07_TYPE,
  EntryPoint,
  GetEntryPointVersion,
} from "../types/entrypoint";
import type {
  UserOperation,
  UserOperationWithBigIntAsHex,
} from "../types/userOperation";
import { deepHexlify, getEntryPointVersion } from "../utils";
import type {
  Eip7677RpcSchema,
  GetRpcPaymasterDataReturnType,
} from "../types/paymaster";

export type GetPaymasterDataParameters<
  TEntryPoint extends EntryPoint,
  TChain extends Chain | undefined = Chain | undefined,
  TChainOverride extends Chain | undefined = Chain | undefined,
> = {
  userOperation: GetEntryPointVersion<TEntryPoint> extends "v0.6"
    ? PartialBy<UserOperation<"v0.6">, "paymasterAndData" | "signature">
    : PartialBy<
        UserOperation<"v0.7">,
        "signature" | "paymaster" | "paymasterData"
      >;
  entryPoint: TEntryPoint;
  context?: Record<string, unknown>;
} & GetChainParameter<TChain, TChainOverride>;

export type GetPaymasterDataReturnType<TEntryPoint extends EntryPoint> =
  GetEntryPointVersion<TEntryPoint> extends "v0.6"
    ? {
        paymasterAndData: Hex;
      }
    : {
        paymaster: Hex;
        paymasterData: Hex;
      };

export async function getPaymasterData<
  TEntryPoint extends EntryPoint,
  TChain extends Chain | undefined,
  TTransport extends Transport = Transport,
  TChainOverride extends Chain | undefined = Chain | undefined,
>(
  client: Client<TTransport, TChain, undefined, Eip7677RpcSchema<TEntryPoint>>,
  {
    userOperation,
    entryPoint,
    context,
    chain,
  }: GetPaymasterDataParameters<TEntryPoint, TChain, TChainOverride>,
): Promise<GetPaymasterDataReturnType<TEntryPoint>> {
  const chainId = chain?.id ?? client.chain?.id;

  if (!chainId) {
    throw new ChainNotFoundError();
  }

  const params:
    | [
        UserOperationWithBigIntAsHex<GetEntryPointVersion<TEntryPoint>>,
        TEntryPoint,
        Hex,
        Record<string, unknown>,
      ]
    | [
        UserOperationWithBigIntAsHex<GetEntryPointVersion<TEntryPoint>>,
        TEntryPoint,
        Hex,
      ] = context
    ? [
        deepHexlify(userOperation) as UserOperationWithBigIntAsHex<
          GetEntryPointVersion<TEntryPoint>
        >,
        entryPoint,
        toHex(chainId),
        context,
      ]
    : [
        deepHexlify(userOperation) as UserOperationWithBigIntAsHex<
          GetEntryPointVersion<TEntryPoint>
        >,
        entryPoint,
        toHex(chainId),
      ];

  const response = await client.request({
    method: "pm_getPaymasterData",
    params,
  });

  const entryPointVersion = getEntryPointVersion(entryPoint);

  if (entryPointVersion === "v0.6") {
    const responseV06 =
      response as GetRpcPaymasterDataReturnType<ENTRYPOINT_ADDRESS_V06_TYPE>;

    return {
      paymasterAndData: responseV06.paymasterAndData,
    } as GetPaymasterDataReturnType<TEntryPoint>;
  }

  const responseV07 =
    response as GetRpcPaymasterDataReturnType<ENTRYPOINT_ADDRESS_V07_TYPE>;

  return {
    paymaster: responseV07.paymaster,
    paymasterData: responseV07.paymasterData,
  } as GetPaymasterDataReturnType<TEntryPoint>;
}
