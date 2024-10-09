/*
 *
 * @group rollupDepositProd
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  acceptNetworkSwitchInNewWindow,
  addExtraLogs,
  importMetamaskExtension,
  uiStringToNumber,
} from "../../utils/frontend/utils/Helper";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForActionNotification,
} from "../../utils/frontend/rollup-utils/Handlers";
import { WalletWrapper } from "../../utils/frontend/rollup-pages/WalletWrapper";
import {
  DepositActionType,
  DepositModal,
} from "../../utils/frontend/rollup-utils/DepositModal";
import { TransactionType } from "../../utils/frontend/rollup-pages/NotificationToast";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const ETH_ASSET_NAME = "ETH";
const ETH_ORIGIN = "Ethereum";
const ARB_ASSET_NAME = "ETH";
const ARB_ORIGIN = "Arbitrum";

describe("Gasp Prod UI deposit tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    acc_addr = await importMetamaskExtension(driver, true);
    acc_addr_short = acc_addr.slice(-4).toUpperCase();

    await setupPage(driver);
    await connectWallet(driver, "MetaMask", acc_addr_short, true);
  });

  test("User can deposit ETH", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const tokensAmountBefore = await walletWrapper.getMyTokensRowAmount(
      ETH_ASSET_NAME,
      ETH_ORIGIN,
    );
    await walletWrapper.openDeposit();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openChainList();
    await depositModal.selectChain("Holesky");
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(ETH_ASSET_NAME);
    await depositModal.selectToken(ETH_ASSET_NAME);

    const randomNum = Math.floor(Math.random() * 99) + 1;
    await depositModal.enterValue("0.001" + randomNum.toString());

    await depositModal.waitForContinueState(true, 60000);
    await depositModal.waitForFeeCalculation();
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    // Skip until we have same behaviour on dev and prod
    // const isNetworkButtonEnabled = await depositModal.isNetworkButtonEnabled();
    // expect(isNetworkButtonEnabled).toBeTruthy();

    // await depositModal.clickDepositButtonByText(DepositActionType.Network);
    // await acceptNetworkSwitchInNewWindow(driver);

    // await depositModal.clickDepositButtonByText(DepositActionType.Approve);
    // await waitForActionNotification(driver, TransactionType.ApproveContract);

    await depositModal.clickDepositButtonByText(DepositActionType.Deposit);
    await waitForActionNotification(driver, TransactionType.Deposit);
    await depositModal.closeSuccessModal();

    await walletWrapper.waitTokenAmountChange(
      ETH_ASSET_NAME,
      tokensAmountBefore,
      ETH_ORIGIN,
    );
    const tokensAmountAfter = await walletWrapper.getMyTokensRowAmount(
      ETH_ASSET_NAME,
      ETH_ORIGIN,
    );
    expect(await uiStringToNumber(tokensAmountAfter)).toBeGreaterThan(
      await uiStringToNumber(tokensAmountBefore),
    );
  });

  test("User can deposit ARB", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const tokensAmountBefore = await walletWrapper.getMyTokensRowAmount(
      ARB_ASSET_NAME,
      ARB_ORIGIN,
    );
    await walletWrapper.openDeposit();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openChainList();
    await depositModal.selectChain("Arbitrum");
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(ARB_ASSET_NAME);
    await depositModal.selectToken(ARB_ASSET_NAME);

    const randomNum = Math.floor(Math.random() * 99) + 1;
    await depositModal.enterValue("0.001" + randomNum.toString());

    await depositModal.waitForContinueState(true, 60000);
    await depositModal.waitForFeeCalculation();
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    const isNetworkButtonEnabled = await depositModal.isNetworkButtonEnabled(
      DepositActionType.NetworkArbitrum,
    );
    expect(isNetworkButtonEnabled).toBeTruthy();

    await depositModal.clickDepositButtonByText(
      DepositActionType.NetworkArbitrum,
    );
    await acceptNetworkSwitchInNewWindow(driver);

    await depositModal.clickDepositButtonByText(DepositActionType.Deposit);
    await waitForActionNotification(driver, TransactionType.Deposit);
    await depositModal.closeSuccessModal();

    await walletWrapper.waitTokenAmountChange(
      ARB_ASSET_NAME,
      tokensAmountBefore,
      ARB_ORIGIN,
    );
    const tokensAmountAfter = await walletWrapper.getMyTokensRowAmount(
      ARB_ASSET_NAME,
      ARB_ORIGIN,
    );
    expect(await uiStringToNumber(tokensAmountAfter)).toBeGreaterThan(
      await uiStringToNumber(tokensAmountBefore),
    );
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
