/**
 * Create two daily vows and check in immediately so records exist,
 * plus two longer-window evidence vows the user can still upload to.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

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
      await sleep(1500 * i);
    }
  }
  throw last;
}

async function main() {
  const { yan: yanAddr, protocol: protocolAddr } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );
  const [deployer] = await hre.ethers.getSigners();
  const guarantor = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const yan = await hre.ethers.getContractAt("YanToken", yanAddr, deployer);
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr, deployer);

  await sendRetry(
    () => deployer.sendTransaction({ to: guarantor.address, value: hre.ethers.parseEther("0.25") }),
    "mon"
  );
  await sendRetry(() => yan.transfer(guarantor.address, hre.ethers.parseEther("80")), "yan");
  await sendRetry(() => yan.connect(deployer).approve(protocolAddr, hre.ethers.MaxUint256), "ad");
  await sendRetry(() => yan.connect(guarantor).approve(protocolAddr, hre.ethers.MaxUint256), "ag");

  async function id() {
    return Number(await protocol.vowCount()) - 1;
  }

  for (const statement of ["会议室纪要今日写完", "午饭后散步20分钟"]) {
    await sendRetry(
      () => protocol.connect(deployer).createVow(4, hre.ethers.parseEther("15"), statement),
      statement
    );
    const n = await id();
    await sendRetry(() => protocol.connect(guarantor).guarantee(n, hre.ethers.parseEther("15")), `g#${n}`);
    await sendRetry(() => protocol.connect(deployer).checkIn(n), `check#${n}`);
    console.log(`#${n} 已签第 1 天 「${statement}」`);
  }

  for (const statement of ["上传会议纪要截图", "上传散步轨迹截图"]) {
    await sendRetry(
      () =>
        protocol
          .connect(deployer)
          .createVowEx(12, hre.ethers.parseEther("18"), 1, 1, hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, 0, statement),
      statement
    );
    const n = await id();
    await sendRetry(() => protocol.connect(guarantor).guarantee(n, hre.ethers.parseEther("15")), `g#${n}`);
    console.log(`#${n} 待传证据（约 12 分钟窗口）「${statement}」`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
