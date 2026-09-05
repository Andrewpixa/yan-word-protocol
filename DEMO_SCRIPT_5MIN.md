# 言 · 5 分钟演示讲稿（中 / EN）

严格对齐 Monad Blitz「实机 → 如何构建 → 创新点」结构。  
目标总时长约 **4:40**，留 20 秒缓冲。口播事实以 [BLITZ_PREP.md](BLITZ_PREP.md) 为准。

**舞台设定（开场前 30 秒就位）**  
浏览器已打开：预跑好的「食言」言约 + 红边图谱；「最近活动」里有可点哈希；Explorer 标签页可秒切；  
日签钥匙已授权且钥匙地址有 MON（可点「日签打卡」）；「链上连发 8 笔」按钮可点；备灾视频在桌面。

**结构口诀：** 断边故事 → 指链 → **现场性能拍** → 构建 / 创新 → 收尾。

---

## 0:00–0:20｜开场：做什么 + 为何做（20 秒）

**中文**

> 网上发誓很容易，爽约也没代价。  
> **言** 是链上履约协议——**没有人担保，合约不开工。**  
> 先看测试网上跑通的食言结果，再现场打一拍确认密度。

**English**

> Online vows are cheap—breaking them costs nothing.  
> **Yan** is an on-chain word protocol: **a vow cannot start without a guarantor.**  
> First a finished broken vow on Monad testnet—then a live confirmation burst.

*动作：无操作，目光对观众 1 秒，立刻切到应用。*

---

## 0:20–2:40｜实机演示（断边 + 机制 · 约 2 分 20 秒）

### 0:20–0:45｜场景锚定（25 秒）

**中文**

> 屏幕上这条言约已经走完：有人立约、有人担保、有人看衰，最后超时结算为**食言**。  
> 图谱上这条红边，就是信用关系断了。

**English**

> This vow already finished: create → guarantee → fade → settle as **broken**.  
> The red edge is the broken credit link.

*动作：指图谱红边，不点新按钮。*

---

### 0:45–1:35｜机制四拍（50 秒 · 边指边说）

**中文**

> 四步，链上强制：  
> **一，立约**——必须写清承诺，押上 YAN。  
> **二，担保**——别人押「我信你」；没有这一步，合约停在 Pending，**不开工**。  
> **三，看衰**——旁人可以押「你做不到」，形成对手盘。  
> **四，结算**——窗口过了，任何人都能触发结算；食言则钱分给看衰者，担保边断开。

**English**

> Four on-chain steps:  
> **One—vow:** statement + stake.  
> **Two—guarantee:** without it the vow stays Pending—**it never starts.**  
> **Three—fade:** others bet you'll fail.  
> **Four—settle:** after the window, anyone can settle; on break, faders get paid and the edge snaps.

*动作：依次指：言约文案 → 担保人 → 看衰列表 → 已结算状态。*

---

### 1:35–2:10｜谁证明（35 秒）

**中文**

> 有人会问：打卡不是自己点的吗？  
> **打卡可以自己点，但钱不是自己说了算。**  
> 链不证明你跑步；链证明谁愿意为这句话付钱，以及食言时钱怎么走。  
> 需要人审时另设**独立裁判**——裁判不能同时担保或看衰。出皮肤 ≠ 当裁判。

**English**

> Isn't check-in self-clicked?  
> **Yes—but money isn't self-declared.**  
> The chain doesn't prove you ran; it proves who staked on the word, and how money moves on break.  
> Human review → separate referee who cannot also guarantee or fade.

*动作：可指「上传证据 / 裁判」入口 1–2 秒，再回图谱。*

---

### 2:10–2:40｜指链证明（30 秒）

**中文**

> 这不是前端动画。  
> （点「最近活动」或收藏的 missSettle 哈希 → Explorer）  
> 担保、看衰、结算都在 Monad 测试网上；钱已经按规则分完了。

**English**

> Not a front-end animation.  
> *(click hash → Explorer)*  
> Guarantee, fade, settle—real Monad testnet. Money already moved.

*动作：哈希 → Explorer；停 2 秒；回应用。*

---

## 2:40–3:25｜现场性能拍（必做 · 约 45 秒）

**中文**

> 为什么必须是 Monad？  
> 履约要**轻到能天天发生**。若确认要等很久、打卡还要弹三次钱包——这套日签经济会空转。  
> （点「链上连发 8 笔并计时」；或已授权日签则点 1–2 次「日签打卡」）  
> 这是真实上链的确认密度：`pulseAt` 写独立槽，利于并行友好写入；测的是体感，**不是 10k TPS**。  
> 慢链上，这个玩法先死——所以我们在 Monad。

**English**

> Why Monad?  
> Commitments must be light enough to happen daily. Slow confirms + wallet popups kill the economy.  
> *(hit “burst 8 txs” or session check-in)*  
> Real on-chain density: `pulseAt` writes distinct slots—parallel-friendly, not a 10k TPS claim.  
> On a slow chain, this product dies first—that's why Monad.

*动作：点按钮 → 等确认 → 指活动里哈希 / 耗时文案 → 可点一笔进 Explorer。*  
*若钱包卡死：立刻切备灾视频里预录的连发片段，口播不中断。*

---

## 3:25–4:05｜如何构建（40 秒）

**中文**

> 我们怎么建的——三句话。  
> **合约：** YanToken + WordProtocol；三种验收——每日报到、证据哈希、链上还款。  
> **Monad：** 日签钥匙只能代打卡；连发用 `pulseAt` 独立槽测确认密度——去掉便宜确认，日签玩法不成立。  
> **最有意思的挑战：** 强制「信用边先上链」——没有担保边，看衰盘不存在。自助打卡很轻，经济裁决很重。

**English**

> How we built it—three lines.  
> **Contracts:** YanToken + WordProtocol; check-in / evidence / on-chain pay.  
> **Monad:** session key for check-ins; `pulseAt` burst for confirmation density—without cheap confirms, daily vows don't work.  
> **The hard part:** credit edges first. No guarantor edge, no fade market.

---

## 4:05–4:45｜重点创新（40 秒）

**中文**

> 为什么这东西让人兴奋？  
> 不是「to-do 上链」，而是**可结算的信用图谱**：边 = 担保 / 看衰；食言 = 边断 + 钱动。  
> Habit、社交挑战、小 DAO 任务，都能挂在这条履约层上。  
> One-liner 再咬一次：**没有担保人，合约不开工。**

**English**

> Not to-dos on-chain—a **settlement-ready trust graph**.  
> Edges = guarantee / fade; break = snap + settle.  
> Composable for habits, challenges, small DAO tasks.  
> One more time: **a vow cannot start without a guarantor.**

*动作：最后一次指红边图谱。*

---

## 4:45–5:00｜收尾（15 秒）

**中文**

> 言，Monad 测试网已上线。谢谢——欢迎拆合约、拆图谱、拆连发哈希。

**English**

> Yan—live on Monad testnet. Thanks—happy to dig into contracts, graph, or burst txs.

*动作：停。不追加功能列表。*

---

## 翻车切换台词（随时可插）

若钱包/网络卡死，**立刻切备灾视频**，口播不中断：

**中文**

> 现场链路不稳，切预录——流程和你们屏幕上看到的是同一条测试网路径。

**English**

> Network's flaky—switching to a pre-recorded clip of the same testnet path.

然后从「机制四拍」或「性能拍」旁白接回。

---

## 禁句（说出口即减分）

| 不要说 | 改说 |
|---|---|
| 担保人可以判定食言 / `attestBroken` | 超时任何人可结算；证据模式另设裁判 |
| 我们证明了 10k TPS / 已验证并行执行 | 慢确认则日签空转；`pulseAt` 测确认密度 / 并行友好写入 |
| 担保人可验证未完成 | 担保人出皮肤；验证靠证据+裁判或客观转账 |
| 我们有完整代币经济 / 已审计上线 | Blitz 可演示原型；demo 时钟仅 owner |

---

## 排练计分板

| 遍数 | 目标 |
|---|---|
| 第 1–2 遍 | 走通，含一次真实连发或日签 |
| 第 3–4 遍 | 卡在 **4:30–4:50** |
| 第 5 遍 | 故意断网，练备灾切换 |
| 单独加练 | one-liner；「打卡可以自己点，但钱不是自己说了算」；「慢了，日签经济会空转」 |
