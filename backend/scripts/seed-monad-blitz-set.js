/**
 * Seed a Blitz-ready market on current Monad Testnet addresses.json:
 * - 1× Broken (食言红边)
 * - 1× Active + fade (可看衰)
 * - 1× Pending evidence (待担保 + 证据)
 * - 1× Pending pay (待担保 + 链上还款)
 * - 1× Pending plain (待担保 · 每日报到)
 *
 * Run: npx hardhat run scripts/seed-monad-blitz-set.js --network monad_testnet
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const STATUS = ["空", "待担保", "履约中", "已守诺", "已食言"];

async function main() {
  const { yan: yanAddr, protocol: protocolAddr } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );
  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;

  const maker = hre.ethers.Wallet.createRandom().connect(provider);
  const fader = hre.ethers.Wallet.createRandom().connect(provider);
  const helper = hre.ethers.Wallet.createRandom().connect(provider);

  const yan = await hre.ethers.getContractAt("YanToken", yanAddr, deployer);
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr, deployer);

  console.log("Deployer:", deployer.address);
  console.log("Protocol:", protocolAddr);
  console.log("Maker:", maker.address);
  console.log("Fader:", fader.address);
  console.log("Helper:", helper.address);

  const before = Number(await protocol.vowCount());
  console.log("vowCount before:", before);

  // Fund helpers (Monad fees can be spiky)
  for (const [w, mon, amt] of [
    [maker, "0.35", "120"],
    [fader, "0.3", "60"],
    [helper, "0.3", "80"],
  ]) {
    await (await deployer.sendTransaction({ to: w.address, value: hre.ethers.parseEther(mon) })).wait();
    await (await yan.transfer(w.address, hre.ethers.parseEther(amt))).wait();
    await (await yan.connect(w).approve(protocolAddr, hre.ethers.MaxUint256)).wait();
  }
  await (await yan.connect(deployer).approve(protocolAddr, hre.ethers.MaxUint256)).wait();

  const txs = [];

  // A) Broken path — maker creates, deployer guarantees, fader fades, warp, missSettle
  {
    let tx = await protocol.connect(maker).createVow(2, hre.ethers.parseEther("25"), "坚持跑步7天·演示食言");
    let receipt = await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    txs.push(["createVow broken", receipt.hash, id]);

    tx = await protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("20"));
    receipt = await tx.wait();
    txs.push(["guarantee", receipt.hash, id]);

    tx = await protocol.connect(fader).fade(id, hre.ethers.parseEther("10"));
    receipt = await tx.wait();
    txs.push(["fade", receipt.hash, id]);

    tx = await protocol.demoWarpRounds(3);
    receipt = await tx.wait();
    txs.push(["demoWarpRounds(3)", receipt.hash, id]);

    tx = await protocol.missSettle(id);
    receipt = await tx.wait();
    txs.push(["missSettle → 已食言", receipt.hash, id]);
    console.log(`#${id} 已食言 · 「坚持跑步7天·演示食言」 · ${receipt.hash}`);
  }

  // B) Active + fade
  {
    let tx = await protocol.connect(helper).createVow(3, hre.ethers.parseEther("25"), "每天读30页书");
    await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    tx = await protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("20"));
    await tx.wait();
    tx = await protocol.connect(fader).fade(id, hre.ethers.parseEther("8"));
    const receipt = await tx.wait();
    console.log(`#${id} 履约中 · 已有看衰 · 「每天读30页书」 · ${receipt.hash}`);
  }

  // C) Pending · evidence
  {
    const tx = await protocol.connect(deployer).createVowEx(
      3,
      hre.ethers.parseEther("20"),
      0,
      1,
      hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress,
      0,
      "坚持11点前睡觉"
    );
    const receipt = await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    console.log(`#${id} 待担保 · 需要证据 · 「坚持11点前睡觉」 · ${receipt.hash}`);
  }

  // D) Pending · on-chain pay
  {
    const tx = await protocol.connect(deployer).createVowEx(
      4,
      hre.ethers.parseEther("30"),
      1,
      2,
      hre.ethers.ZeroAddress,
      helper.address,
      hre.ethers.parseEther("10"),
      "到期还清借款"
    );
    const receipt = await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    console.log(`#${id} 待担保 · 链上还款 · 「到期还清借款」 · ${receipt.hash}`);
  }

  // E) Pending · plain daily
  {
    const tx = await protocol.connect(maker).createVow(5, hre.ethers.parseEther("15"), "连续健身打卡5天");
    const receipt = await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;
    console.log(`#${id} 待担保 · 每日报到 · 「连续健身打卡5天」 · ${receipt.hash}`);
  }

  const after = Number(await protocol.vowCount());
  console.log("\n=== Market snapshot ===");
  console.log("vowCount:", after);
  for (let i = 0; i < after; i++) {
    const v = await protocol.getVow(i);
    const s = await protocol.statements(i);
    console.log(
      `  #${i} ${STATUS[Number(v.status)]} 「${s}」 stake=${hre.ethers.formatEther(v.stakeMaker)} fadePool=${hre.ethers.formatEther(v.fadePool)}`
    );
  }
  console.log("\nExplorer protocol:", `https://testnet.monadexplorer.com/address/${protocolAddr}`);
  console.log("Refresh frontend on Monad Testnet to load these rows from chain.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
