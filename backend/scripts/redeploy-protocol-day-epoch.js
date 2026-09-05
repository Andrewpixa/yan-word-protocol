/**
 * Redeploy WordProtocol only, keep existing YanToken.
 * Epoch = 86400 so daily check-in is valid for the whole calendar day.
 *
 * Run: npx hardhat run scripts/redeploy-protocol-day-epoch.js --network monad_testnet
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const EPOCH = Number(process.env.EPOCH_SECONDS || 86400);

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function isTransient(e) {
  const msg = `${e.code || ""} ${e.shortMessage || ""} ${e.message || ""}`;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|NETWORK_ERROR|SERVER_ERROR|timeout|Timeout|502|503|429|nonce/i.test(msg);
}

async function sendRetry(sendFn, label, tries = 6) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const tx = await sendFn();
      return await tx.wait();
    } catch (e) {
      last = e;
      if (!isTransient(e) || i === tries) throw e;
      console.warn(`  retry ${i} ${label}: ${e.shortMessage || e.message}`);
      await sleep(2000 * i);
    }
  }
  throw last;
}

async function main() {
  const addrPath = path.join(__dirname, "../addresses.json");
  const prev = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  const yanAddr = prev.yan;
  if (!yanAddr) throw new Error("addresses.json missing yan");

  const [deployer] = await hre.ethers.getSigners();
  const demoMode = process.env.DEMO_MODE !== "false";
  console.log("Deployer:", deployer.address);
  console.log("YanToken (kept):", yanAddr);
  console.log("Old protocol:", prev.protocol);
  console.log("New EPOCH:", EPOCH, "demoMode:", demoMode);

  const Protocol = await hre.ethers.getContractFactory("WordProtocol");
  let protocol;
  for (let i = 1; i <= 6; i++) {
    try {
      protocol = await Protocol.deploy(yanAddr, demoMode, EPOCH);
      await protocol.waitForDeployment();
      break;
    } catch (e) {
      if (!isTransient(e) || i === 6) throw e;
      console.warn(`  retry deploy ${i}: ${e.shortMessage || e.message}`);
      await sleep(3000 * i);
    }
  }
  const protocolAddr = await protocol.getAddress();
  console.log("New WordProtocol:", protocolAddr);

  const yan = await hre.ethers.getContractAt("YanToken", yanAddr, deployer);
  await sendRetry(() => yan.setAuthorized(protocolAddr, true), "setAuthorized");

  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const frontendDir = path.join(__dirname, "../../frontend");

  const env =
    [
      "VITE_RPC_URL=https://testnet-rpc.monad.xyz/",
      `VITE_CHAIN_ID=${chainId}`,
      `VITE_YAN_ADDRESS=${yanAddr}`,
      `VITE_PROTOCOL_ADDRESS=${protocolAddr}`,
      `VITE_DEMO_MODE=${demoMode ? "true" : "false"}`,
      `VITE_EPOCH_SECONDS=${EPOCH}`,
    ].join("\n") + "\n";
  fs.writeFileSync(path.join(frontendDir, ".env.production"), env);

  const envLocalPath = path.join(frontendDir, ".env.local");
  let existing = "";
  try {
    existing = fs.readFileSync(envLocalPath, "utf8");
  } catch {
    existing = "";
  }
  const keep = existing
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("VITE_YAN_ADDRESS=") &&
        !line.startsWith("VITE_PROTOCOL_ADDRESS=") &&
        !line.startsWith("VITE_EPOCH_SECONDS=") &&
        !line.startsWith("VITE_RPC_URL=") &&
        !line.startsWith("VITE_CHAIN_ID=") &&
        !line.startsWith("VITE_DEMO_MODE=")
    )
    .join("\n");
  fs.writeFileSync(envLocalPath, `${env}${keep ? keep + "\n" : ""}`);

  fs.writeFileSync(
    addrPath,
    JSON.stringify(
      {
        yan: yanAddr,
        protocol: protocolAddr,
        chainId,
        demoMode,
        epochSeconds: EPOCH,
        network: hre.network.name,
        previousProtocol: prev.protocol,
      },
      null,
      2
    ) + "\n"
  );

  console.log("Wrote addresses + frontend env.");
  console.log("Explorer:", `https://testnet.monadexplorer.com/address/${protocolAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
