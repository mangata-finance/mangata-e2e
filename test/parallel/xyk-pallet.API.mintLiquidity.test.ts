import {api, getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, mintLiquidity, getLiquidityAssetId} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, EventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateMintedLiquidityEvent, validateTreasuryAmountsEqual, validateUnmodified } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromTxWait, signSendAndWaitToFinishTx } from "../../utils/txHandler";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

var firstAssetAmount = new BN(50000);
var secondAssetAmount = new BN(50000);
const defaultCurrecyValue = 250000;

describe('xyk-pallet - Mint liquidity tests: MintLiquidity Errors:', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	const pool_balance_before = [new BN(0), new BN(0)];

	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	});

	beforeEach(async () => {
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);

		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);
		await testUser1.setBalance(sudo);

	});

	test('Mint liquidity when not enough assetY for minting Xamount', async () => {
		await waitNewBlock();
		//Adding 1000 and 1 more than default. So the user when the pool is created has 1000,1.
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue + 1000,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		//lets create a pool with equal balances
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, defaultCurrecyValue, secondCurrency,defaultCurrecyValue), 
			testUser1.keyRingPair 
		);
		// now we have quite a lot of X and only a few Y, but the pool is 1:1, 
		// force the error minting almost all of X
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, testUser1.getAsset(firstCurrency)?.amountBefore.sub(new BN(1))!)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(2);
				}
			);		

		await testUser1.refreshAmounts(AssetWallet.AFTER);
		await validateUnmodified(firstCurrency,secondCurrency,testUser1,[new BN(defaultCurrecyValue), new BN(defaultCurrecyValue)]);

	});
	test('Mint liquidity when not enough assetX for minting Yamount', async () => {
		await waitNewBlock();
		//Adding 1000 and 1 more than default. So the user when the pool is created has 1000,1.
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue + 1,defaultCurrecyValue +1000], sudo);
		await testUser1.setBalance(sudo);
		//lets create a pool with equal balances
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, defaultCurrecyValue, secondCurrency,defaultCurrecyValue), 
			testUser1.keyRingPair 
		);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		// now we have quite a lot of X and only a few Y, but the pool is 1:1, 
		// force the error minting almost all of X
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, testUser1.getAsset(secondCurrency)?.amountBefore.sub(new BN(1))!)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(2);
				}
			);		

		await validateUnmodified(firstCurrency,secondCurrency,testUser1,[new BN(defaultCurrecyValue), new BN(defaultCurrecyValue)]);

	});
	
	test('Mint liquidity assets that does not belong to any pool', async () => {
		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		const [thirdCurrency]= await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue], sudo);
		//lets create a pool between asset 1 and 3.
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, thirdCurrency,secondAssetAmount), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
				
		//lets try to mint with asset 1 and 2
		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, firstAssetAmount)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(3);
				}
			);		


		await waitNewBlock();
		//lets try to mint with asset 2 and 3
		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, firstAssetAmount)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(3);
				}
			);			
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		await validateUnmodified(firstCurrency, secondCurrency, testUser1, pool_balance_before);

	});

	test('Mint liquidity more assets than I own', async () => {
		await waitNewBlock();
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue], sudo);
		await testUser1.setBalance(sudo);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const poolAmountSecondCurrency = secondAssetAmount.div(new BN(2));
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, secondCurrency,poolAmountSecondCurrency), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		
		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, testUser1.getAsset(firstCurrency)?.amountBefore.add(new BN(1))!)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(2);
				}
			);			
		await waitNewBlock();
		await validateUnmodified(firstCurrency,secondCurrency,testUser1,[firstAssetAmount, poolAmountSecondCurrency]);

		//lets empty the second wallet assets.
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.sellAsset(secondCurrency, firstCurrency, testUser1.getAsset(secondCurrency)?.amountBefore!, new BN(0)),
			testUser1.keyRingPair 
		);
		await waitNewBlock();
		var poolBalanceAfterSelling = await getBalanceOfPool(firstCurrency, secondCurrency);
		
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, testUser1.getAsset(firstCurrency)?.amountBefore.sub(new BN(1))!)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(2);
				}
			);			
		await validateUnmodified(firstCurrency,secondCurrency,testUser1,poolBalanceAfterSelling);

	});


});


describe('xyk-pallet - Mint liquidity tests: with minting you can', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	//creating pool
	
	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	});

	beforeEach(async () => {
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);
	
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);

	});

	test('Add all the wallet assets to the pool', async () => {
		//valdiated with Gleb the rounding issue to preserve the x*y =k
		const roundingIssue =  new BN(1);
		await waitNewBlock();
		// The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue +1 ,defaultCurrecyValue +1 + 1], sudo);
		await testUser1.setBalance(sudo);
		const amounttoThePool = new BN(1);
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, amounttoThePool, secondCurrency,amounttoThePool), 
			testUser1.keyRingPair 
		);
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		testUser1.addAsset(liquidityAssetId);

		var poolBalanceWhenCreated = await getBalanceOfPool(firstCurrency, secondCurrency);
		await waitNewBlock();
		
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		await testUser1.mintLiquidity(firstCurrency,secondCurrency,new BN(defaultCurrecyValue));
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		var poolBalanceAfterMinting = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect([poolBalanceWhenCreated[0].add(new BN(defaultCurrecyValue)), poolBalanceWhenCreated[0].add(new BN(defaultCurrecyValue)).add(roundingIssue)])
		.toEqual(poolBalanceAfterMinting);

		testUser1.validateWalletReduced(firstCurrency,new BN(defaultCurrecyValue));
		testUser1.validateWalletReduced(secondCurrency,new BN(defaultCurrecyValue).add(roundingIssue));

		testUser1.validateWalletIncreased(liquidityAssetId,new BN(defaultCurrecyValue).mul(new BN(2)));
		await validateTreasuryAmountsEqual(firstCurrency,['0','0']);
		await validateTreasuryAmountsEqual(secondCurrency,['0','0']);
		
	});
	
	test('Expect an event when liquidirty is minted', async () => {

		await waitNewBlock();
		// The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue], sudo);
		await testUser1.setBalance(sudo);
		const amounttoThePool = new BN(defaultCurrecyValue).div(new BN(2));
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, amounttoThePool, secondCurrency,amounttoThePool), 
			testUser1.keyRingPair 
		);
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		testUser1.addAsset(liquidityAssetId);

		var poolBalanceWhenCreated = await getBalanceOfPool(firstCurrency, secondCurrency);
		await waitNewBlock();
		
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const injectedValue = amounttoThePool.div(new BN(2));
		let eventResponse : EventResult = new EventResult(0,'');
		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, injectedValue)
		.then(
			(result) => {
					eventResponse = getEventResultFromTxWait(result,["xyk", "LiquidityMinted", testUser1.keyRingPair.address]);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
				}
		);			
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		var poolBalanceAfterMinting = await getBalanceOfPool(firstCurrency, secondCurrency);
		const secondCurrencyAmountLost = testUser1.getAsset(secondCurrency)?.amountBefore.sub(testUser1.getAsset(secondCurrency)?.amountAfter!)!;
		validateMintedLiquidityEvent(eventResponse, testUser1.keyRingPair.address, firstCurrency,injectedValue, secondCurrency, secondCurrencyAmountLost, liquidityAssetId )
		
		expect([poolBalanceWhenCreated[0].add(injectedValue), poolBalanceWhenCreated[1].add(secondCurrencyAmountLost)])
		.toEqual(poolBalanceAfterMinting);

		testUser1.validateWalletReduced(firstCurrency,injectedValue);
		testUser1.validateWalletReduced(secondCurrency, secondCurrencyAmountLost);
		// TODO: miss that rounding value. to check with Gleb or Stano.
		testUser1.validateWalletIncreased(liquidityAssetId,new BN(injectedValue).mul(new BN(2)));
		await validateTreasuryAmountsEqual(firstCurrency,['0','0']);
		await validateTreasuryAmountsEqual(secondCurrency,['0','0']);

	});

});


