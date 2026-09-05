/**
 * Seed pending vows on local chain so the market / 押注事实 has browseable rows.
 * Does NOT guarantee — leaves them waiting for「我信他」.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const PROTOCOL_ABI = [
  "function createVow(uint256 daysRequired, uint256 stake, string statement) returns (uint256)",
  "function createVowEx(uint256 duration,uint256 stake,uint8 kind,uint8 verifyMode,address referee,address payee,uint256 payAmount,string statement) returns (uint256)",
  "function vowCount() view returns (uint256)",
];

const YAN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const addrPath = path.join(__dirname, "../addresses.json");
  if (!fs.existsSync(addrPath)) {
    throw new Error("addresses.json missing — deploy first");
  }
  const { yan: yanAddr, protocol: protocolAddr, network } = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  if (network !== "local" && hre.network.name !== "local" && hre.network.name !== "hardhat") {
    console.warn("Warning: seeding on", hre.network.name);
  }

  // Match frontend DEMO_WALLETS index: A=0, B=1, C=2, D=3
  const signers = await hre.ethers.getSigners();
  const wA = signers[0];
  const wB = signers[1];
  const wC = signers[2];
  const wD = signers[3];
  const yan = new hre.ethers.Contract(yanAddr, YAN_ABI, wA);
  const protocol = new hre.ethers.Contract(protocolAddr, PROTOCOL_ABI, wA);

  // A / C / D create; leave B free to browse and click「我信他」.
  const seeds = [
    { who: wA, label: "钱包 A", duration: 2, stake: "50", kind: 0, verify: 0, statement: "坚持跑步7天", note: "每日报到 · 无需证据" },
    { who: wC, label: "钱包 C", duration: 3, stake: "30", kind: 0, verify: 1, statement: "坚持11点前睡觉", note: "每日报到 · 需要证据" },
    { who: wD, label: "钱包 D", duration: 5, stake: "20", kind: 1, verify: 0, statement: "本周写完一份提案", note: "到期验收 · 无需证据" },
    {
      who: wA,
      label: "钱包 A",
      duration: 4,
      stake: "40",
      kind: 1,
      verify: 2,
      payee: wB.address,
      pay: "10",
      statement: "到期还清借款",
      note: "到期验收 · 链上还款给钱包 B",
    },
  ];

  for (const s of seeds) {
    const stake = hre.ethers.parseEther(s.stake);
    await (await yan.connect(s.who).approve(protocolAddr, hre.ethers.MaxUint256)).wait();
    let tx;
    if (s.kind === 0 && s.verify === 0) {
      tx = await protocol.connect(s.who).createVow(s.duration, stake, s.statement);
    } else {
      const pay = s.pay ? hre.ethers.parseEther(s.pay) : 0n;
      tx = await protocol.connect(s.who).createVowEx(
        s.duration,
        stake,
        s.kind,
        s.verify,
        hre.ethers.ZeroAddress,
        s.payee || hre.ethers.ZeroAddress,
        pay,
        s.statement
      );
    }
    const receipt = await tx.wait();
    console.log(`OK ${s.label} · ${s.note} · stake ${s.stake} · tx ${receipt.hash.slice(0, 12)}…`);
  }

  const count = await protocol.vowCount();
  console.log(`vowCount = ${count}`);
  console.log("Pending vows are open for「我信他」(try 钱包 B).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
