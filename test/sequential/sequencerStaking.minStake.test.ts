/*
 *
 * @group L1RolldownUpdates
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";

import { expectMGAExtrinsicSuDidSuccess } from "../../utils/eventListeners";
import { BN_HUNDRED_THOUSAND, signTx } from "gasp-sdk";
import { Rolldown } from "../../utils/rollDown/Rolldown";

const chain: ChainName = "Ethereum";
let testUser: User;
let testUser2: User;
let testUser3: User;
beforeAll(async () => {
  await initApi();
  await setupApi();
});

beforeEach(async () => {
  [testUser, testUser2, testUser3] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
  );
  testUser.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(GASP_ASSET_ID);
  testUser3.addAsset(GASP_ASSET_ID);
  await SequencerStaking.removeAllSequencers();
});

it("Given a set of sequencers, WHEN min increased, then those below will be kicked", async () => {
  //SETUP: setup 3 sequencers
  const newStakeValue = (await SequencerStaking.minimalStakeAmount()).addn(
    1000,
  );
  const activeSequencersBefore = await SequencerStaking.activeSequencers();

  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      newStakeValue.addn(1),
      chain,
      true,
    ),
    testUser.keyRingPair,
  );
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      newStakeValue.addn(0),
      chain,
      true,
    ),
    testUser2.keyRingPair,
  );
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      newStakeValue.subn(1),
      chain,
      true,
    ),
    testUser3.keyRingPair,
  );
  await testUser.refreshAmounts();
  await testUser2.refreshAmounts();
  await testUser3.refreshAmounts();

  const activeSequencersAfter = await SequencerStaking.activeSequencers();
  const readRights1Before = await Rolldown.sequencerRights(
    chain,
    testUser.keyRingPair.address,
  );
  const readRights2Before = await Rolldown.sequencerRights(
    chain,
    testUser2.keyRingPair.address,
  );
  const readRights3Before = await Rolldown.sequencerRights(
    chain,
    testUser3.keyRingPair.address,
  );
  expect(readRights1Before).toEqual(readRights2Before);
  expect(readRights1Before).toEqual(readRights3Before);
  expect(readRights1Before.readRights.toString()).toEqual("1");
  expect(readRights1Before.cancelRights.toString()).toEqual("2");
  expect(activeSequencersBefore.toHuman().Ethereum).toHaveLength(0);
  expect(activeSequencersAfter.toHuman().Ethereum).toHaveLength(3);

  //ACT: increase the minimum
  const events = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      await SequencerStaking.setSequencerConfiguration(
        chain,
        newStakeValue,
        BN_HUNDRED_THOUSAND,
      ),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(events);

  //ASSERT: the user is not in the active set
  const activeSequencersAfterMinIncreased =
    await SequencerStaking.activeSequencers();
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toHaveLength(2);
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser2.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).not.toContain(
    testUser3.keyRingPair.address,
  );

  //ASSERT: tokens are still staked
  await testUser3.refreshAmounts(AssetWallet.AFTER);
  expect(testUser3.getWalletDifferences()).toHaveLength(0);

  //ASSET: CheckReadRights
  const readRights1After = await Rolldown.sequencerRights(
    chain,
    testUser.keyRingPair.address,
  );
  const readRights2After = await Rolldown.sequencerRights(
    chain,
    testUser2.keyRingPair.address,
  );
  const readRights3After = await Rolldown.sequencerRights(
    chain,
    testUser3.keyRingPair.address,
  );
  expect(readRights1After).toEqual(readRights2After);
  expect(readRights1After.readRights.toString()).toEqual("1");
  expect(readRights1After.cancelRights.toString()).toEqual("1");
  expect(readRights3After.readRights.toString()).toEqual("0");
  expect(readRights3After.cancelRights.toString()).toEqual("0");
});
