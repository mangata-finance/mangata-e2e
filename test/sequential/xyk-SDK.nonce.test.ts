/*
 *
 * @group xyk
 * @group errors
 * @group parallel
 * @group sdk
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import BN from "bn.js";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { Mangata } from "mangata-sdk";
import { getEventResultFromTxWait } from "../../utils/txHandler";
import { ExtrinsicResult } from "mangata-sdk/build/types";
import { MGA_ASSET_ID } from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

let testUser: User;
let sudo: User;
let keyring: Keyring;
let mangata: Mangata;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await getApi();
  mangata = await getMangataInstance();
});

beforeEach(async () => {
  keyring = new Keyring({ type: "sr25519" });
  // setup users
  testUser = new User(keyring);
  sudo = new User(keyring, sudoUserName);
  // add users to pair.
  keyring.addPair(testUser.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
});

test("SDK- Nonce management - sudo", async () => {
  const userNonce = [];
  const sudoNonce = [];
  userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));

  const event = await mangata.createToken(
    testUser.keyRingPair.address,
    sudo.keyRingPair,
    new BN(1000)
  );
  const eventResult = getEventResultFromTxWait(event);
  expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  expect(parseFloat(sudoNonce[1].toString())).toBeGreaterThan(
    parseFloat(sudoNonce[0].toString())
  );
  expect(userNonce[0]).bnEqual(userNonce[1]);
});
test("SDK- Nonce management - sudo - parallel", async () => {
  const sudoNonce = [];
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  const promises = [];
  for (let index = 0; index < 10; index++) {
    promises.push(
      mangata.createToken(
        testUser.keyRingPair.address,
        sudo.keyRingPair,
        new BN(1000)
      )
    );
  }
  await Promise.all(promises);
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  expect(parseFloat(sudoNonce[1].toString())).toBeGreaterThan(
    parseFloat(sudoNonce[0].toString()) + 9
  );
});

test("SDK- Nonce management - Extrinsic failed", async () => {
  const userNonce = [];
  const sudoNonce = [];
  userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  const mintEventResult = await mangata.mintAsset(
    sudo.keyRingPair,
    MGA_ASSET_ID,
    testUser.keyRingPair.address,
    new BN(2000)
  );
  let eventResult = getEventResultFromTxWait(mintEventResult);
  expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  //pool does not exist.
  const MAX_INT = 4294967295;
  const event = await mangata.sellAsset(
    testUser.keyRingPair,
    (MAX_INT - 1).toString(),
    (MAX_INT - 2).toString(),
    new BN(1000),
    new BN(1)
  );
  eventResult = getEventResultFromTxWait(event);
  expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  expect(parseFloat(sudoNonce[1].toString())).toBeGreaterThan(
    parseFloat(sudoNonce[0].toString())
  );
  expect(parseFloat(userNonce[1].toString())).toBeGreaterThan(
    parseFloat(userNonce[0].toString())
  );
});
test("SDK- Nonce management - Using custom nonce", async () => {
  const sudoNonce = [];
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  const mintEventResult = await mangata.mintAsset(
    sudo.keyRingPair,
    MGA_ASSET_ID,
    testUser.keyRingPair.address,
    new BN(2000),
    { nonce: sudoNonce[0] }
  );
  let eventResult = getEventResultFromTxWait(mintEventResult);
  expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  //perform an operation without custom nonce.
  const mintEventResult2 = await mangata.mintAsset(
    sudo.keyRingPair,
    MGA_ASSET_ID,
    testUser.keyRingPair.address,
    new BN(2001)
  );
  eventResult = getEventResultFromTxWait(mintEventResult2);
  expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  expect(parseFloat(sudoNonce[1].toString())).toBeGreaterThan(
    parseFloat(sudoNonce[0].toString())
  );
});

test.skip("[BUG?] SDK- Nonce management - RPC Failure - Not enough balance", async () => {
  const userNonce = [];
  const sudoNonce = [];
  userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));

  //pool does not exist.
  const MAX_INT = 4294967295;
  let exception = false;
  await expect(
    mangata
      .mintLiquidity(
        testUser.keyRingPair,
        (MAX_INT - 1).toString(),
        (MAX_INT - 2).toString(),
        new BN(1000),
        new BN(MAX_INT)
      )
      .catch((reason) => {
        exception = true;
        throw new Error(reason);
      })
  ).rejects.toThrow(
    "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low"
  );
  expect(exception).toBeTruthy();

  userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
  sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
  expect(sudoNonce[1]).bnEqual(sudoNonce[0]);
  expect(userNonce[1]).bnEqual(sudoNonce[0]);
});
