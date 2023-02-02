/*
 *
 * @group autocompound
 * @group story
 */
import { getApi, initApi } from "../../utils/api";
import { multiSwapBuy } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getUserBalanceOfToken } from "../../utils/utils";
import { setupApi, setup5PoolsChained } from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_TEN_THOUSAND, BN_ZERO } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let users: User[] = [];
let tokenIds: BN[] = [];

describe("Multiswap - error cases: disabled tokens", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
  });
  //enable the tokens for the following test!
  beforeEach(async () => {
    for (let index = 0; index < tokenIds.length; index++) {
      const tokenId = tokenIds[index];
      await Assets.enableToken(tokenId);
    }
  });
  it.each([0, 2, tokenIds.length])(
    "[gasless] disabled on token of the chained polls",
    async (position: number) => {
      await Assets.disableToken(tokenIds[position]);
      const testUser1 = users[0];
      const multiSwapOutput = await multiSwapBuy(
        testUser1,
        tokenIds,
        new BN(1000),
        BN_TEN_THOUSAND
      );
      const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
        "system",
        "ExtrinsicFailed",
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual("FunctionNotAvailableForThisToken");
      const boughtTokens = await getUserBalanceOfToken(
        tokenIds[tokenIds.length - 1],
        testUser1
      );
      expect(boughtTokens.free).bnEqual(BN_ZERO);
    }
  );
});
