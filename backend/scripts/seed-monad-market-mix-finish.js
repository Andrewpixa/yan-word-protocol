/**
 * Finish the interrupted market-mix seed:
 * - fade on existing Active #2
 * - create one pending pay vow
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const PROTOCOL_ABI = [
  "function createVowEx(uint256 duration,uint256 stake,uint8 kind,uint8 verifyMode,address referee,address payee,uint256 payAmount,string statement) returns (uint256)",
  "function fade(uint256 id, uint256 amount)",
  "function vowCount() view returns (uint256)",
  "function getVow(uint256 id) view returns (tuple(address maker,address guarantor,uint256 stakeMaker,uint256 stakeGuarantor,uint256 daysRequired,uint256 daysChecked,uint256 lastCheckEpoch,uint256 fadePool,uint8 status))",
  "function statements(uint256 id) view returns (string)",
  "function getFades(uint256 id) view returns (tuple(address better,uint256 amount,bool paid)[])",
];

const YAN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const STATUS = ["空", "待担保", "履约中", "已守诺", "已食言"];

async function main() {
  const { yan: yanAddr, protocol: protocolAddr } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );
  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;
  const fader = hre.ethers.Wallet.createRandom().connect(provider);
  // Fresh payee each run — do not hardcode historical helper wallets.
  const payee = hre.ethers.Wallet.createRandom().address;

  console.log("Deployer:", deployer.address);
  console.log("New fader:", fader.address);

  const yan = new hre.ethers.Contract(yanAddr, YAN_ABI, deployer);
  const protocol = new hre.ethers.Contract(protocolAddr, PROTOCOL_ABI, deployer);

  // More gas for Monad fees
  await (await deployer.sendTransaction({ to: fader.address, value: hre.ethers.parseEther("0.2") })).wait();
  await (await yan.transfer(fader.address, hre.ethers.parseEther("30"))).wait();
  await (await yan.connect(fader).approve(protocolAddr, hre.ethers.MaxUint256)).wait();
  await (await yan.connect(deployer).approve(protocolAddr, hre.ethers.MaxUint256)).wait();

  const count = Number(await protocol.vowCount());
  if (count < 3) throw new Error(`Expected at least 3 vows, got ${count}`);

  const active = await protocol.getVow(2);
  if (Number(active.status) !== 2) throw new Error(`#2 is not Active (status=${active.status})`);
  const fades = await protocol.getFades(2);
  if (fades.length === 0) {
    const tx = await protocol.connect(fader).fade(2, hre.ethers.parseEther("10"));
    const receipt = await tx.wait();
    console.log(`#2 faded 10 YAN · tx ${receipt.hash}`);
  } else {
    console.log(`#2 already has ${fades.length} fade(s), skip`);
  }

  // Pending pay vow (skip if statement already exists)
  let hasPay = false;
  for (let i = 0; i < count; i++) {
    const s = await protocol.statements(i);
    if (s === "到期还清借款") hasPay = true;
  }
  if (!hasPay) {
    const tx = await protocol.createVowEx(
      4,
      hre.ethers.parseEther("30"),
      1,
      2,
      hre.ethers.ZeroAddress,
      payee,
      hre.ethers.parseEther("10"),
      "到期还清借款"
    );
    const receipt = await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    console.log(`#${id} 待担保 · 链上还款 · 「到期还清借款」 · tx ${receipt.hash}`);
  } else {
    console.log("Pay vow already present, skip");
  }

  const after = Number(await protocol.vowCount());
  console.log("\nvowCount:", after);
  for (let i = 0; i < after; i++) {
    const v = await protocol.getVow(i);
    const s = await protocol.statements(i);
    const f = await protocol.getFades(i);
    console.log(
      `  #${i} ${STATUS[Number(v.status)]} 「${s}」 stake=${hre.ethers.formatEther(v.stakeMaker)} fades=${f.length} fadePool=${hre.ethers.formatEther(v.fadePool)}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
