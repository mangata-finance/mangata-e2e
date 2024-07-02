/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { mintLiquidity, updateFeeLockMetadata } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN, BN_THOUSAND, BN_ZERO } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import { AssetWallet, User } from "../../utils/User";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  ARB_ETH_ASSET_ID,
  ETH_ASSET_ID,
  ETH_ASSET_NAME,
  GASP_ASSET_ID,
  GASP_ASSET_NAME,
} from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { setupUsers, setupApi, getSudoUser } from "../../utils/setup";
import { Xyk } from "../../utils/xyk";
import { feeLockErrors } from "../../utils/utils";
import { signTx } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
let assetAmount: BN;
let defaultCurrencyValue: BN;
let swapValueThreshold: BN;
let feeLockAmount: BN;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "ethereum" });

  const api = getApi();
  sudo = getSudoUser();

  const feeLockMetadata = (await api.query.feeLock.feeLockMetadata()).value;

  swapValueThreshold = new BN(feeLockMetadata.swapValueThreshold.toString());
  feeLockAmount = new BN(feeLockMetadata.feeLockAmount.toString());

  assetAmount = swapValueThreshold.muln(2000);
  defaultCurrencyValue = swapValueThreshold.muln(4000);
  //add GASP tokens for creating pool.
  await sudo.mint(GASP_ASSET_ID, sudo, defaultCurrencyValue);

  //add two currencies and balance to sudo:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  keyring.addPair(sudo.keyRingPair);

  await updateFeeLockMetadata(sudo, null, null, null, [
    [firstCurrency, true],
    [secondCurrency, true],
  ]);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(sudo),
    Xyk.createPool(GASP_ASSET_ID, assetAmount, firstCurrency, assetAmount),
    Xyk.createPool(firstCurrency, assetAmount, secondCurrency, assetAmount),
  );
});

beforeEach(async () => {
  // setup users
  [testUser1] = setupUsers();

  // add users to pair.
  testUser1.addAsset(GASP_ASSET_ID);
  testUser1.addAsset(ETH_ASSET_ID);

  //add pool's tokens for user.
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
  );
});

describe.each`
  assetId          | assetName
  ${GASP_ASSET_ID} | ${GASP_ASSET_NAME}
  ${ETH_ASSET_ID}  | ${ETH_ASSET_NAME}
`("xyk-pallet -", ({ assetId, assetName }) => {
  test("User can pay a Tx with only " + assetName, async () => {
    await sudo.mint(assetId, testUser1, Assets.DEFAULT_AMOUNT);

    await runMintingLiquidity(testUser1);

    const deductedTkns = await getDeductedTokens(testUser1, assetId);
    expect(deductedTkns).bnGt(BN_ZERO);
  });
});

test("User can't pay a Tx with only Arbitrum-Eth", async () => {
  await sudo.mint(ARB_ETH_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT);
  let exception = false;
  await expect(
    mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(100),
      new BN(1000000),
    ).catch((reason) => {
      exception = true;
      throw new Error(reason.data);
    }),
  ).rejects.toThrow(feeLockErrors.AccountBalanceFail);
  expect(exception).toBeTruthy();
});

test("GIVEN User has enough GASP & enough ETH THEN Fees are charged in GASP", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(GASP_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(ETH_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT),
  );
  const api = getApi();
  const cost = await api?.tx.xyk
    .mintLiquidity(
      firstCurrency.toString(),
      new BN(100),
      secondCurrency.toString(),
      new BN(1000000),
    )
    .paymentInfo(testUser1.keyRingPair);
  const fee = cost.partialFee;

  await runMintingLiquidity(testUser1);

  const deductedGaspTkns = await getDeductedTokens(testUser1, GASP_ASSET_ID);
  const deductedEthTkns = await getDeductedTokens(testUser1, ETH_ASSET_ID);
  expect(deductedGaspTkns).bnGt(BN_ZERO);
  expect(deductedGaspTkns).bnLte(fee);
  expect(deductedEthTkns).bnEqual(BN_ZERO);
});

test("GIVEN User has a very limited amount of GASP & enough ETH THEN Fees are charged in ETH", async () => {
  const api = getApi();
  const cost = await api?.tx.xyk
    .mintLiquidity(
      firstCurrency.toString(),
      new BN(100),
      secondCurrency.toString(),
      new BN(1000000),
    )
    .paymentInfo(testUser1.keyRingPair);
  const fee = cost.partialFee;

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(GASP_ASSET_ID, testUser1, fee.divn(2)),
    Assets.mintToken(ETH_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT),
  );

  await runMintingLiquidity(testUser1);

  const deductedGaspTkns = await getDeductedTokens(testUser1, GASP_ASSET_ID);
  const deductedEthTkns = await getDeductedTokens(testUser1, ETH_ASSET_ID);
  expect(deductedGaspTkns).bnEqual(BN_ZERO);
  expect(deductedEthTkns).bnGt(BN_ZERO);
});

test("GIVEN User has a very limited GASP & a very limited ETH AND we have GASP-tok1 pool WHEN the Tx is a swap tok1 to tok2 above the “threshold” THEN operation succeed", async () => {
  const api = getApi();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(GASP_ASSET_ID, testUser1, feeLockAmount.divn(2)),
    Assets.mintToken(ETH_ASSET_ID, testUser1, feeLockAmount.divn(2)),
  );

  const saleAssetValue = swapValueThreshold.muln(2);

  await signTx(
    api,
    Xyk.sellAsset(firstCurrency, secondCurrency, saleAssetValue),
    testUser1.keyRingPair,
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("GIVEN User has a very limited GASP & a very limited ETH AND we have GASP-tok1 pool WHEN the Tx is a swap tok2 to tok1 above the “threshold” THEN operation failed", async () => {
  const api = getApi();
  let clientError: any;

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(GASP_ASSET_ID, testUser1, feeLockAmount.divn(2)),
    Assets.mintToken(ETH_ASSET_ID, testUser1, feeLockAmount.divn(2)),
  );

  const saleAssetValue = swapValueThreshold.muln(2);

  try {
    await signTx(
      api,
      Xyk.sellAsset(secondCurrency, firstCurrency, saleAssetValue),
      testUser1.keyRingPair,
    );
  } catch (error) {
    clientError = error;
  }
  expect(clientError.data).toContain(
    "Invalid Transaction: Fee lock processing has failed either due to not enough funds to reserve or an unexpected error",
  );
});

test("GIVEN User has a very limited amount of GASP & a minimal amount of Eth AND the Tx is a swap below the “threshold” THEN we receive client error", async () => {
  const api = getApi();
  let clientError: any;
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(GASP_ASSET_ID, testUser1, feeLockAmount.divn(2)),
    Assets.mintToken(ETH_ASSET_ID, testUser1, BN_THOUSAND),
  );

  const saleAssetValue = swapValueThreshold.divn(2);

  try {
    await signTx(
      api,
      Xyk.sellAsset(firstCurrency, secondCurrency, saleAssetValue),
      testUser1.keyRingPair,
    );
  } catch (error) {
    clientError = error;
  }
  expect(clientError.data).toContain(
    "Invalid Transaction: Fee lock processing has failed either due to not enough funds to reserve or an unexpected error",
  );
});

test("User, when paying with eth, have to pay 1/30000 eth per GASP spent.", async () => {
  // setup users
  const [testUser2] = setupUsers();

  // add users to pair.
  testUser2.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(ETH_ASSET_ID);

  //add pool's tokens for user.
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser2, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser2, defaultCurrencyValue),
    Assets.mintToken(ETH_ASSET_ID, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT),
  );

  await runMintingLiquidity(testUser1);
  await runMintingLiquidity(testUser2);

  const deductedGaspTkns = await getDeductedTokens(testUser1, GASP_ASSET_ID);
  const deductedEthTkns = await getDeductedTokens(testUser2, ETH_ASSET_ID);

  expect(deductedGaspTkns).bnGt(BN_ZERO);
  expect(deductedEthTkns).bnGt(BN_ZERO);
});

async function getDeductedTokens(testUser: User, tokenId: BN) {
  const deductedTokens = testUser
    .getAsset(tokenId)
    ?.amountBefore.free.sub(testUser.getAsset(tokenId)?.amountAfter.free!);
  return deductedTokens;
}

async function runMintingLiquidity(testUser: User) {
  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser.refreshAmounts(AssetWallet.AFTER);
}
