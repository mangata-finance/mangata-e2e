import { setupUsers } from "../setup";
import { getApi } from "../api";
import { EthUser } from "../EthUser";
import { BN } from "@polkadot/util";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../txHandler";
import { stringToBN, waitBlockNumber } from "../utils";
import { getEventsAt, waitNewBlock } from "../eventListeners";
import { ApiPromise } from "@polkadot/api";

export class Rolldown {
  static async l2OriginRequestId(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.l2OriginRequestId(l1);
    return parseInt(requestId.toString());
  }
  static async lastProcessedRequestOnL2(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.lastProcessedRequestOnL2(l1);
    return requestId as any as number;
  }
  static isDepositSucceed(
    events: MangataGenericEvent[],
    userAddress: string,
    amount: BN,
  ) {
    return events.some(
      (x) =>
        x.phase.toString() === "Initialization" &&
        x.event.method === "Deposited" &&
        x.event.section === "tokens" &&
        JSON.stringify(x.event.data).includes(userAddress.toLowerCase()) &&
        Object.hasOwn(x.event.data, "amount") &&
        stringToBN(
          // @ts-ignore : it's secure to access the amount property
          x.event.data["amount"].toString(),
        ).eq(amount),
    );
  }
  static async untilL2Processed(txResult: MangataGenericEvent[]) {
    const until = getEventResultFromMangataTx(txResult, [
      "rolldown",
      "L1ReadStored",
    ]);
    const blockNo = stringToBN(until.data[0][1]);
    await waitBlockNumber(blockNo.toString(), 10);
    const events = await getEventsAt(blockNo);
    return events as any[] as MangataGenericEvent[];
  }
  static async deposit(
    user: EthUser,
    requestIdx: number,
    ethAddress: string,
    amount: BN,
  ) {
    const tx = new L2Update(getApi())
      .withDeposit(requestIdx, ethAddress, ethAddress, amount.toNumber())
      .build();
    const api = getApi();
    return await signTx(api, tx, user.keyRingPair);
  }

  static async waitForReadRights(userAddress: string, maxBlocks = 10) {
    while (maxBlocks-- > 0) {
      const seqRights =
        await getApi().query.rolldown.sequencerRights(userAddress);
      // @ts-ignore : it's secure to access the readRights property
      if (seqRights && JSON.parse(JSON.stringify(seqRights)).readRights > 0) {
        return;
      } else {
        await waitNewBlock();
      }
    }
    throw new Error("Max blocks reached without getting read rights");
  }
}
export class L2Update {
  api: ApiPromise;
  pendingDeposits: any[];
  pendingWithdrawalResolutions: any[];
  pendingCancelResultions: any[];
  pendingL2UpdatesToRemove: any[];

  constructor(api: ApiPromise) {
    this.api = api;
    this.pendingDeposits = this.api.createType(
      "Vec<PalletRolldownMessagesDeposit>",
    );
    this.pendingWithdrawalResolutions = this.api.createType(
      "Vec<PalletRolldownMessagesWithdrawalResolution>",
    );
    this.pendingCancelResultions = this.api.createType(
      "Vec<PalletRolldownMessagesCancelResolution>",
    );
    this.pendingL2UpdatesToRemove = this.api.createType(
      "Vec<PalletRolldownMessagesL2UpdatesToRemove>",
    );

  }

  build() {
    return this.api.tx.rolldown.updateL2FromL1({
      pendingDeposits: this.api.createType(
        "Vec<PalletRolldownMessagesDeposit>",
        this.pendingDeposits,
      ),
      pendingWithdrawalResolutions: this.api.createType(
        "Vec<PalletRolldownMessagesWithdrawalResolution>",
        this.pendingWithdrawalResolutions,
      ),
    });
  }
  withDeposit(
    txIndex: number,
    ethAddress: string,
    erc20Address: string,
    amountValue: number | BN,
  ) {
    const deposit = this.api.createType("PalletRolldownMessagesDeposit", {
      requestId: this.api.createType("PalletRolldownMessagesRequestId", [
        "L1",
        txIndex,
      ]),
      depositRecipient: ethAddress,
      tokenAddress: erc20Address,
      amount: amountValue,
      blockHash: ethAddress + "000000000000000000000000",
    });
    this.pendingDeposits.push(deposit);
    return this;
  }

  withWithdraw(
    txIndex: number,
    txIndexForL2Request: number,
    status: boolean,
    timestamp: number,
  ) {
    const withdraw = this.api.createType(
      "PalletRolldownMessagesWithdrawalResolution",
      {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        l2RequestId: txIndexForL2Request,
        status: status,
        timeStamp: timestamp,
      },
    );
    this.pendingWithdrawalResolutions.push(withdraw);
    return this;
  }
  withCancelResolution(
    txIndex: number,
    l2RequestId: number,
    cancelJustified: boolean,
    timestamp: number,
  ) {
    const cancelResolution = this.api.createType(
      "PalletRolldownMessagesCancelResolution",
      {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        l2RequestId: l2RequestId,
        cancelJustified: cancelJustified,
        timeStamp: timestamp,
      },
    );
    this.pendingCancelResultions.push(cancelResolution);
    return this;
  }
  withUpdatesToRemove(
    txIndex: number,
    updatesToRemove: number[],
    timestamp: number,
  ) {
    const updateToRemove = this.api.createType(
      "PalletRolldownMessagesL2UpdatesToRemove",
      {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        l2UpdatesToRemove: this.api.createType("Vec<u128>", updatesToRemove),
        timeStamp: timestamp,
      },
    );
    this.pendingL2UpdatesToRemove.push(updateToRemove);
    return this;
  }
}
