/** Guarantee one pending vow so the fade panel has an Active market. */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { yan: yanAddr, protocol: protocolAddr } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );
  const signers = await hre.ethers.getSigners();
  const wB = signers[1];
  const yan = await hre.ethers.getContractAt("YanToken", yanAddr);
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr);

  const count = Number(await protocol.vowCount());
  let target = -1;
  for (let i = 0; i < count; i++) {
    const v = await protocol.getVow(i);
    if (Number(v.status) === 1 && v.maker.toLowerCase() !== wB.address.toLowerCase()) {
      target = i;
      break;
    }
  }
  if (target < 0) {
    console.log("No pending vow for B to guarantee");
    return;
  }

  const stake = hre.ethers.parseEther("50");
  await (await yan.connect(wB).approve(protocolAddr, hre.ethers.MaxUint256)).wait();
  const tx = await protocol.connect(wB).guarantee(target, stake);
  await tx.wait();
  console.log(`Wallet B guaranteed #${target} — now Active, ready for fade bets`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
