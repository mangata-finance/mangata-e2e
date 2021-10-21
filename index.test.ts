import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { api, getApi, initApi } from "./utils/api";
import { MGA_ASSET_ID } from "./utils/Constants";
import { waitNewBlock } from "./utils/eventListeners";
import { testLog } from "./utils/Logger";
import { signAndWaitTx, signSendAndWaitToFinishTx } from "./utils/txHandler";
import { User, AssetWallet } from "./utils/User";
import { getEnvironmentRequiredVars } from "./utils/utils";
import fs from "fs";
import { Assets } from "./utils/Assets";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1, sudo, keyring;

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
  //  const address = "5GTRSQdSShzwae79JTxTkD5GpuQ3jFYr95TXC35HCg9sjyr4"; // <--candidate1
  const address = "5FeZz2TiZv97hDm4vCk4itBqBLPkrokAVPKeCxuo2T9ySTkd"; // <--candidate2
  //const address = "5FACJNbD38aXkw64Tp3SMjw8azz1jSc457rj1TkVGogDYdC1"; // <--vote to candidate1
  //  const address = "5DCmoET8xk3RS2vsh2iPY6VsdNtWcKQy2SAxZk4ZrxPCuTNt"; // <--vote to candidate2
  test.each(["3000", "3000"])(
    "xyk-pallet: Create new validator",
    async (bondAmount) => {
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring);
      await fs.writeFileSync(
        testUser1.keyRingPair.address + ".json",
        JSON.stringify(testUser1.keyRingPair.toJson("mangata123"))
      );
      await fs.writeFileSync(
        sudo.keyRingPair.address + ".json",
        JSON.stringify(sudo.keyRingPair.toJson("mangata123"))
      );
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      keyring.addPair(sudo.keyRingPair);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);

      const { nonce } = await api.query.system.account(
        sudo.keyRingPair.address
      );
      await signAndWaitTx(
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            MGA_ASSET_ID,
            testUser1.keyRingPair.address,
            new BN("1000000000000")
          )
        ),
        sudo.keyRingPair,
        nonce.toNumber()
      );
      const nonce2 = await (
        await api.query.system.account(sudo.keyRingPair.address)
      ).nonce;
      await signAndWaitTx(
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            new BN(3),
            testUser1.keyRingPair.address,
            new BN(10000)
          )
        ),
        sudo.keyRingPair,
        nonce2.toNumber()
      );

      //    await sudo.mint(MGA_ASSET_ID, testUser1, new BN("1000000000000"));

      //  const [firstCurrency] = await Assets.setupUserWithCurrencies(
      //    testUser1,
      //    [new BN(11111)],
      //    sudo
      //  );
      //  await sudo.mint(new BN(3), testUser1, new BN(10000));
      await waitNewBlock();
      await signSendAndWaitToFinishTx(
        api?.tx.staking.bond(
          testUser1.keyRingPair.address,
          new BN(bondAmount),
          "Staked",
          // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
          new BN(3)
        ),
        testUser1.keyRingPair
      );
      await waitNewBlock();
      //      await signSendAndWaitToFinishTx(
      //        api?.tx.staking.nominate([
      //          testUser1.keyRingPair.address,
      //          "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      //        ]),
      //        testUser1.keyRingPair
      //      ).then();
      //      await waitNewBlock();

      //      await signSendAndWaitToFinishTx(
      //        api?.tx.staking.validate({ commission: "0" }),
      //        testUser1.keyRingPair
      //      ).then();
      //      testLog.getLog().warn("done" + testUser1.keyRingPair.address);
    }
  );

  test("xyk-pallet: Drop from validator", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });
    //    const json = fs.readFileSync(testUser1.keyRingPair.address + ".json", {
    //      encoding: "utf8",
    //      flag: "r",
    //    });
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.chill(),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: only validate", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });
    //    const json = fs.readFileSync(testUser1.keyRingPair.address + ".json", {
    //      encoding: "utf8",
    //      flag: "r",
    //    });
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.validate({ commission: "0" }),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: nominate", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.nominate([
        "5FeZz2TiZv97hDm4vCk4itBqBLPkrokAVPKeCxuo2T9ySTkd",
        "5FeZz2TiZv97hDm4vCk4itBqBLPkrokAVPKeCxuo2T9ySTkd",
        "5FeZz2TiZv97hDm4vCk4itBqBLPkrokAVPKeCxuo2T9ySTkd",
        "5FeZz2TiZv97hDm4vCk4itBqBLPkrokAVPKeCxuo2T9ySTkd",
      ]),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: bond_extra", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.bondExtra(new BN(1000)),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: bond", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.bond(
        user.keyRingPair.address,
        new BN("1000"),
        "Staked",
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(3)
      ),
      user.keyRingPair
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: validate", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.validate({ commission: "110" }),
      user.keyRingPair
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: rebond", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.rebond(new BN("1000")),
      user.keyRingPair
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: unbond", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.unbond(new BN(1000)),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: withdraw", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.withdrawUnbonded(new BN(3000)),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });

  test("xyk-pallet: force new era always", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const { nonce } = await api.query.system.account(sudo.keyRingPair.address);
    await signAndWaitTx(
      api.tx.sudo.sudo(api.tx.staking.forceNewEraAlways()),
      sudo.keyRingPair,
      nonce.toNumber()
    );
  });

  test("create token", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    const [secondCurrency] = await Assets.setupUserWithCurrencies(
      user,
      [new BN("1000000000000")],
      sudo
    );
  });
  test("mint", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    //await user.addMGATokens(sudo);
    await sudo.mint(new BN(3), user, new BN("1000000"));
  });
});
