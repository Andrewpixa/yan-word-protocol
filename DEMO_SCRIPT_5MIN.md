# 言 · 5 分钟演示讲稿（中 / EN）

上场先背 [PITCH_SCRIPT.md](PITCH_SCRIPT.md) 的 90 秒版。PPT：打开 [pitch/index.html](pitch/index.html)。  
下面是 5 分钟中英对照细稿。目标总时长约 **4:40**。口播事实以 [BLITZ_PREP.md](BLITZ_PREP.md) 为准。

**舞台设定（开场前 30 秒就位）**  
浏览器已打开：预跑好的「食言」言约 + 红边图谱；「最近活动」里有可点的 **missSettle** 哈希；Explorer 标签页可秒切；  
日签钥匙已授权且钥匙地址有 MON（可点一次「日签打卡」）；备灾视频在桌面（红边 + 结算哈希，不要连发）。

**结构口诀：** 断边故事 → **指链分账（高潮）** → 日签一次（Why Monad）→ 构建 / 创新 → 收尾。

台上不要点「链上连发」。不要说独立槽、并行友好、确认密度、10k TPS。

---

## 0:00–0:15｜开场：做什么 + 为何做（15 秒）

**中文**

> 网上发誓很容易，爽约也没代价。  
> **言** 是链上履约协议——**没有人担保，合约不开工。**  
> 先看测试网上已经走完的食言：边断了，钱分了。

**English**

> Online vows are cheap—breaking them costs nothing.  
> **Yan** is an on-chain word protocol: **a vow cannot start without a guarantor.**  
> First a finished broken vow on Monad testnet—the edge snapped, the money moved.

*动作：无操作，目光对观众 1 秒，立刻切到应用。*

---

## 0:15–2:50｜实机演示（断边 + 分账 · 约 2 分 35 秒）

### 0:15–0:40｜场景锚定（25 秒）

**中文**

> 屏幕上这条言约已经走完：有人立约、有人担保、有人看衰，最后超时结算为**食言**。  
> 图谱上这条红边，就是信用关系断了。

**English**

> This vow already finished: create → guarantee → fade → settle as **broken**.  
> The red edge is the broken credit link.

*动作：指图谱红边，不点新按钮。图谱锁在这一条，不要切「全部言约」。*

---

### 0:40–1:25｜机制四拍（45 秒 · 边指边说）

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

*动作：依次指：言约文案 → 担保人 → 看衰列表 → 已结算状态。不要展开三种验收。*

---

### 1:25–1:55｜谁证明（30 秒）

**中文**

> 有人会问：打卡不是自己点的吗？  
> **今天这条路径不靠自证发钱。**  
> 窗口过了，任何人都能结算。打卡是动作；约束是担保押金和看衰盘。  
> 需要人审时另设**独立裁判**——裁判不能同时担保或看衰。出皮肤 ≠ 当裁判。

**English**

> Isn't check-in self-clicked?  
> **This path doesn't pay out on self-declaration.**  
> After the window, anyone can settle. Check-in is an action; the stake and fade market constrain the money.  
> Human review → separate referee who cannot also guarantee or fade.

*动作：不要打开证据 / 裁判面板。指回红边。*

---

### 1:55–2:50｜高潮：红边 + Explorer 分账（55 秒）

**中文**

> 这不是前端动画。  
> （点「最近活动」里收藏的 missSettle 哈希 → Explorer）  
> 担保、看衰、结算都在 Monad 测试网上。钱已经按规则分完了——边断了，钱动了。

**English**

> Not a front-end animation.  
> *(click the missSettle hash → Explorer)*  
> Guarantee, fade, settle—real Monad testnet. Money already moved. The edge snapped.

*动作：哈希 → Explorer；停 3 秒让人看见分账；回应用，再指一次红边。这是全场高潮，不要赶。*

---

## 2:50–3:25｜Why Monad（可选日签 1 次 · 约 35 秒）

**中文**

> 为什么必须是 Monad？  
> 履约是小额、重复、当天就要确认的动作。  
> 日签钥匙用来代打卡、少弹窗；便宜确认让天天打卡成立。  
> （若已授权：点 **1 次**「日签打卡」，指新哈希。不要连发。）  
> 确认要慢、每签一次都弹钱包——这个玩法先死。所以是 Monad。

**English**

> Why Monad?  
> Commitments are small, repeated, and must confirm the same day.  
> A session key checks in without extra wallet popups; cheap confirms make daily vows usable.  
> *(optional: tap session check-in once, point at the hash. No burst.)*  
> Slow confirms and a popup every day kill this product first—that's why Monad.

*动作：最多点一次日签打卡。若钥匙没就绪，只靠口播 + 已有结算哈希，不要现场现授权。*  
*若钱包卡死：立刻切备灾视频里的红边 + 结算哈希，口播不中断。*

---

## 3:25–4:05｜如何构建（40 秒）

**中文**

> 我们怎么建的——三句话。  
> **合约：** YanToken + WordProtocol；台上这条是每日报到 + 超时结算。  
> **Monad：** 日签钥匙用来代打卡、少弹窗——去掉便宜确认，日签玩法不成立。  
> **最有意思的挑战：** 强制「信用边先上链」——没有担保边，看衰盘不存在。

**English**

> How we built it—three lines.  
> **Contracts:** YanToken + WordProtocol; today you saw daily check-in and timeout settle.  
> **Monad:** session key for check-ins, fewer popups—without cheap confirms, daily vows don't work.  
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

> 言，Monad 测试网已上线。谢谢——欢迎拆合约、拆图谱、拆这笔结算。

**English**

> Yan—live on Monad testnet. Thanks—happy to dig into contracts, the graph, or this settle tx.

*动作：停。不追加功能列表。*

---

## 翻车切换台词（随时可插）

若钱包/网络卡死，**立刻切备灾视频**，口播不中断：

**中文**

> 现场链路不稳，切预录——流程和你们屏幕上看到的是同一条测试网路径。

**English**

> Network's flaky—switching to a pre-recorded clip of the same testnet path.

然后从「机制四拍」或「Explorer 分账」旁白接回。不要切连发片段。

---

## 禁句（说出口即减分）

| 不要说 | 改说 |
|---|---|
| 担保人可以判定食言 / `attestBroken` | 超时任何人可结算；需要人审另设裁判 |
| 我们证明了 10k TPS / 已验证并行执行 / 独立槽 / 并行友好 / 确认密度 | 日签钥匙少弹窗；便宜确认让天天打卡成立 |
| 日签钥匙只能打卡 | 日签钥匙用来代打卡、少弹窗 |
| 担保人可验证未完成 | 担保人出皮肤；钱按窗口和看衰盘走 |
| 我们有完整代币经济 / 已审计上线 | Blitz 可演示原型；demo 时钟仅 owner |

---

## 排练计分板

| 遍数 | 目标 |
|---|---|
| 第 1–2 遍 | 走通：红边 → missSettle 哈希 → Explorer；可选日签 1 次 |
| 第 3–4 遍 | 卡在 **4:30–4:50** |
| 第 5 遍 | 故意断网，练备灾切换（红边 + 结算，不要连发） |
| 单独加练 | one-liner；「边断了，钱分了」；「日签钥匙少弹窗，便宜确认让天天打卡成立」 |
