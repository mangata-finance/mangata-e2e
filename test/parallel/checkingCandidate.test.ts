/*
 *
 * @group staking
 */
import {
  getLiquidityAssetId,
  mintLiquidity,
  joinCandidate,
  getRewardsInfo,
  activateLiquidity,
} from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { MGA_ASSET_ID, MAX_BALANCE } from "../../utils/Constants";
import {
  getEnvironmentRequiredVars,
  getUserBalanceOfToken,
} from "../../utils/utils";
import { BN, BN_BILLION, BN_ONE, BN_ZERO } from "@mangata-finance/sdk";
import { Assets } from "../../utils/Assets";
import { getApi, initApi } from "../../utils/api";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { Staking } from "../../utils/Staking";
import { setupApi, setupUsers } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let keyring: Keyring;
let liqToken: BN;
let newTokenId: BN;
const multiplier = BN_BILLION;

beforeAll(async () => {
  keyring = new Keyring({ type: "sr25519" });
  await initApi();
  const api = await getApi();
  await setupApi();
  await setupUsers();
  const tokenAmount = new BN(
    await api.consts.parachainStaking.minCandidateStk.toString()
  );
  const aBigEnoughAmount = tokenAmount.mul(multiplier);
  const totalMgxInPool = aBigEnoughAmount.divn(10);
  testUser1 = new User(keyring);
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  newTokenId = await Assets.issueAssetToUser(
    sudo,
    tokenAmount.mul(multiplier),
    sudo,
    true
  );
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(newTokenId, testUser1, aBigEnoughAmount),
    Assets.mintNative(testUser1, aBigEnoughAmount),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(MGA_ASSET_ID, totalMgxInPool, newTokenId, tokenAmount)
    )
  );

  liqToken = await getLiquidityAssetId(MGA_ASSET_ID, newTokenId);
  await Sudo.asSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken))
  );
});

test("Given a user with bonded but not activated liq tokens WHEN he tries to activate THEN the tokens are activated for rewards", async () => {
  const api = await getApi();
  const minCandidate = new BN(
    await api.consts.parachainStaking.minCandidateStk.toString()
  ).add(BN_ONE);
  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    newTokenId,
    minCandidate,
    MAX_BALANCE
  );
  const liqTokens = await getUserBalanceOfToken(liqToken, testUser1);
  expect(liqTokens.free).bnGt(BN_ZERO);
  const events = await joinCandidate(
    testUser1.keyRingPair,
    liqToken,
    liqTokens.free,
    "availablebalance"
  );
  expect(events.state).toEqual(0);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqToken.toNumber(), 20));

  const rewardsInfoBefore = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqToken
  );
  await activateLiquidity(testUser1.keyRingPair, liqToken, liqTokens);
  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqToken
  );

  expect(rewardsInfoBefore.activatedAmount).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.activatedAmount).bnGt(BN_ZERO);
});
