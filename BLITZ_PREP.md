# 言 · Monad Blitz 金牌准备包

比赛当天只带这一份。目标：60 秒让人记住，30 秒指到链上，**高潮是红边 + Explorer 分账**，问答不翻车。

**上场讲稿（90 秒优先）：** [PITCH_SCRIPT.md](PITCH_SCRIPT.md)  
**PPT：** [pitch/index.html](pitch/index.html)  
**5 分钟中英细稿：** [DEMO_SCRIPT_5MIN.md](DEMO_SCRIPT_5MIN.md)

口播必须对得上当前合约：`WordProtocol.sol` 里**没有** `attestBroken`。担保人押金，裁判另设，超时任何人都能结算。台上高潮是预跑食言的红边和 `missSettle` 分账，不是 `pulseAt`。Why Monad 用日签钥匙少弹窗，不要讲独立槽 / 并行友好 / 确认密度。

---

## 你需要具备的能力（按优先级）

| 能力 | 为什么 | 今晚怎么练 |
|---|---|---|
| **60 秒讲清故事** | 同伴投票看记忆点 | 对着手机计时讲 5 遍，卡在 55–65 秒 |
| **指到 missSettle 分账** | 钱动了才是产品 | 预跑食言后收藏结算哈希，练 3 次点开 Explorer |
| **现场零翻车演示** | 卡壳 = 掉票 | 预跑食言红边 + 备灾视频含红边和结算哈希（不要连发） |
| **指链能力** | 证明不只是前端动画 | 会打开合约 / missSettle；不要指 pulseAt |
| **一句回答「谁证明」** | 评委第一刁难 | 背标准答——今天演的是超时结算，不靠自证发钱 |
| **一句回答「为什么 Monad」** | 和赛道绑定 | 背「日签钥匙少弹窗 + 便宜确认，天天打卡才成立」——不要说 TPS / 独立槽 |
| **英文 one-liner** | 国际场 | *A vow cannot start without a guarantor.* |

不需要今晚学会：复杂预言机、多签、审计。公网 Demo 有时间再 `vercel --prod`。

---

## 当前合约事实（口播以这个为准）

| 事实 | 链上行为 |
|---|---|
| 没有担保人不开工 | `createVow` / `createVowEx` 之后停在 Pending，直到他人 `guarantee()` |
| 立约必须写清承诺 | 创建时必填 `statement`（上链明文） |
| 不能自保 | 立约人不能 `guarantee` 自己 |
| 三种验收 | 每日报到 / 证据哈希 / 链上还款 |
| 裁判 ≠ 担保人 | 证据模式可另设 `referee`；裁判不能担保、不能看衰 |
| 默认打卡仍是自己点 | `checkIn` 由立约人或其 session key 调用 |
| 超时可被结算 | 窗口过后任何人可 `missSettle` |
| 看衰是对手盘 | `fade` 最多 16 人；立约人、担保人、裁判不能买 |
| 快进只限 owner | `demoWarp` / `demoWarpRounds` 仅部署者，且 `demoMode` 为 true |
| 日签钥匙用来代打卡 | `setSessionKey` 后可由钥匙调 `checkIn`，少弹窗。口播不要说「只能打卡」（合约里钥匙权限更宽，台上不演示那些） |
| `pulseAt` 不上台 | 合约里还在，只当调试。台上不点、口播不提独立槽 / 并行友好 / 确认密度 |

前端原文：「担保人不再当裁判。」证据模式的裁判是独立第三方；不设裁判时，提交证据后立约人可 `claimKept` 主张守诺。

---

## 已上线合约（Monad Testnet · 10143 · 比赛当天）

| 合约 | 地址 |
|---|---|
| YanToken | `0xCAd6963B2667E01891775fF6EB6cFd716FD39E80` |
| WordProtocol | `0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7` |
| 部署钱包（owner，可快进） | `0x2Bb51761CAba8cCafb04cB91DDAb647de8e92102` |

- 言币：https://testnet.monadexplorer.com/address/0xCAd6963B2667E01891775fF6EB6cFd716FD39E80
- 协议：https://testnet.monadexplorer.com/address/0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7
- Faucet：https://faucet.monad.xyz/

**公开 Demo：** 本机 http://127.0.0.1:3000 ；公网 → `cd frontend && npx vercel login && npx vercel --prod`，URL 填这里 → `https://____.vercel.app`

**赛前预跑食言：** 新合约刚部署，旧 vow #0 交易作废。请在新协议上再跑一条食言后，把 tx 填到这里。

---

## 60 秒中文口播（现场用这个）

> 网上发誓很容易，爽约也没代价。  
> **言** 是链上履约协议：**没有人担保，合约不开工。**  
> 我想立约，必须有人押「我信你」；别人也可以押「你做不到」。  
> 他没做到——钱当场分给看衰的人，担保图谱上的边断了。  
> 今天这条路径不靠自证发钱：窗口过了就结算，钱分给看衰的人，边断了。  
> 为什么是 Monad？履约要天天发生——**日签钥匙少弹窗，便宜确认让天天打卡成立。**  
> （指 Explorer 上的 missSettle）这不是动画。边断了，钱分了。

卡点：one-liner 咬死；「边断了，钱分了」必须说；「日签钥匙少弹窗」必须说；最后一句配合指红边或 Explorer。

不要说：担保人可以「确认他没做到」、独立槽 / 并行友好 / 确认密度 / 10k TPS、日签钥匙「只能」打卡。

---

## 20 秒英文版（备用）

> Online vows are cheap. **Yan** makes a vow unstartable without a guarantor.  
> Others can bet you'll fail. Break it — money settles, the trust edge snaps.  
> This path settles on a timeout—not on self-declaration.  
> On Monad because session keys cut popups and cheap confirms make daily check-ins possible. Here's the settle tx.

---

## 现场演示脚本（推荐顺序）

**原则：** 食言路径用预跑（稳）；**高潮是红边 + missSettle 分账**。Why Monad 最多现场点 **1 次**日签打卡。  
一键五步 / 分步演示 **仅本地 Hardhat**；测试网不要点。台上不要点「链上连发」。

### 方案 A（推荐 · 测试网）

1. 开场 one-liner（12 秒）  
2. 已食言言约 + 红边图谱（预跑）  
3. **点 missSettle / 活动哈希 → Explorer，停住让人看见分账**（这是高潮）  
4. 口播：边断了，钱分了。  
5. （可选）点 **1 次**「日签打卡」→ 指哈希：「日签钥匙少弹窗，便宜确认让天天打卡成立。」  
6. 有人问机制：指看衰结算，不要再开完整新约，不要展开证据/裁判  

### 方案 B（预跑数据丢了）

1. MetaMask = Monad Testnet；余额 > 0 YAN；第二、三账户就绪  
2. 立约 → 担保 → 看衰 → owner 快进 → 食言结算  
3. 指新的 missSettle 哈希。不要用连发补 Why Monad  

### 千万别现场做

- 现配 RPC、现部署合约  
- 解释代币经济学长文  
- MetaMask 双网络较劲超过 10 秒  
- 测试网点「一键跑完五步」  
- 点「链上连发」或解释独立槽 / 并行友好 / 确认密度 / 10k TPS  
- 说担保人可以判定食言 / 「担保人可验证未完成」 / 「日签钥匙只能打卡」  

---

## 评委问答（背标准答）

**Q：谁证明他真的做到了？打卡不是自己点的吗？**  
A：今天演示的路径**不靠自证发钱**。窗口过了，任何人都能 `missSettle`。打卡是动作；约束是 **担保押金 + 看衰盘**。需要人审 → 独立裁判（`refereeResolve`），不能同时担保或看衰。无裁判的证据模式是乐观路径，弱，所以台上不演。

**Q：这和普通质押 / prediction market 有什么不同？**  
A：核心不是赌结果，而是 **「没有担保人，合约不开工」**。信用关系先上链，再谈输赢；没有担保边，看衰盘不存在。

**Q：为什么必须是 Monad？ / 你怎么证明用了性能？**  
A：履约是小额、重复、当天就要确认的动作。日签钥匙用来代打卡、少弹窗；便宜确认让天天打卡成立。确认要慢、每签一次都弹钱包，这个玩法先死。我们没有证明 10k TPS，也不做连发压测。这是产品约束，不是跑分。

**Q：代币 YAN 有什么用？**  
A：履约筹码：立约、担保、看衰池。守诺退押金；食言按 fade 份额赔；无人看衰则烧毁。Gas 用 MON。

**Q：智能合约安全吗？**  
A：OpenZeppelin + Hardhat 测试覆盖主路径。Blitz 原型：demo 时钟仅 owner。上线前关时钟并审计。

**Q：商业化怎么走？**  
A：Habit / 社交承诺 / 小 DAO 任务的履约层；今天验证机制，不是完整公司。

**Q：担保人不能判定，那裁判和担保人谁说了算？**  
A：担保人出皮肤，不开工则没有约。裁判只在证据模式出现，且不能押自己那条。默认每日报到靠超时结算。裁判不该同时在盘里。

---

## 赛前 30 分钟检查清单

- [ ] MetaMask 只留 **一条** Monad Testnet（Chain ID `10143`）  
- [ ] 主账户有足够 **MON**（Gas）  
- [ ] 已导入 **YAN**，网页余额 > 0  
- [ ] **日签钥匙已授权**（若要用），且钥匙地址有少量 MON（测网不会自动灌）  
- [ ] 试过一次「日签打卡」成功（可选）；**不要把连发当上场项**  
- [ ] http://localhost:3000（或公开 URL）顶部显示 **Monad Testnet**  
- [ ] 浏览器已打开言币 + 协议 + **missSettle 分账页**  
- [ ] 「最近活动」里至少有 1 笔 **missSettle** 成功哈希  
- [ ] 图谱上已有一条已食言红边（锁这一条，不要切全部）  
- [ ] 口播含：「边断了，钱分了」+「日签钥匙少弹窗，便宜确认让天天打卡成立」  
- [ ] 不会说 `attestBroken` / 10k TPS / 独立槽 / 并行友好 / 确认密度 / 「日签钥匙只能打卡」  
- [ ] 备灾视频含：红边 + 点结算哈希（不要连发片段）  

---

## 提交表可复制文本

```markdown
# 言 (Yan) — Word Protocol on Monad

## One-liner
A vow cannot start without a guarantor. Break it, and the money settles on-chain.

## Demo
1. Create vow → guarantee → fade → missSettle (broken); trust graph edge snaps
2. Point at the missSettle tx on Explorer — money moved
3. Optional: one session-key check-in (fewer wallet popups). No burst / no TPS claim
4. Live on Monad Testnet

## Contracts (Monad Testnet)
- YanToken: 0xCAd6963B2667E01891775fF6EB6cFd716FD39E80
- WordProtocol: 0x15282187E58cfdf3a936f5EE279Bd688E9Ee64b7
- Explorer: https://testnet.monadexplorer.com/

## Why Monad
Daily micro-commitments die if confirms are slow or wallets pop every time.
Session keys cut popups; cheap confirms make daily check-ins possible.
No TPS claim. The live proof is a settled broken vow, not a burst write.

## Repo
- frontend/: React demo
- backend/: Hardhat contracts (YanToken + WordProtocol)
```

---

## 若只剩 2 小时，只做这些

1. 背熟 60 秒口播 + 两个标准答（谁证明 / 为什么 Monad）  
2. 确认预跑食言 + **亲手点开 missSettle 分账**  
3. （可选）日签钥匙灌 MON，试 1 次打卡；删多余 Monad 网络  
4. 录 90 秒备灾屏（口播 + 红边 + 结算哈希，不要连发）  

功能可以不加；**记忆点 + 红边分账 + 零翻车**决定票。
