/**
 * Fresh “I am the maker” cases. Epoch is 60s — punch immediately after this run.
 *
 * Run: npx hardhat run scripts/seed-monad-maker-fulfill.js --network monad_testnet
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const STATUS = ["空", "待担保", "履约中", "已守诺", "已食言"];

const CHECKINS = [
  "今天走够8000步",
  "中午不喝奶茶",
  "晚上10点放下手机",
  "晨跑3公里",
  "读完一章专业书",
];

const EVIDENCE = [
  { text: "上传健身器械自拍", kind: 0, days: 4 },
  { text: "上传英语作业截图", kind: 1, days: 5 },
  { text: "上传减脂体重照片", kind: 1, days: 6 },
  { text: "上传早起打卡照", kind: 0, days: 3 },
];

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function isTransient(e) {
  const msg = `${e.code || ""} ${e.shortMessage || ""} ${e.message || ""}`;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|NETWORK_ERROR|SERVER_ERROR|timeout|Timeout|502|503|429|nonce/i.test(
    msg
  );
}

async function sendRetry(sendFn, label, tries = 6) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const tx = await sendFn();
      return await tx.wait();
    } catch (e) {
      last = e;
      const msg = e.shortMessage || e.message || String(e);
      if (!isTransient(e) || i === tries) {
        console.warn(`  fail ${label}: ${msg}`);
        throw e;
      }
      console.warn(`  retry ${i}/${tries} ${label}: ${msg}`);
      await sleep(2000 * i);
    }
  }
  throw last;
}

async function main() {
  const { yan: yanAddr, protocol: protocolAddr, network } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );
  if (network !== "monad_testnet" && hre.network.name !== "monad_testnet") {
    throw new Error(`Expected monad_testnet, got network=${network} hardhat=${hre.network.name}`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;
  const guarantor = hre.ethers.Wallet.createRandom().connect(provider);

  const yan = await hre.ethers.getContractAt("YanToken", yanAddr, deployer);
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr, deployer);

  console.log("Maker (you):", deployer.address);
  console.log("Guarantor:", guarantor.address);

  await sendRetry(
    () =>
      deployer.sendTransaction({
        to: guarantor.address,
        value: hre.ethers.parseEther("0.4"),
      }),
    "fund MON"
  );
  await sendRetry(() => yan.transfer(guarantor.address, hre.ethers.parseEther("180")), "fund YAN");
  await sendRetry(() => yan.connect(deployer).approve(protocolAddr, hre.ethers.MaxUint256), "approve deployer");
  await sendRetry(() => yan.connect(guarantor).approve(protocolAddr, hre.ethers.MaxUint256), "approve guarantor");

  async function latestId() {
    return Number(await protocol.vowCount()) - 1;
  }

  const created = [];

  for (const statement of CHECKINS) {
    await sendRetry(
      () => protocol.connect(deployer).createVow(4, hre.ethers.parseEther("15"), statement),
      `create ${statement}`
    );
    const id = await latestId();
    await sendRetry(
      () => protocol.connect(guarantor).guarantee(id, hre.ethers.parseEther("15")),
      `guarantee #${id}`
    );
    created.push(`#${id} 待签到 「${statement}」`);
    console.log(created[created.length - 1]);
  }

  for (const item of EVIDENCE) {
    await sendRetry(
      () =>
        protocol
          .connect(deployer)
          .createVowEx(
            item.days,
            hre.ethers.parseEther("18"),
            item.kind,
            1,
            hre.ethers.ZeroAddress,
            hre.ethers.ZeroAddress,
            0,
            item.text
          ),
      `create ${item.text}`
    );
    const id = await latestId();
    await sendRetry(
      () => protocol.connect(guarantor).guarantee(id, hre.ethers.parseEther("15")),
      `guarantee #${id}`
    );
    created.push(`#${id} 待传证据 「${item.text}」`);
    console.log(created[created.length - 1]);
  }

  console.log("\nThese stay open for the rest of the calendar day.");
  console.log(created.join("\n"));
  const after = Number(await protocol.vowCount());
  console.log("vowCount:", after);
  for (let i = after - created.length; i < after; i++) {
    const v = await protocol.getVow(i);
    const s = await protocol.statements(i);
    console.log(`  #${i} ${STATUS[Number(v.status)]} 「${s}」 ${v.daysChecked}/${v.daysRequired}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
