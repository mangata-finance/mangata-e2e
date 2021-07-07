import {getApi, initApi} from "../../utils/api";
import { getUserAssets, getSudoKey, sudoIssueAsset} from '../../utils/tx'
import {waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {User} from "../../utils/User";
import { validateTransactionSucessful } from "../../utils/validators";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromTxWait } from "../../utils/txHandler";

jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';
const {sudo:sudoUserName} = getEnvironmentRequiredVars();


let testUser : User;
let keyring : Keyring;

beforeAll( async () => {
	try {
		getApi();
	  } catch(e) {
		await initApi();
	}
	
})

beforeEach( async () => {
	await waitNewBlock();
	keyring = new Keyring({ type: 'sr25519' });

	// setup users
	testUser = new User(keyring);
	const sudo = new User(keyring, sudoUserName);
	// add users to pair.
	keyring.addPair(testUser.keyRingPair);
	keyring.addPair(sudo.keyRingPair);
	
});

test('xyk-pallet - Sudo tests: Sudo Issue an asset', async () => {
	//setup
	let sudoKey = await getSudoKey();
	let sudoPair = keyring.getPair(sudoKey.toString());
	let tokensAmount = 220000;
	//act

	let assetId = new BN(0);
	await sudoIssueAsset(sudoPair, new BN(tokensAmount), testUser.keyRingPair.address)
	.then(
		(result) => {
			const eventResponse = getEventResultFromTxWait(result, ["tokens","Issued", testUser.keyRingPair.address]);
			assetId = new BN(eventResponse.data[0]);
			validateTransactionSucessful(eventResponse, tokensAmount, testUser);
		}
	);

	// get the new  assetId from the response.
	
	console.info("Sudo: issued asset " + assetId + " to " + testUser.name);

	//validate
	let userAssets = await getUserAssets(testUser.keyRingPair.address, [assetId]);
	expect(userAssets).toEqual([new BN(tokensAmount)]);
	
});

test('xyk-pallet - Sudo tests: Sudo Issue two  different assets to the same account', async () => {

	let sudoKey = await getSudoKey();
	let sudoPair = keyring.getPair(sudoKey.toString());
	let tokensFirstAmount = 220000;
	//act

	let assetId = new BN(0);
	await sudoIssueAsset(sudoPair, new BN(tokensFirstAmount), testUser.keyRingPair.address)
	.then(
		(result) => {
			const eventResponse = getEventResultFromTxWait(result, ["tokens","Issued", testUser.keyRingPair.address]);
			assetId = new BN(eventResponse.data[0]);
			validateTransactionSucessful(eventResponse, tokensFirstAmount, testUser);
		}
	);
	console.info("Sudo: asset issued " + assetId + " to " + testUser.name);

	await waitNewBlock();
	// act2 : send the second asset issue.
	let tokensSecondAmount = 120000;
	let secondAssetId = new BN(0);
	await sudoIssueAsset(sudoPair, new BN(tokensSecondAmount), testUser.keyRingPair.address)
	.then(
		(result) => {
			const eventResponse = getEventResultFromTxWait(result, ["tokens","Issued", testUser.keyRingPair.address]);
			secondAssetId = new BN(eventResponse.data[0]);
			validateTransactionSucessful(eventResponse, tokensSecondAmount, testUser);
		}
	);
	// validate.
	let userAssets = await getUserAssets(testUser.keyRingPair.address, [assetId,secondAssetId]);

	expect(parseInt(userAssets[0].toString())).toEqual(tokensFirstAmount);
	expect(parseInt(userAssets[1].toString())).toEqual(tokensSecondAmount);
	
});


