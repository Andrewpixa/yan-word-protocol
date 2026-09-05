const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer, a, b, c, d] = await hre.ethers.getSigners();

  // Blitz 默认：短轮次 + 可快进。正式长周期可设 EPOCH_SECONDS=86400 DEMO_MODE=false
  const demoMode = process.env.DEMO_MODE !== "false";
  const epochSeconds = Number(process.env.EPOCH_SECONDS || 60);

  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name, "demoMode:", demoMode, "epoch:", epochSeconds);

  const Yan = await hre.ethers.getContractFactory("YanToken");
  const yan = await Yan.deploy();
  await yan.waitForDeployment();
  const yanAddr = await yan.getAddress();
  console.log("YanToken:", yanAddr);

  const Protocol = await hre.ethers.getContractFactory("WordProtocol");
  const protocol = await Protocol.deploy(yanAddr, demoMode, epochSeconds);
  await protocol.waitForDeployment();
  const protocolAddr = await protocol.getAddress();
  console.log("WordProtocol:", protocolAddr);

  await (await yan.setAuthorized(protocolAddr, true)).wait();

  const fund = hre.ethers.parseEther("5000");
  for (const who of [a, b, c, d]) {
    if (!who) continue;
    await (await yan.transfer(who.address, fund)).wait();
  }

  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const rpc =
    hre.network.name === "monad_testnet"
      ? process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz/"
      : "http://127.0.0.1:8545";

  const frontendDir = path.join(__dirname, "../../frontend");
  fs.mkdirSync(frontendDir, { recursive: true });

  if (hre.network.name === "monad_testnet") {
    // 测试网：写 production，并保留本地地址不被覆盖
    const env =
      [
        `VITE_RPC_URL=${rpc}`,
        `VITE_CHAIN_ID=${chainId}`,
        `VITE_YAN_ADDRESS=${yanAddr}`,
        `VITE_PROTOCOL_ADDRESS=${protocolAddr}`,
        `VITE_DEMO_MODE=${demoMode ? "true" : "false"}`,
        `VITE_EPOCH_SECONDS=${epochSeconds}`,
      ].join("\n") + "\n";
    const envPath = path.join(frontendDir, ".env.production");
    fs.writeFileSync(envPath, env);
    console.log("Wrote", envPath);
  } else {
    // 本地：写 local-deploy.json + VITE_LOCAL_*，不覆盖测试网地址
    const localDeployPath = path.join(frontendDir, "src/local-deploy.json");
    fs.writeFileSync(
      localDeployPath,
      JSON.stringify(
        {
          yan: yanAddr,
          protocol: protocolAddr,
          chainId: Number(chainId),
          demoMode,
          epochSeconds,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ) + "\n"
    );
    console.log("Wrote", localDeployPath);

    const localEnv =
      [
        `VITE_LOCAL_YAN_ADDRESS=${yanAddr}`,
        `VITE_LOCAL_PROTOCOL_ADDRESS=${protocolAddr}`,
        `VITE_LOCAL_EPOCH_SECONDS=${epochSeconds}`,
      ].join("\n") + "\n";
    // 追加/更新 .env.local 中的 LOCAL 变量，保留已有 Monad 配置
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
          !line.startsWith("VITE_LOCAL_YAN_ADDRESS=") &&
          !line.startsWith("VITE_LOCAL_PROTOCOL_ADDRESS=") &&
          !line.startsWith("VITE_LOCAL_EPOCH_SECONDS=")
      )
      .join("\n");
    // 若 .env.local 缺测试网 RPC/chain，只补网络配置，不写死任何合约地址
    const hasMonadNet = /VITE_CHAIN_ID=10143/.test(keep);
    const monadDefaults = hasMonadNet
      ? ""
      : [
          "VITE_RPC_URL=https://testnet-rpc.monad.xyz/",
          "VITE_CHAIN_ID=10143",
          "VITE_YAN_ADDRESS=",
          "VITE_PROTOCOL_ADDRESS=",
          "VITE_DEMO_MODE=true",
          "VITE_EPOCH_SECONDS=60",
          "",
        ].join("\n");
    fs.writeFileSync(
      envLocalPath,
      `${monadDefaults}${keep ? keep + "\n" : ""}${localEnv}`
    );
    console.log("Updated", envLocalPath, "(kept Monad net config + local addresses)");
  }

  fs.writeFileSync(
    path.join(__dirname, "../addresses.json"),
    JSON.stringify(
      {
        yan: yanAddr,
        protocol: protocolAddr,
        chainId: Number(chainId),
        demoMode,
        epochSeconds,
        network: hre.network.name,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
