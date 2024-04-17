import { getApi } from "./api";
import { expectMGAExtrinsicSuDidSuccess, waitNewBlock } from "./eventListeners";
import { User } from "./User";
import { getEventResultFromMangataTx, sudoIssueAsset } from "./txHandler";
import { getBlockNumber } from "./utils";
import { toBN } from "@mangata-finance/sdk";
import { Assets } from "./Assets";
import { setupApi } from "./setup";
import { Sudo } from "./sudo";
import { testLog } from "./Logger";
import { api, Extrinsic } from "./setup";
import { BN } from "@polkadot/util";
import { signTxMetamask } from "./metamask";

export async function waitForBootstrapStatus(
  bootstrapStatus: string,
  maxNumberBlocks: number,
) {
  const lastBlock = (await getBlockNumber()) + maxNumberBlocks;
  let currentBlock = await getBlockNumber();
  const api = await getApi();
  let bootstrapPhase = await api.query.bootstrap.phase();
  testLog.getLog().info("Waiting for bootstrap to be " + bootstrapStatus);
  while (lastBlock > currentBlock && bootstrapPhase.type !== bootstrapStatus) {
    await waitNewBlock();
    bootstrapPhase = await api.query.bootstrap.phase();
    currentBlock = await getBlockNumber();
  }
  testLog.getLog().info("... Done waiting " + bootstrapStatus);
  if (bootstrapPhase.type.toLowerCase() !== bootstrapStatus.toLowerCase()) {
    testLog.getLog().warn("TIMEDOUT waiting for the new boostrap phase");
  }
}

export async function checkLastBootstrapFinalized(sudoUser: User) {
  const api = getApi();
  await setupApi();

  let bootstrapPhase: any;

  // check that system is ready to bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const bootstrapFinalize = await finalizeBootstrap(sudoUser);
    await expectMGAExtrinsicSuDidSuccess(bootstrapFinalize);
  }

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
}

export async function createNewBootstrapCurrency(sudoUser: User) {
  const creatingBootstrapToken = await sudoIssueAsset(
    sudoUser.keyRingPair,
    toBN("1", 20),
    sudoUser.keyRingPair.address,
  );
  const creatingBootstrapTokenResult = getEventResultFromMangataTx(
    creatingBootstrapToken,
    ["tokens", "Created", sudoUser.keyRingPair.address],
  );

  return new BN(creatingBootstrapTokenResult.data[0].split(",").join(""));
}

export async function setupBootstrapTokensBalance(
  bootstrapTokenId: BN,
  sudoUser: User,
  testUser: User[],
) {
  const extrinsicCall = [
    Assets.mintNative(sudoUser),
    Assets.mintToken(bootstrapTokenId, sudoUser),
  ];
  testUser.forEach(async (userId) =>
    extrinsicCall.push(Assets.mintToken(bootstrapTokenId, userId)),
  );
  testUser.forEach(async (userId) =>
    extrinsicCall.push(Assets.mintNative(userId)),
  );
  await Sudo.batchAsSudoFinalized(...extrinsicCall);
}

export async function getPromotionBootstrapPoolState() {
  const api = getApi();
  return (await api.query.bootstrap.promoteBootstrapPool()).toHuman();
}

export async function scheduleBootstrap(
  sudoUser: User,
  mainCurrency: BN,
  bootstrapCurrency: BN,
  waitingPeriod: number,
  bootstrapPeriod: number,
  whitelistPeriod = 1,
  provisionBootstrap = false,
) {
  const api = getApi();
  const bootstrapBlockNumber = (await getBlockNumber()) + waitingPeriod;
  return await signTxMetamask(
    api.tx.sudo.sudo(
      api.tx.bootstrap.scheduleBootstrap(
        mainCurrency,
        bootstrapCurrency,
        bootstrapBlockNumber,
        new BN(whitelistPeriod),
        new BN(bootstrapPeriod),
        [100, 1],
        // @ts-ignore
        provisionBootstrap,
      ),
    ),
    sudoUser.ethAddress.toString(),
    sudoUser.name.toString(),
  );
}

export async function provisionBootstrap(
  user: User,
  bootstrapCurrency: BN,
  bootstrapAmount: BN,
) {
  const api = getApi();
  return await signTxMetamask(
    api.tx.bootstrap.provision(bootstrapCurrency, bootstrapAmount),
    user.ethAddress.toString(),
    user.name.toString(),
  );
}

export async function provisionVestedBootstrap(
  user: User,
  bootstrapCurrency: BN,
  bootstrapAmount: BN,
) {
  const api = getApi();
  return await signTxMetamask(
    api.tx.bootstrap.provisionVested(bootstrapCurrency, bootstrapAmount),
    user.ethAddress.toString(),
    user.name.toString(),
  );
}

export async function claimRewardsBootstrap(user: User) {
  const api = getApi();
  return await signTxMetamask(
    api.tx.bootstrap.claimLiquidityTokens(),
    user.ethAddress.toString(),
    user.name.toString(),
  );
}

export async function claimAndActivateBootstrap(user: User) {
  const api = getApi();
  return await signTxMetamask(
    api.tx.bootstrap.claimAndActivateLiquidityTokens(),
    user.ethAddress.toString(),
    user.name.toString(),
  );
}

export async function finalizeBootstrap(sudoUser: User) {
  const api = getApi();
  return await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(sudoUser, api.tx.bootstrap.preFinalize()),
    Sudo.sudoAs(sudoUser, api.tx.bootstrap.finalize()),
  );
}

export async function cancelRunningBootstrap(sudoUser: User) {
  const api = getApi();
  return await signTxMetamask(
    api.tx.sudo.sudo(api.tx.bootstrap.cancelBootstrap()),
    sudoUser.ethAddress.toString(),
    sudoUser.name.toString(),
  );
}

export async function updatePromoteBootstrapPool(
  sudoUser: User,
  promoteBootstrapPoolFlag: boolean,
) {
  const api = getApi();
  return await signTxMetamask(
    api.tx.sudo.sudo(
      api.tx.bootstrap.updatePromoteBootstrapPool(promoteBootstrapPoolFlag),
    ),
    sudoUser.ethAddress.toString(),
    sudoUser.name.toString(),
  );
}
export class Bootstrap {
  static provision(tokenId: BN, amount: BN): Extrinsic {
    return api.tx.bootstrap.provision(tokenId, amount);
  }
}
