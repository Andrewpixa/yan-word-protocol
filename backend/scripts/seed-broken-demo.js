/**
 * Pre-run one full broken path for pitch: create → guarantee → fade → warp → missSettle.
 * Run: npx hardhat run scripts/seed-broken-demo.js --network monad_testnet
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { yan: yanAddr, protocol: protocolAddr } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );
  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;
  const maker = hre.ethers.Wallet.createRandom().connect(provider);
  const fader = hre.ethers.Wallet.createRandom().connect(provider);

  const yan = await hre.ethers.getContractAt("YanToken", yanAddr, deployer);
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr, deployer);

  console.log("Deployer:", deployer.address);
  console.log("Maker:", maker.address);
  console.log("Fader:", fader.address);

  for (const [who, mon, yanAmt] of [
    [maker, "0.3", "100"],
    [fader, "0.25", "40"],
  ]) {
    await (await deployer.sendTransaction({ to: who.address, value: hre.ethers.parseEther(mon) })).wait();
    await (await yan.transfer(who.address, hre.ethers.parseEther(yanAmt))).wait();
    await (await yan.connect(who).approve(protocolAddr, hre.ethers.MaxUint256)).wait();
  }
  await (await yan.connect(deployer).approve(protocolAddr, hre.ethers.MaxUint256)).wait();

  const stake = hre.ethers.parseEther("25");
  const gStake = hre.ethers.parseEther("20");
  const fadeAmt = hre.ethers.parseEther("10");

  let tx = await protocol.connect(maker).createVow(2, stake, "坚持跑步7天");
  let receipt = await tx.wait();
  const id = Number(await protocol.vowCount()) - 1;
  console.log(`createVow #${id} · ${receipt.hash}`);

  tx = await protocol.connect(deployer).guarantee(id, gStake);
  receipt = await tx.wait();
  console.log(`guarantee · ${receipt.hash}`);

  tx = await protocol.connect(fader).fade(id, fadeAmt);
  receipt = await tx.wait();
  console.log(`fade · ${receipt.hash}`);

  tx = await protocol.demoWarpRounds(3);
  receipt = await tx.wait();
  console.log(`demoWarpRounds(3) · ${receipt.hash}`);

  tx = await protocol.missSettle(id);
  receipt = await tx.wait();
  console.log(`missSettle · ${receipt.hash}`);

  const v = await protocol.getVow(id);
  console.log("\nResult:");
  console.log(`  vow #${id} status=${v.status} (4=已食言)`);
  console.log(`  fadePool leftover=${hre.ethers.formatEther(v.fadePool)}`);
  console.log(`  fader YAN=${hre.ethers.formatEther(await yan.balanceOf(fader.address))}`);
  console.log(`  explorer: https://testnet.monadexplorer.com/tx/${receipt.hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
