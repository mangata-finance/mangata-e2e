import { logging, WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import { Mangata } from "../pages/Mangata";
import { MetaMask } from "../pages/MetaMask";
import { Polkadot } from "../pages/Polkadot";
import fs from "fs";
import { testLog } from "../../Logger";
import BN from "bn.js";

const { By, until } = require("selenium-webdriver");
require("chromedriver");
const outputPath = `reports/artifacts`;
export async function waitForElement(
  driver: WebDriver,
  xpath: string,
  timeout = 30000
) {
  await driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
}

export async function waitForElementToDissapear(
  driver: WebDriver,
  xpath: string
) {
  let continueWaiting = false;
  do {
    try {
      await driver.wait(until.elementLocated(By.xpath(xpath)), 500);
      continueWaiting = true;
    } catch (error) {
      sleep(1000);
      continueWaiting = false;
    }
  } while (continueWaiting);
}

export async function clickElement(driver: WebDriver, xpath: string) {
  await waitForElement(driver, xpath);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.wait(until.elementIsVisible(element), 20000);
  await sleep(1000);
  await element.click();
}

export async function writeText(
  driver: WebDriver,
  elementXpath: string,
  text: string
) {
  await waitForElement(driver, elementXpath);
  await (await driver.findElement(By.xpath(elementXpath))).clear();
  const input = await driver.findElement(By.xpath(elementXpath));
  await driver.executeScript("arguments[0].value = '';", input);
  await (await driver.findElement(By.xpath(elementXpath))).sendKeys(text);
}
export async function getText(driver: WebDriver, elementXpath: string) {
  await waitForElement(driver, elementXpath);
  const text = await (
    await driver.findElement(By.xpath(elementXpath))
  ).getText();
  return text;
}
export async function getAttribute(
  driver: WebDriver,
  elementXpath: string,
  attrName = "value"
) {
  await waitForElement(driver, elementXpath);
  const attr = await (
    await driver.findElement(By.xpath(elementXpath))
  ).getAttribute(attrName);
  return attr;
}

///Setup both extensions
//Setup Metamask from "MNEMONIC_META" global env.
//Polkadot extension creating an account.
export async function setupAllExtensions(driver: WebDriver) {
  await leaveOnlyOneTab(driver);

  const metaMaskExtension = new MetaMask(driver);
  await metaMaskExtension.go();
  const metaUserAddress = await metaMaskExtension.setupAccount();

  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.go();
  const [polkUserAddress, usrMnemonic] =
    await polkadotExtension.createAccount();

  await new Mangata(driver).go();
  await sleep(2000);
  await polkadotExtension.acceptPermissions();

  await metaMaskExtension.connect();
  return {
    polkUserAddress: polkUserAddress,
    mnemonic: usrMnemonic,
    metaUserAddres: metaUserAddress,
  };
}

export async function leaveOnlyOneTab(driver: WebDriver) {
  const handles = await (await driver).getAllWindowHandles();
  for (let index = 1; index < handles.length; index++) {
    await (await driver).close();
    await (await driver).switchTo().window(handles[0]);
  }
}

export async function addExtraLogs(driver: WebDriver, testName = "") {
  [logging.Type.BROWSER, logging.Type.DRIVER].forEach(async (value) => {
    await driver
      .manage()
      .logs()
      .get(value)
      .then(function (entries) {
        entries.forEach(function (entry) {
          const logLine = `[${entry.level.name}] ${entry.message}`;
          fs.appendFileSync(
            `${outputPath}/log_${value}_${testName}_${Date.now().toString()}.txt`,
            logLine + " \n"
          );
        });
      });
  });
  const img = await driver.takeScreenshot();
  fs.writeFileSync(`${outputPath}/screenshot_${testName}.png`, img, "base64");
}
export async function renameExtraLogs(testName: string, result = "failed") {
  fs.readdirSync(outputPath).forEach((file) => {
    if (file.includes(testName)) {
      testLog.getLog().info(`Renaming ${file} to FAILED_${file}`);
      fs.renameSync(`${outputPath}/${file}`, `${outputPath}/FAILED_${file}`);
    }
  });
}

export async function getAccountJSON() {
  const path = "utils/frontend/utils/extensions";
  const polkadotUserJson = `${path}/polkadotExportedUser.json`;
  const jsonContent = JSON.parse(
    fs.readFileSync(polkadotUserJson, { encoding: "utf8", flag: "r" })
  );
  return jsonContent;
}

export function buildDataTestIdSelector(dataTestId: string) {
  return By.xpath(buildDataTestIdXpath(dataTestId));
}

export function buildDataTestIdXpath(dataTestId: string) {
  const xpathSelector = `//*[@data-testid='${dataTestId}']`;
  return xpathSelector;
}

export async function doActionInDifferentWindow(
  driver: WebDriver,
  fn: (driver: WebDriver) => void
) {
  await sleep(4000);
  let handle = await (await driver).getAllWindowHandles();
  let iterator = handle.reverse().entries();

  let value = iterator.next().value;
  while (value) {
    await driver.switchTo().window(value[1]);

    try {
      await fn(driver);
      break;
    } catch (error) {}
    value = iterator.next().value;
  }
  handle = await (await driver).getAllWindowHandles();
  iterator = handle.entries();
  value = iterator.next().value;
  testLog.getLog().info("Windows:" + JSON.stringify(handle));
  await driver.switchTo().window(value[1]);
  return;
}

export async function selectAssetFromModalList(
  assetName: string,
  driver: WebDriver
) {
  const assetTestId = `assetSelectModal-asset-${assetName}`;
  const assetLocator = buildDataTestIdXpath(assetTestId);
  await clickElement(driver, assetLocator);
}

export function uiStringToBN(stringValue: string) {
  if (stringValue.includes(".")) {
    const partInt = stringValue.split(".")[0];
    let partDec = stringValue.split(".")[1];
    //multiply the part int*10¹⁸
    const exp = new BN(10).pow(new BN(18));
    const part1 = new BN(partInt).mul(exp);
    //add zeroes to the decimal part.
    while (partDec.length < 18) {
      partDec += "0";
    }
    return part1.add(new BN(partDec));
  } else {
    return new BN((Math.pow(10, 18) * parseFloat(stringValue)).toString());
  }
}
