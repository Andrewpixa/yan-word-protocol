/**
 * Seed Active vows for the「看衰下注」panel.
 * Creates vows + guarantees them so faders can pick a market and bet.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function approve(yan, who, protocolAddr) {
  await (await yan.connect(who).approve(protocolAddr, hre.ethers.MaxUint256)).wait();
}

async function main() {
  const { yan: yanAddr, protocol: protocolAddr } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addresses.json"), "utf8")
  );

  const signers = await hre.ethers.getSigners();
  const wA = signers[0];
  const wB = signers[1];
  const wC = signers[2];
  const wD = signers[3];

  const yan = await hre.ethers.getContractAt("YanToken", yanAddr);
  const protocol = await hre.ethers.getContractAt("WordProtocol", protocolAddr);

  for (const w of [wA, wB, wC, wD]) {
    await approve(yan, w, protocolAddr);
  }

  // maker / guarantor pairs leave other wallets free to fade
  const markets = [
    {
      maker: wA,
      makerLabel: "A",
      guarantor: wB,
      guarantorLabel: "B",
      duration: 3,
      stake: "50",
      gStake: "40",
      kind: 0,
      verify: 0,
      note: "每日报到 · 无证据（C/D 可看衰）",
      statement: "坚持跑步7天",
      preFade: { who: wC, label: "C", amount: "15" },
    },
    {
      maker: wA,
      makerLabel: "A",
      guarantor: wD,
      guarantorLabel: "D",
      duration: 4,
      stake: "35",
      gStake: "30",
      kind: 1,
      verify: 0,
      note: "到期验收 · 无证据（B/C 可看衰）",
      statement: "坚持11点前睡觉",
      preFade: null,
    },
    {
      maker: wC,
      makerLabel: "C",
      guarantor: wB,
      guarantorLabel: "B",
      duration: 2,
      stake: "25",
      gStake: "25",
      kind: 0,
      verify: 1,
      note: "每日报到 · 需证据（A/D 可看衰）",
      statement: "每天读30页书",
      preFade: { who: wD, label: "D", amount: "10" },
    },
    {
      maker: wD,
      makerLabel: "D",
      guarantor: wB,
      guarantorLabel: "B",
      duration: 5,
      stake: "40",
      gStake: "35",
      kind: 1,
      verify: 2,
      payee: wA.address,
      pay: "10",
      note: "到期还款给 A（A/C 可看衰）",
      statement: "到期还清借款",
      preFade: null,
    },
  ];

  const before = Number(await protocol.vowCount());

  for (const m of markets) {
    const stake = hre.ethers.parseEther(m.stake);
    const gStake = hre.ethers.parseEther(m.gStake);
    let tx;
    if (m.kind === 0 && m.verify === 0) {
      tx = await protocol.connect(m.maker).createVow(m.duration, stake, m.statement);
    } else {
      tx = await protocol.connect(m.maker).createVowEx(
        m.duration,
        stake,
        m.kind,
        m.verify,
        hre.ethers.ZeroAddress,
        m.payee || hre.ethers.ZeroAddress,
        m.pay ? hre.ethers.parseEther(m.pay) : 0n,
        m.statement
      );
    }
    await tx.wait();
    const id = Number(await protocol.vowCount()) - 1;

    await (await protocol.connect(m.guarantor).guarantee(id, gStake)).wait();

    if (m.preFade) {
      const amt = hre.ethers.parseEther(m.preFade.amount);
      await (await protocol.connect(m.preFade.who).fade(id, amt)).wait();
      console.log(
        `#${id} Active · 立约${m.makerLabel}/担保${m.guarantorLabel} · ${m.note} · 已有看衰 ${m.preFade.label}=${m.preFade.amount}`
      );
    } else {
      console.log(`#${id} Active · 立约${m.makerLabel}/担保${m.guarantorLabel} · ${m.note}`);
    }
  }

  const after = Number(await protocol.vowCount());
  let fadeable = 0;
  for (let i = before; i < after; i++) {
    const v = await protocol.getVow(i);
    if (Number(v.status) === 2) fadeable += 1;
  }
  console.log(`Created ${after - before} fade markets (${fadeable} Active).`);
  console.log("Try 看衰下注: switch to wallet C or D (or A on markets guaranteed by B).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
