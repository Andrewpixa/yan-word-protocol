# 言 (Yan) — Word Protocol

**没有人担保，合约不开工。** / **A vow cannot start without a guarantor.**

[中文](#言--链上履约协议) · [English](#yan--word-protocol-on-monad) · [上场讲稿](PITCH_SCRIPT.md) · [PPT](pitch/index.html) · [比赛准备](BLITZ_PREP.md)

公开 Demo：https://frontend-psi-three-rhd35qr7o7.vercel.app

---

# 言 · 链上履约协议

网上发誓很容易；这里立约必须有人押「我信你」，也可以有人押「你做不到」。做不到，钱当场分走，图谱上的边断裂。

**上场讲稿（90 秒 / 5 分钟）：** [PITCH_SCRIPT.md](PITCH_SCRIPT.md)  
**PPT（浏览器全屏）：** [pitch/index.html](pitch/index.html)  
**比赛准备完整版（问答 / 检查清单）：** [BLITZ_PREP.md](BLITZ_PREP.md)

## 30 秒故事

1. **问题**：发誓没代价。
2. **做法**：立约必须有担保；旁人可以看衰；验收靠打卡 / 证据+裁判 / 链上还款（**担保人出皮肤，不当裁判**）。
3. **结果**：食言则结算，边断了。
4. **为什么 Monad**：履约要天天发生——日签钥匙少弹窗，便宜确认让天天打卡成立。现场高潮是食言红边 + Explorer 分账，不是连发。

## Monad Testnet 合约（当前）

| 合约 | 地址 |
|---|---|
| YanToken | [`0xCAd6963B2667E01891775fF6EB6cFd716FD39E80`](https://testnet.monadexplorer.com/address/0xCAd6963B2667E01891775fF6EB6cFd716FD39E80) |
| WordProtocol | [`0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7`](https://testnet.monadexplorer.com/address/0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7) |
| 部署者（可快进） | `0x2Bb51761CAba8cCafb04cB91DDAb647de8e92102` |

- Chain ID：`10143`
- 一轮 = **1 天（86400 秒）**，当天内都可签到
- Faucet：https://faucet.monad.xyz/

## 快速开始（测试网前端）

```bash
cd frontend
npm install   # 首次
npm run dev
```

打开 http://localhost:3000

1. MetaMask → **Monad Testnet**
2. **+ YAN** → **领取测试 YAN**
3. 立约 / 担保 / 看衰
4. 进阶：授权日签（**给钥匙地址转一点 MON**）→ 日签打卡 1 次（少弹窗）。台上不要点连发。

公开 Demo：https://frontend-psi-three-rhd35qr7o7.vercel.app

## 快速开始（纯本地多角色）

```bash
bash start-demo.sh
```

本地才可用演示钱包 A/B/C 与一键五步（Hardhat 解锁账户）；本地会自动给日签钥匙灌 Gas。

## 路演口播（约 60 秒）

见 [BLITZ_PREP.md](BLITZ_PREP.md) 与 [PITCH_SCRIPT.md](PITCH_SCRIPT.md)。现场优先：预跑食言红边 → Explorer 分账 →（可选）日签 1 次 → 「日签钥匙少弹窗，便宜确认让天天打卡成立」。

## 项目结构

```
backend/contracts/YanToken.sol
backend/contracts/WordProtocol.sol
frontend/src/App.jsx
frontend/src/components/TrustGraph.jsx
PITCH_SCRIPT.md
BLITZ_PREP.md
```

完整中文说明也可单独看 [README_CN.md](README_CN.md)。

---

# Yan — Word Protocol on Monad

**A vow cannot start without a guarantor.**  
Online vows are cheap. Here a vow cannot start until someone stakes “I believe you.” Others can bet you will fail. Break it — money settles, the trust-graph edge snaps.

Stage script: [PITCH_SCRIPT.md](PITCH_SCRIPT.md) · PPT: [pitch/index.html](pitch/index.html) · Blitz prep: [BLITZ_PREP.md](BLITZ_PREP.md)

### Monad Testnet (current)

| Contract | Address |
|---|---|
| YanToken | [`0xCAd6963B2667E01891775fF6EB6cFd716FD39E80`](https://testnet.monadexplorer.com/address/0xCAd6963B2667E01891775fF6EB6cFd716FD39E80) |
| WordProtocol | [`0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7`](https://testnet.monadexplorer.com/address/0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7) |
| Deployer (owner) | `0x2Bb51761CAba8cCafb04cB91DDAb647de8e92102` |

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 — MetaMask on Monad Testnet → **+ YAN** → claim → vow.  
Demo tip: pre-run a broken vow, then point at the missSettle tx on Explorer. Optional: fund the session key with MON and check in once (fewer popups). Do not pitch the burst button on stage.

**Why Monad:** session keys cut popups; cheap confirms make daily check-ins possible. One epoch = one calendar day.

Public demo: https://frontend-psi-three-rhd35qr7o7.vercel.app

### Local multi-wallet demo

```bash
bash start-demo.sh
```
