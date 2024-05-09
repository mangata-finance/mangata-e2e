import { getMangataInstance } from "./api";
import { EthUser } from "./EthUser";
import { User } from "./User";
import BN from "bn.js";

export async function rolldownDeposit(
  requestNumber: number,
  ethAddress: string,
  amountValue: number,
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();

  const extrinsic = sdkApi.tx.rolldown.updateL2FromL1({
    pendingDeposits: sdkApi.createType("Vec<PalletRolldownMessagesDeposit>", [
      {
        requestId: sdkApi.createType("PalletRolldownMessagesRequestId", [
          "L1",
          requestNumber,
        ]),
        depositRecipient: ethAddress,
        tokenAddress: ethAddress,
        amount: amountValue,
        blockHash: ethAddress + "000000000000000000000000",
      },
    ]),
  });
  return extrinsic;
}

export async function getLastProcessedRequestNumber() {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();

  const value = JSON.parse(
    JSON.stringify(
      await sdkApi.query.rolldown.lastProcessedRequestOnL2("Ethereum"),
    ),
  );
  const valueNumber = +value;
  return valueNumber;
}

export async function rolldownWithdraw(
  EthUser: EthUser | User,
  amountValue: BN | number,
  tokenAddress: string = "",
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();
  const address = tokenAddress === "" ? EthUser.toString() : tokenAddress;

  const extrinsic = sdkApi.tx.rolldown.withdraw(
    EthUser.toString(),
    address,
    amountValue,
  );
  return extrinsic;
}
