/**
 * Seed a small market mix on Monad Testnet for the current WordProtocol.
 * Uses the deployer key from hardhat.config + 2 ephemeral helpers
 * (self-guarantee / party-fade are forbidden by the contract).
 *
 * Run: npx hardhat run scripts/seed-monad-market-mix.js --network monad_testnet
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const PROTOCOL_ABI = [
  "function createVow(uint256 daysRequired, uint256 stake, string statement) returns (uint256)",
  "function createVowEx(uint256 duration,uint256 stake,uint8 kind,uint8 verifyMode,address referee,address payee,uint256 payAmount,string statement) returns (uint256)",
  "function guarantee(uint256 id, uint256 stake)",
  "function fade(uint256 id, uint256 amount)",
  "function vowCount() view returns (uint256)",
  "function getVow(uint256 id) view returns (tuple(address maker,address guarantor,uint256 stakeMaker,uint256 stakeGuarantor,uint256 daysRequired,uint256 daysChecked,uint256 lastCheckEpoch,uint256 fadePool,uint8 status))",
  "function statements(uint256 id) view returns (string)",
];

const YAN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const STATUS = ["空", "待担保", "履约中", "已守诺", "已食言"];

async function fundNative(from, to, etherAmount) {
  const tx = await from.sendTransaction({
    to: to.address,
    value: hre.ethers.parseEther(etherAmount),
  });
  await tx.wait();
}

async function approveMax(yan, who, protocolAddr) {
  await (await yan.connect(who).approve(protocolAddr, hre.ethers.MaxUint256)).wait();
}

async function main() {
  const addrPath = path.join(__dirname, "../addresses.json");
  const { yan: yanAddr, protocol: protocolAddr, network } = JSON.parse(
    fs.readFileSync(addrPath, "utf8")
  );
  if (network !== "monad_testnet" && hre.network.name !== "monad_testnet") {
    throw new Error(`Expected monad_testnet, got network=${network} hardhat=${hre.network.name}`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;

  // Ephemeral helpers — only used for this seed run.
  const helper = hre.ethers.Wallet.createRandom().connect(provider);
  const fader = hre.ethers.Wallet.createRandom().connect(provider);

  console.log("Deployer:", deployer.address);
  console.log("Helper (maker / payee):", helper.address);
  console.log("Fader:", fader.address);
  console.log("Protocol:", protocolAddr);

  const yan = new hre.ethers.Contract(yanAddr, YAN_ABI, deployer);
  const protocol = new hre.ethers.Contract(protocolAddr, PROTOCOL_ABI, deployer);

  const before = Number(await protocol.vowCount());
  console.log("vowCount before:", before);

  // Gas + YAN for helpers
  console.log("Funding helpers…");
  // Monad testnet fees can be spiky — keep helpers well funded.
  await fundNative(deployer, helper, "0.25");
  await fundNative(deployer, fader, "0.2");
  await (await yan.transfer(helper.address, hre.ethers.parseEther("200"))).wait();
  await (await yan.transfer(fader.address, hre.ethers.parseEther("50"))).wait();

  await approveMax(yan, deployer, protocolAddr);
  await approveMax(yan, helper, protocolAddr);
  await approveMax(yan, fader, protocolAddr);

  // 1) Pending · 需要证据（部署钱包发起，留给别人担保 / 立约人上传证据）
  {
    const stake = hre.ethers.parseEther("20");
    const tx = await protocol.createVowEx(
      3,
      stake,
      0, // daily
      1, // evidence
      hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress,
      0,
      "坚持11点前睡觉"
    );
    const receipt = await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    console.log(`#${id} 待担保 · 每日报到 · 需要证据 · 「坚持11点前睡觉」 · tx ${receipt.hash}`);
  }

  // 2) Active · 可看衰（助手立约 → 部署钱包担保 → 另一助手看衰）
  {
    const stake = hre.ethers.parseEther("25");
    const gStake = hre.ethers.parseEther("20");
    const fadeAmt = hre.ethers.parseEther("10");
    let tx = await protocol.connect(helper).createVow(2, stake, "每天读30页书");
    await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    tx = await protocol.connect(deployer).guarantee(id, gStake);
    await tx.wait();
    tx = await protocol.connect(fader).fade(id, fadeAmt);
    const receipt = await tx.wait();
    console.log(
      `#${id} 履约中 · 每日报到 · 无需证据 · 「每天读30页书」 · 已有看衰 10 YAN · tx ${receipt.hash}`
    );
  }

  // 3) Pending · 链上还款（还款给助手）
  {
    const stake = hre.ethers.parseEther("30");
    const pay = hre.ethers.parseEther("10");
    const tx = await protocol.createVowEx(
      4,
      stake,
      1, // deadline
      2, // pay
      hre.ethers.ZeroAddress,
      helper.address,
      pay,
      "到期还清借款"
    );
    const receipt = await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    console.log(`#${id} 待担保 · 到期验收 · 链上还款 · 「到期还清借款」 · tx ${receipt.hash}`);
  }

  const after = Number(await protocol.vowCount());
  console.log("\nvowCount after:", after);
  for (let i = 0; i < after; i++) {
    const v = await protocol.getVow(i);
    const statement = await protocol.statements(i);
    console.log(
      `  #${i} ${STATUS[Number(v.status)]} · ${statement} · stake ${hre.ethers.formatEther(v.stakeMaker)} · checked ${v.daysChecked}/${v.daysRequired}`
    );
  }
  console.log("\nRefresh the frontend — 「全部言约」 should list these rows.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
