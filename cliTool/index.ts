/* eslint-disable no-console */
/**
 * cd cliTool
 * yarn
 * npx ts-node index.ts --runInBand
 * If you want to define the url ( default is localhost:9946 )
 * API_URL="wss://mangata-x.api.onfinality.io/public-ws"  npx ts-node ./index.ts --runInBand
 */
import inquirer from "inquirer";
import {
  giveTokensToUser,
  joinAFewCandidates,
  joinAsCandidate,
  setupPoolWithRewardsForDefaultUsers,
  fillWithDelegators,
  printCandidatesNotProducing,
  createCustomPool,
  setupACouncilWithDefaultUsers,
  vetoMotion,
  migrate,
  userAggregatesOn,
  subscribeAndPrintTokenChanges,
  provisionWith100Users,
  findAllRewardsAndClaim,
} from "../utils/setupsOnTheGo";
import {
  findErrorMetadata,
  getEnvironmentRequiredVars,
  printCandidatePowers,
  swapEachNBlocks,
} from "../utils/utils";
import { Node } from "../utils/Framework/Node/Node";
import { SudoUser } from "../utils/Framework/User/SudoUser";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../utils/api";
import { User } from "../utils/User";
import { BN, BN_ZERO, Mangata } from "@mangata-finance/sdk";

async function app(): Promise<any> {
  return inquirer
    .prompt({
      type: "list",
      message: "Select setup",
      name: "option",
      choices: [
        "Setup rewards with default users",
        "Setup a collator with token",
        "Join as candidate",
        "Fill with candidates",
        "Give tokens to user",
        "Foo",
        "Find Error",
        "Enable liq token",
        "Is collator chosen?",
        "Get powers",
        "Fill with delegators",
        "Swap each 11 blocks",
        "From string to Hex",
        "get pools",
        "Who is offline",
        "createPool",
        "createACouncil",
        "veto",
        "migrateData",
        "user aggregates with",
        "listen token balance changes",
        "provisionWith100Users",
        "find and claim all rewards",
      ],
    })
    .then(async (answers: { option: string | string[] }) => {
      console.log("Answers::: " + JSON.stringify(answers, null, "  "));
      if (answers.option.includes("Setup rewards with default users")) {
        const setupData = await setupPoolWithRewardsForDefaultUsers();
        console.log("liq Id = " + setupData.liqId);
      }
      if (answers.option.includes("Setup a collator with token")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "default //Charlie",
            },
            {
              type: "input",
              name: "liq",
              message: "liq id",
            },
            {
              type: "input",
              name: "amount",
              message: "amountToJoin",
            },
          ])
          .then(
            async (answers: {
              user: string | undefined;
              liq: number | undefined;
              amount: string | 0;
            }) => {
              let liq = new BN(answers.liq!.toString());
              const amount = new BN(answers.amount!.toString());
              if (liq!.eq(BN_ZERO)) {
                const setupData = await setupPoolWithRewardsForDefaultUsers();
                console.log("liq Id = " + setupData.liqId);
                liq = new BN(setupData.liqId);
              }
              const node = new Node(getEnvironmentRequiredVars().chainUri);
              await node.connect();
              const keyring = new Keyring({ type: "sr25519" });
              const sudo = new SudoUser(keyring, node);
              await sudo.addStakingLiquidityToken(liq);
              await joinAsCandidate(
                answers.user,
                liq?.toNumber(),
                new BN(amount)
              );
              console.log("Done");
              return app();
            }
          );
      }
      if (answers.option.includes("Join as candidate")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "default //Charlie",
            },
            {
              type: "input",
              name: "liq",
              message: "liq id",
            },
          ])
          .then(
            async (answers: {
              user: string | undefined;
              liq: number | undefined;
            }) => {
              await joinAsCandidate(answers.user, answers.liq);
              console.log("Done");
              return app();
            }
          );
      }
      if (answers.option.includes("Give tokens to user")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "default //Charlie",
            },
            {
              type: "input",
              name: "liq",
              message: "liq id",
            },
          ])
          .then(
            async (answers: {
              user: string | undefined;
              liq: number | undefined;
            }) => {
              await giveTokensToUser(answers.user, answers.liq);
              console.log("Done");
              return app();
            }
          );
      }
      if (answers.option.includes("Find Error")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "hex",
              message: "",
            },
            {
              type: "input",
              name: "index",
              message: "",
            },
          ])
          .then(async (answers: { hex: string; index: string }) => {
            await findErrorMetadata(answers.hex, answers.index);
            console.log("Done");
            return app();
          });
      }
      if (answers.option.includes("Enable liq token")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqToken",
              message: "",
            },
          ])
          .then(async (answers: { liqToken: import("bn.js") }) => {
            const node = new Node(getEnvironmentRequiredVars().chainUri);
            await node.connect();
            const keyring = new Keyring({ type: "sr25519" });
            const sudo = new SudoUser(keyring, node);
            await sudo.addStakingLiquidityToken(answers.liqToken);
            console.log("Done");
            return app();
          });
      }
      if (answers.option.includes("Is collator chosen?")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "",
            },
          ])
          .then(async (answers: { user: string | undefined }) => {
            await initApi();
            const api = await getApi();
            const collators =
              await api.query.parachainStaking.selectedCandidates();
            const keyring = new Keyring({ type: "sr25519" });
            const user = new User(keyring, answers.user);
            const result = collators.find(
              (x) => x.toString() === user.keyRingPair.address
            );
            console.info(result?.toString());
            console.info(
              `Is collator selected? : ${
                result && result.toString()?.length > 0 ? true : false
              }`
            );
            return app();
          });
      }
      if (answers.option.includes("Fill with candidates")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqToken",
              message: "",
            },
            {
              type: "input",
              name: "numCandidates",
              message: "",
            },
          ])
          .then(
            async (answers: {
              numCandidates: number | undefined;
              liqToken: number | undefined;
            }) => {
              await joinAFewCandidates(answers.numCandidates, answers.liqToken);
              return app();
            }
          );
      }
      if (answers.option.includes("Fill with delegators")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqToken",
              message: "",
            },
            {
              type: "input",
              name: "numDelegators",
              message: "",
            },
            {
              type: "input",
              name: "targetAddress",
              message: "",
            },
          ])
          .then(
            async (answers: {
              numDelegators: number;
              liqToken: number;
              targetAddress: string;
            }) => {
              await fillWithDelegators(
                answers.numDelegators,
                answers.liqToken,
                answers.targetAddress
              );
              return app();
            }
          );
      }
      if (answers.option.includes("Get powers")) {
        await printCandidatePowers();
      }
      if (answers.option.includes("Swap each 11 blocks")) {
        await swapEachNBlocks(11);
      }
      if (answers.option.includes("From string to Hex")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "str",
              message: "",
            },
          ])
          .then(async (answers: { str: unknown }) => {
            await initApi();
            const api = await getApi();
            const str = api.createType("Vec<u8>", answers.str);
            console.info(str.toString());
            return app();
          });
      }
      if (answers.option.includes("get pools")) {
        const mga = Mangata.getInstance([
          "wss://kusama-archive.mangata.online",
        ]);
        const pools = mga.getPools();
        (await pools).forEach((pool) => console.info(JSON.stringify(pool)));
        return app();
      }
      if (answers.option.includes("createPool")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "User",
            },
            {
              type: "input",
              name: "ratio",
              message: "ratio",
            },
            {
              type: "bool",
              name: "mgaBig",
              message: "MGX bigger?",
            },
          ])
          .then(
            async (answers: {
              mgaBig: string;
              ratio: { toString: () => string };
              user: any;
            }) => {
              await initApi();
              const mgaBig = answers.mgaBig === "true";
              const ratio = parseInt(answers.ratio.toString());
              const user = answers.user;
              await createCustomPool(mgaBig, ratio, user);
              return app();
            }
          );
      }
      if (answers.option.includes("createACouncil")) {
        await initApi();
        await setupACouncilWithDefaultUsers();
        return app();
      }
      if (answers.option.includes("veto")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "motion",
              message: "motion_no",
            },
          ])
          .then(async (answers: { motion: number }) => {
            await initApi();
            await vetoMotion(answers.motion);
            return app();
          });
      }
      if (answers.option.includes("Who is offline")) {
        await printCandidatesNotProducing();
      }
      if (answers.option.includes("migrateData")) {
        await migrate();
      }
      if (answers.option.includes("user aggregates with")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "userAggregating",
              message: "",
            },
            {
              type: "input",
              name: "userWhoDelegates",
              message: "",
            },
          ])
          .then(
            async (answers: {
              userAggregating: string;
              userWhoDelegates: string;
            }) => {
              await userAggregatesOn(
                answers.userAggregating,
                answers.userWhoDelegates
              );
              console.log("Done");
              return app();
            }
          );
      }
      if (answers.option.includes("listen token balance changes")) {
        await subscribeAndPrintTokenChanges(
          getEnvironmentRequiredVars().chainUri
        );
      }
      if (answers.option.includes("provisionWith100Users")) {
        await provisionWith100Users();
      }
      if (answers.option.includes("find and claim all rewards")) {
        await findAllRewardsAndClaim();
      }
      return app();
    });
}

const main = async () => {
  await app();
};
main();
