/**
 * Seed a diverse market on Monad Testnet so 「言约市场」shows real cases:
 * pending / active / overdue / kept / broken, plus evidence / referee / pay.
 *
 * Run: npx hardhat run scripts/seed-monad-market-cases.js --network monad_testnet
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const STATUS = ["空", "待担保", "履约中", "已守诺", "已食言"];

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
      const receipt = await tx.wait();
      return receipt;
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

async function fundNative(from, to, etherAmount) {
  await sendRetry(
    () =>
      from.sendTransaction({
        to: to.address,
        value: hre.ethers.parseEther(etherAmount),
      }),
    `fund ${etherAmount} MON → ${to.address.slice(0, 8)}`
  );
}

async function approveMax(yan, who, protocolAddr) {
  await sendRetry(
    () => yan.connect(who).approve(protocolAddr, hre.ethers.MaxUint256),
    `approve ${who.address.slice(0, 8)}`
  );
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
  const maker = hre.ethers.Wallet.createRandom().connect(provider);
  const fader = hre.ethers.Wallet.createRandom().connect(provider);
  const referee = hre.ethers.Wallet.createRandom();
  const payeeA = hre.ethers.Wallet.createRandom().address;
  const payeeB = hre.ethers.Wallet.createRandom().address;

  const yan = await hre.ethers.getContractAt("YanToken", yanAddr, deployer);
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr, deployer);

  console.log("Deployer:", deployer.address);
  console.log("Maker:", maker.address);
  console.log("Fader:", fader.address);
  console.log("Referee:", referee.address);
  console.log("Protocol:", protocolAddr);

  const before = Number(await protocol.vowCount());
  console.log("vowCount before:", before);

  console.log("Funding helpers…");
  await fundNative(deployer, maker, "0.5");
  await fundNative(deployer, fader, "0.35");
  await sendRetry(
    () => yan.transfer(maker.address, hre.ethers.parseEther("250")),
    "transfer 250 YAN → maker"
  );
  await sendRetry(
    () => yan.transfer(fader.address, hre.ethers.parseEther("80")),
    "transfer 80 YAN → fader"
  );
  await approveMax(yan, deployer, protocolAddr);
  await approveMax(yan, maker, protocolAddr);
  await approveMax(yan, fader, protocolAddr);

  async function latestId() {
    return Number(await protocol.vowCount()) - 1;
  }

  // —— 待担保：留给评委钱包点「我信他」——
  await sendRetry(
    () => protocol.connect(deployer).createVow(5, hre.ethers.parseEther("15"), "每天少刷手机一小时"),
    "create 每天少刷手机一小时"
  );
  console.log(`#${await latestId()} 待担保 · 每日报到 · 无需证据 · 「每天少刷手机一小时」`);

  await sendRetry(
    () =>
      protocol
        .connect(deployer)
        .createVowEx(3, hre.ethers.parseEther("20"), 0, 1, hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, 0, "每天拍一张日出"),
    "create 每天拍一张日出"
  );
  console.log(`#${await latestId()} 待担保 · 每日报到 · 需要证据 · 「每天拍一张日出」`);

  await sendRetry(
    () =>
      protocol
        .connect(deployer)
        .createVowEx(4, hre.ethers.parseEther("20"), 1, 0, hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, 0, "本周写完一份提案"),
    "create 本周写完一份提案"
  );
  console.log(`#${await latestId()} 待担保 · 到期验收 · 无需证据 · 「本周写完一份提案」`);

  await sendRetry(
    () =>
      protocol
        .connect(deployer)
        .createVowEx(5, hre.ethers.parseEther("25"), 1, 1, referee.address, hre.ethers.ZeroAddress, 0, "交齐课程作业"),
    "create 交齐课程作业"
  );
  console.log(`#${await latestId()} 待担保 · 到期验收 · 证据+独立裁判 · 「交齐课程作业」`);

  await sendRetry(
    () =>
      protocol
        .connect(deployer)
        .createVowEx(4, hre.ethers.parseEther("30"), 1, 2, hre.ethers.ZeroAddress, payeeA, hre.ethers.parseEther("10"), "月底还清室友垫付款"),
    "create 月底还清室友垫付款"
  );
  console.log(`#${await latestId()} 待担保 · 到期验收 · 链上还款 · 「月底还清室友垫付款」`);

  // 先结算「已守诺 / 已食言 / 已逾期」，再开履约中盘口。
  // demoWarp 会拨协议时钟，后建的每日约才不会被一起打成逾期。

  await sendRetry(
    () => protocol.connect(maker).createVow(1, hre.ethers.parseEther("15"), "每天冥想10分钟"),
    "create 每天冥想10分钟"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("15")), `guarantee #${id}`);
    await sendRetry(() => protocol.connect(maker).checkIn(id), `checkIn #${id}`);
    console.log(`#${id} 已守诺 · 「每天冥想10分钟」`);
  }

  await sendRetry(
    () => protocol.connect(maker).createVow(2, hre.ethers.parseEther("20"), "连续早起6点"),
    "create 连续早起6点"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("15")), `guarantee #${id}`);
    await sendRetry(() => protocol.demoWarpRounds(2), "warp 2");
    console.log(`#${id} 履约中 · 已逾期可食言结算 · 「连续早起6点」`);
  }

  await sendRetry(
    () => protocol.connect(maker).createVow(2, hre.ethers.parseEther("25"), "戒烟7天·演示食言"),
    "create 戒烟7天·演示食言"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("20")), `guarantee #${id}`);
    await sendRetry(() => protocol.connect(fader).fade(id, hre.ethers.parseEther("10")), `fade #${id}`);
    await sendRetry(() => protocol.demoWarpRounds(3), "warp 3");
    const receipt = await sendRetry(() => protocol.missSettle(id), `missSettle #${id}`);
    console.log(`#${id} 已食言 · 看衰已分账 · 「戒烟7天·演示食言」 · ${receipt.hash}`);
  }

  // —— 履约中（时钟已拨完，这些盘口仍在窗口内）——
  await sendRetry(
    () => protocol.connect(maker).createVow(3, hre.ethers.parseEther("20"), "每天背20个单词"),
    "create 每天背20个单词"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("18")), `guarantee #${id}`);
    console.log(`#${id} 履约中 · 每日报到 · 无人看衰 · 「每天背20个单词」`);
  }

  await sendRetry(
    () => protocol.connect(maker).createVow(4, hre.ethers.parseEther("25"), "每周去三次健身房"),
    "create 每周去三次健身房"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("20")), `guarantee #${id}`);
    await sendRetry(() => protocol.connect(fader).fade(id, hre.ethers.parseEther("10")), `fade #${id}`);
    console.log(`#${id} 履约中 · 每日报到 · 已有看衰 10 YAN · 「每周去三次健身房」`);
  }

  await sendRetry(
    () => protocol.connect(maker).createVow(7, hre.ethers.parseEther("20"), "连续7天不点外卖"),
    "create 连续7天不点外卖"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("18")), `guarantee #${id}`);
    await sendRetry(() => protocol.connect(maker).checkIn(id), `checkIn #${id}`);
    await sendRetry(() => protocol.connect(fader).fade(id, hre.ethers.parseEther("8")), `fade #${id}`);
    console.log(`#${id} 履约中 · 已打卡 1/7 + 看衰 8 YAN · 「连续7天不点外卖」`);
  }

  await sendRetry(
    () =>
      protocol
        .connect(maker)
        .createVowEx(6, hre.ethers.parseEther("20"), 1, 1, hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, 0, "本月减脂打卡"),
    "create 本月减脂打卡"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("15")), `guarantee #${id}`);
    await sendRetry(
      () => protocol.connect(maker).submitEvidence(id, hre.ethers.id("week1-weight-photo")),
      `evidence #${id}`
    );
    console.log(`#${id} 履约中 · 已上传证据 · 「本月减脂打卡」`);
  }

  await sendRetry(
    () =>
      protocol
        .connect(maker)
        .createVowEx(3, hre.ethers.parseEther("15"), 1, 2, hre.ethers.ZeroAddress, payeeB, hre.ethers.parseEther("5"), "下周还清咖啡钱"),
    "create 下周还清咖啡钱"
  );
  {
    const id = await latestId();
    await sendRetry(() => protocol.connect(deployer).guarantee(id, hre.ethers.parseEther("15")), `guarantee #${id}`);
    console.log(`#${id} 履约中 · 链上还款未付 · 「下周还清咖啡钱」`);
  }

  const after = Number(await protocol.vowCount());
  console.log("\n=== Market snapshot ===");
  console.log("vowCount:", after, `(+${after - before})`);
  for (let i = 0; i < after; i++) {
    const v = await protocol.getVow(i);
    const s = await protocol.statements(i);
    console.log(
      `  #${i} ${STATUS[Number(v.status)]} 「${s}」 stake=${hre.ethers.formatEther(v.stakeMaker)} checked=${v.daysChecked}/${v.daysRequired} fade=${hre.ethers.formatEther(v.fadePool)}`
    );
  }
  console.log("\nExplorer:", `https://testnet.monadexplorer.com/address/${protocolAddr}`);
  console.log("Refresh the frontend on Monad Testnet to load these rows.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
