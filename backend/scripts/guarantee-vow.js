/**
 * Guarantee a pending vow on Monad Testnet using the deployer key
 * (must not be the maker — contract forbids self-guarantee).
 *
 * Usage: npx hardhat run scripts/guarantee-vow.js --network monad_testnet
 * Optional: VOW_ID=4 GUARANTEE_STAKE=20
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { yan: yanAddr, protocol: protocolAddr } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );
  const vowId = Number(process.env.VOW_ID || 4);
  const stake = hre.ethers.parseEther(process.env.GUARANTEE_STAKE || "20");

  const [deployer] = await hre.ethers.getSigners();
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr, deployer);
  const yan = await hre.ethers.getContractAt("YanToken", yanAddr, deployer);

  const vow = await protocol.getVow(vowId);
  const statement = await protocol.statements(vowId);
  console.log(`Vow #${vowId} 「${statement}」`);
  console.log(`  maker: ${vow.maker}`);
  console.log(`  status: ${Number(vow.status)} (1=待担保 2=履约中)`);
  console.log(`  stakeMaker: ${hre.ethers.formatEther(vow.stakeMaker)} YAN`);
  console.log(`  deployer: ${deployer.address}`);

  if (Number(vow.status) !== 1) {
    throw new Error(`Vow #${vowId} is not Pending (status=${Number(vow.status)})`);
  }
  if (vow.maker.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error("Deployer is the maker — cannot self-guarantee. Need another key.");
  }

  const bal = await yan.balanceOf(deployer.address);
  console.log(`  deployer YAN: ${hre.ethers.formatEther(bal)}`);
  if (bal < stake) throw new Error("Insufficient YAN on deployer");

  await (await yan.approve(protocolAddr, hre.ethers.MaxUint256)).wait();
  const tx = await protocol.guarantee(vowId, stake);
  const receipt = await tx.wait();
  console.log(`Guaranteed ${hre.ethers.formatEther(stake)} YAN · tx ${receipt.hash}`);

  const after = await protocol.getVow(vowId);
  console.log(`  status now: ${Number(after.status)} · guarantor ${after.guarantor}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
