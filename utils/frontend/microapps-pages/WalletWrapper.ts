import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByText,
  clickElement,
  elementExists,
  getText,
  isDisplayed,
  waitForElement,
  waitForElementVisible,
} from "../utils/Helper";

const DIV_WALLET_WRAPPER = "wallet-wrapper";
const DIV_WALLET_CONNECTED = "wallet-connected";
const DIV_WALLET_ITEM = "installedWallets-walletCard";
const DIV_WALLET_WRAPPER_HEADER_ACC = "wallet-wrapper-header-account";
const BUTTON_WALLET_CONNECT = "wallet-notConnected-cta";
const BUTTON_WALLET_SETTINGS = "wallet-wrapper-header-settings";
const MY_TOKENS = "my-tokens";
const MY_POSITIONS = "my-positions";
const MY_TOKENS_TAB_BUTTON = "My-Tokens-item";
const MY_TOKENS_ROW_AMOUNT = "token-amount";
const MY_POSITIONS_TAB_BUTTON = "My-Positions-item";
const MY_TOKENS_FIAT_VALUE = "fiat-value";

export class WalletWrapper {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isWalletConnectButtonDisplayed() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    return await isDisplayed(this.driver, walletWrapper);
  }

  async isAccInfoDisplayed(accName: string) {
    const walletWrapperHeaderAcc =
      buildDataTestIdXpath(DIV_WALLET_WRAPPER_HEADER_ACC) +
      buildXpathByText(accName);
    return await isDisplayed(this.driver, walletWrapperHeaderAcc);
  }

  async openWalletConnectionInfo() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    await clickElement(this.driver, walletWrapper);
  }

  async openWalletSettings() {
    const xpath = buildDataTestIdXpath(BUTTON_WALLET_SETTINGS);
    await clickElement(this.driver, xpath);
  }

  async openDeposit() {
    const betaButton = buildXpathByElementText("button", "Deposit");
    await clickElement(this.driver, betaButton);
  }

  async openWithdraw() {
    const betaButton = buildXpathByElementText("button", "Withdraw");
    await clickElement(this.driver, betaButton);
  }

  async isWalletConnected() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    const walletConnectedContent = buildDataTestIdXpath(DIV_WALLET_CONNECTED);
    return await elementExists(
      this.driver,
      walletWrapper + walletConnectedContent,
    );
  }

  async clickWalletConnect() {
    const walletWrapper = buildDataTestIdXpath(BUTTON_WALLET_CONNECT);
    await clickElement(this.driver, walletWrapper);
  }

  async pickWallet(wallet: string) {
    const walletButtonXpath = buildXpathByText(wallet);
    const walletItem = buildDataTestIdXpath(DIV_WALLET_ITEM);
    await clickElement(this.driver, walletItem + walletButtonXpath);
  }

  async pickMyTokens() {
    const myTokensTab = buildDataTestIdXpath(MY_TOKENS_TAB_BUTTON);
    await clickElement(this.driver, myTokensTab);
  }

  async pickMyPositions() {
    const myPositionsTab = buildDataTestIdXpath(MY_POSITIONS_TAB_BUTTON);
    await clickElement(this.driver, myPositionsTab);
  }

  async waitForTokensVisible() {
    const tokenRow = buildDataTestIdXpath(MY_TOKENS);
    await waitForElementVisible(this.driver, tokenRow);
  }

  async isMyTokensRowDisplayed(tokenName: string) {
    const tokenRow =
      buildDataTestIdXpath(MY_TOKENS) + buildXpathByText(tokenName);
    await waitForElement(this.driver, tokenRow);
    return await isDisplayed(this.driver, tokenRow);
  }

  async getMyTokensRowAmount(tokenName: string) {
    const tokenRowAmount =
      buildDataTestIdXpath(MY_TOKENS) +
      buildXpathByText(tokenName) +
      buildDataTestIdXpath(MY_TOKENS_ROW_AMOUNT);
    return await getText(this.driver, tokenRowAmount);
  }

  async getMyTokensRowFiatValue(tokenName: string) {
    const tokenFiatValue =
      buildDataTestIdXpath(MY_TOKENS) +
      buildDataTestIdXpath(tokenName + "-token-row") +
      buildDataTestIdXpath(MY_TOKENS_FIAT_VALUE);
    await waitForElement(this.driver, tokenFiatValue, 20000);
    const text = await getText(this.driver, tokenFiatValue);
    const cleanedText = text.replace(/[^\d.]/g, "");
    return cleanedText;
  }

  async isMyPositionsRowDisplayed(poolName: string) {
    const poolRow =
      buildDataTestIdXpath(MY_POSITIONS) + buildXpathByText(poolName);
    return await isDisplayed(this.driver, poolRow);
  }
}
