import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import IntroGate from './components/IntroGate'
import WalletBar from './components/WalletBar'
import TrustGraph from './components/TrustGraph'
import StakeLedger from './components/StakeLedger'
import ActivityFeed from './components/ActivityFeed'
import GuidedDemo from './components/GuidedDemo'
import MyVowsPanel from './components/MyVowsPanel'
import FulfillmentBox from './components/FulfillmentBox'
import {
  DEMO_MODE,
  DEMO_WALLETS,
  NETWORKS,
  getActiveNetwork,
  getActiveNetworkId,
  setActiveNetwork,
  STATUS,
  KIND_LABEL,
  VERIFY_LABEL,
  normalizeEvidenceDraft,
  resolveEvidenceHash,
  shortHash,
  displayName,
  ensureAllowance,
  formatError,
  formatYan,
  getRpcProvider,
  fundSessionOnLocal,
  loadOrCreateSessionWallet,
  loadChainActivities,
  loadWorld,
  mergeChainActivities,
  protocolContract,
  readMetaMaskSession,
  sameAddr,
  shortAddr,
  switchToAppNetwork,
  txUrl,
  walletFromId,
  watchYanToken,
  yanContract,
} from './services/chain'

let activitySeq = 0

const ENTERED_KEY = 'yan-market-entered'
const MAX_STATEMENT_BYTES = 120
const MAX_FADERS = 16
const DEMO_STATEMENT = '演示：坚持打卡完成言约'

function statementByteLen(text) {
  return new TextEncoder().encode(String(text || '').trim()).length
}

function readEntered() {
  try {
    return localStorage.getItem(ENTERED_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [entered, setEntered] = useState(readEntered)
  const [networkId, setNetworkId] = useState(() => getActiveNetworkId())
  const [walletMode, setWalletMode] = useState('disconnected') // disconnected | demo | metamask
  const [walletId, setWalletId] = useState('w1')
  const [myAddress, setMyAddress] = useState('')
  const [world, setWorld] = useState(() => ({
    vows: [],
    board: [],
    epoch: 0,
    epochLen: getActiveNetwork().epochSeconds,
  }))
  const [balance, setBalance] = useState(0n)
  const [log, setLogState] = useState({
    text: '先连接 MetaMask，或点「使用演示模式」再操作。',
    tone: 'info',
  })
  const [busy, setBusy] = useState(false)
  /** 当前链上确认中的动作：{ vowId, action }，用于只让对应按钮显示「确认中…」 */
  const [pending, setPending] = useState(null)
  const [brokenFlashId, setBrokenFlashId] = useState(null)
  const [rounds, setRounds] = useState(2)
  const [stake, setStake] = useState('50')
  const [statementText, setStatementText] = useState('')
  const [guaranteeAmount, setGuaranteeAmount] = useState('20')
  const [fadeAmount, setFadeAmount] = useState('20')
  const [vowKind, setVowKind] = useState(0)
  const [verifyMode, setVerifyMode] = useState(0)
  const [refereeAddr, setRefereeAddr] = useState('')
  const [payeeAddr, setPayeeAddr] = useState('')
  const [payAmount, setPayAmount] = useState('10')
  const [activities, setActivities] = useState([])
  const [guideStep, setGuideStep] = useState(0) // 0=未开始, 1-5=当前步, 6=完成
  const [guideVowId, setGuideVowId] = useState(null)
  const [expandedMyVowId, setExpandedMyVowId] = useState(null)
  /** 各言约证据输入草稿，市场卡片与「全部言约」共用 */
  const [evidenceDrafts, setEvidenceDrafts] = useState({})
  const [mmChainId, setMmChainId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [minStake, setMinStake] = useState('1')
  const [protocolOwner, setProtocolOwner] = useState('')
  const [sessionAddr, setSessionAddr] = useState('')

  const usingMetaMask = walletMode === 'metamask'
  const usingDemo = walletMode === 'demo'
  const connected = walletMode !== 'disconnected'
  const actionsLocked = busy || !connected
  const activeNet = NETWORKS[networkId] || getActiveNetwork()
  const isLocal = activeNet.chainId === 31337
  const epochLen = world.epochLen || activeNet.epochSeconds
  const canWarp = DEMO_MODE && connected && (usingDemo ? isLocal : sameAddr(myAddress, protocolOwner))
  const protocolAddress = activeNet.protocol
  const yanAddress = activeNet.yan
  const networkName = activeNet.name
  const chainId = activeNet.chainId

  const stakeWei = useMemo(() => {
    try {
      return ethers.parseEther(String(stake || '0'))
    } catch {
      return 0n
    }
  }, [stake])

  const guaranteeWei = useMemo(() => {
    try {
      return ethers.parseEther(String(guaranteeAmount || '0'))
    } catch {
      return 0n
    }
  }, [guaranteeAmount])

  const fadeWei = useMemo(() => {
    try {
      return ethers.parseEther(String(fadeAmount || '0'))
    } catch {
      return 0n
    }
  }, [fadeAmount])

  const setLog = useCallback((text, tone = 'info') => {
    setLogState({ text: String(text || ''), tone })
  }, [])

  const pushActivity = useCallback((label, hash, detail = '', actor = '') => {
    const item = {
      id: `${Date.now()}-${activitySeq++}`,
      label,
      hash: hash || '',
      detail,
      actor,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    }
    setActivities((prev) => [item, ...prev].slice(0, 30))
  }, [])

  const getSigner = useCallback(async () => {
    if (walletMode === 'metamask') {
      if (!window.ethereum) throw new Error('未检测到 MetaMask')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const net = await provider.getNetwork()
      if (Number(net.chainId) !== chainId) {
        throw new Error(`请切换到 ${networkName}（Chain ID ${chainId}）`)
      }
      return provider.getSigner()
    }
    if (walletMode === 'demo') {
      if (!isLocal) throw new Error('演示模式仅支持本地链，请先切到本地链')
      return walletFromId(walletId)
    }
    throw new Error('请先连接 MetaMask，或使用演示模式')
  }, [walletMode, walletId, chainId, networkName, isLocal])

  const refresh = useCallback(async () => {
    const provider = getRpcProvider()
    const data = await loadWorld(provider)
    setWorld(data)
    try {
      const chainActs = await loadChainActivities(provider)
      setActivities((prev) => mergeChainActivities(chainActs, prev))
    } catch {
      // Keep the in-session list if the RPC cannot serve logs.
    }
    if (walletMode === 'disconnected') {
      setMyAddress('')
      setBalance(0n)
      setMmChainId(null)
      return data
    }

    let addr = ''
    if (walletMode === 'metamask') {
      const session = await readMetaMaskSession()
      addr = session.address
      setMmChainId(session.chainId)
      if (!addr) {
        setMyAddress('')
        setBalance(0n)
        return data
      }
    } else {
      const signer = await getSigner()
      addr = await signer.getAddress()
      setMmChainId(chainId)
    }

    setMyAddress(addr)
    const protocol = protocolContract(provider)
    setBalance(await yanContract(provider).balanceOf(addr))
    try {
      setMinStake(ethers.formatEther(await protocol.minStakeOf(addr)))
      setProtocolOwner(await protocol.owner())
      const sk = await protocol.sessionKey(addr)
      setSessionAddr(sk && sk !== ethers.ZeroAddress ? sk : '')
    } catch {
      setMinStake('1')
    }
    return data
  }, [getSigner, walletMode, chainId])

  useEffect(() => {
    // Env defaults to Monad Testnet — force that network so refresh() hits live RPC.
    const envChain = parseInt(import.meta.env.VITE_CHAIN_ID || '10143', 10)
    if (envChain === 10143) {
      setActiveNetwork('monad')
      setNetworkId('monad')
    }
  }, [])

  useEffect(() => {
    refresh().catch((e) => setLog(e.message, 'err'))
  }, [refresh, setLog])

  useEffect(() => {
    if (walletMode !== 'metamask' || !window.ethereum) return undefined
    const onChainChanged = () => {
      refresh().catch(() => {})
    }
    const onAccountsChanged = () => {
      refresh().catch(() => {})
    }
    window.ethereum.on?.('chainChanged', onChainChanged)
    window.ethereum.on?.('accountsChanged', onAccountsChanged)
    return () => {
      window.ethereum.removeListener?.('chainChanged', onChainChanged)
      window.ethereum.removeListener?.('accountsChanged', onAccountsChanged)
    }
  }, [walletMode, refresh])

  async function withBusy(label, fn, meta = null) {
    try {
      setBusy(true)
      setPending(meta)
      setLog(label + '…', 'busy')
      const msg = await fn()
      await refresh()
      if (typeof msg === 'string' && msg) setLog(msg, 'ok')
      else setLog(label + ' 完成', 'ok')
    } catch (e) {
      console.error(e)
      setLog(formatError(e), 'err')
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  /**
   * Submit a protocol tx. When waitConfirm=false, return as soon as the wallet
   * gives a hash so the UI can unlock; confirmation runs via returned wait().
   */
  async function sendTracked(label, detail, work, { waitConfirm = true } = {}) {
    const signer = await getSigner()
    const actor = displayName(await signer.getAddress())
    const needAmt = stakeWei > fadeWei ? stakeWei : fadeWei
    const yan = yanContract(signer)
    const owner = await signer.getAddress()
    const current = await yan.allowance(owner, protocolAddress)
    if (current < needAmt) {
      setLog('需要先授权言币，请在钱包确认…', 'busy')
    }
    const approveReceipt = await ensureAllowance(signer, needAmt)
    if (approveReceipt?.hash) {
      pushActivity('授权言币', approveReceipt.hash, 'approve', actor)
      setLog('授权已确认，请再在钱包确认发起言约…', 'busy')
    }
    const tx = await work(protocolContract(signer), signer)
    pushActivity(label, tx.hash, detail, actor)
    if (!waitConfirm) {
      return { hash: tx.hash, actor, wait: () => tx.wait() }
    }
    const receipt = await tx.wait()
    return receipt
  }

  async function onCreate() {
    try {
      setBusy(true)
      setLog('发起言约…', 'busy')

      const statement = String(statementText || '').trim()
      const n = statementByteLen(statement)
      if (n < 2) {
        throw new Error('请写下你要对什么下赌注，例如：坚持跑步7天')
      }
      if (n > MAX_STATEMENT_BYTES) {
        throw new Error('承诺内容过长（最多约 40 个汉字）')
      }
      const kind = verifyMode === 2 ? 1 : vowKind
      const mode = verifyMode
      const referee =
        mode === 1 && refereeAddr && ethers.isAddress(refereeAddr) ? refereeAddr : ethers.ZeroAddress
      const payee =
        mode === 2 && payeeAddr && ethers.isAddress(payeeAddr) ? payeeAddr : ethers.ZeroAddress
      let pay = 0n
      if (mode === 2) {
        pay = ethers.parseEther(String(payAmount || '0'))
        if (payee === ethers.ZeroAddress || pay <= 0n) {
          throw new Error('链上还款请填写收款地址和金额')
        }
      }
      if (mode === 1 && refereeAddr && !ethers.isAddress(refereeAddr)) {
        throw new Error('裁判地址无效，可留空（提交证据后可自行主张守诺）')
      }

      const signer = await getSigner()
      const maker = await signer.getAddress()
      const nextId = Number(await protocolContract(getRpcProvider()).vowCount())
      const detail = `「${statement}」 · ${KIND_LABEL[kind]} · ${VERIFY_LABEL[mode]} · ${rounds} 天 / ${stake} YAN`

      const submitted =
        kind === 0 && mode === 0
          ? await sendTracked(
              '发起言约',
              detail,
              (protocol) => protocol.createVow(rounds, stakeWei, statement),
              { waitConfirm: false }
            )
          : await sendTracked(
              '发起言约',
              detail,
              (protocol) =>
                protocol.createVowEx(rounds, stakeWei, kind, mode, referee, payee, pay, statement),
              { waitConfirm: false }
            )

      // Optimistic row so the market updates before confirmation finishes.
      setWorld((prev) => ({
        ...prev,
        vows: [
          ...prev.vows.filter((v) => v.id !== nextId),
          {
            id: nextId,
            maker,
            guarantor: ethers.ZeroAddress,
            stakeMaker: stakeWei,
            stakeGuarantor: 0n,
            daysRequired: rounds,
            daysChecked: 0,
            lastCheckEpoch: 0,
            fadePool: 0n,
            status: 1,
            statement,
            kind,
            verifyMode: mode,
            referee,
            payee,
            payAmount: pay,
            paidAmount: 0n,
            deadlineEpoch: 0,
            evidenceCount: 0,
            pastDue: false,
            evidences: [],
            lastEvidence: ethers.ZeroHash,
            fades: [],
          },
        ],
      }))
      setExpandedMyVowId(nextId)
      setStatementText('')
      setBusy(false)

      const link = txUrl(submitted.hash)
      setLog(
        link ? `已提交发起言约，等待确认：${link}` : '已提交发起言约，等待链上确认…',
        'ok'
      )

      void (async () => {
        try {
          await submitted.wait()
          await refresh()
          setLog(
            mode === 1
              ? `言约 #${nextId} 已上链。担保开工后，可在市场卡片上传图片作证据。`
              : `言约 #${nextId} 已上链确认。可在「全部言约」查看详情。`,
            'ok'
          )
        } catch (e) {
          console.error(e)
          setLog(formatError(e), 'err')
          await refresh().catch(() => {})
        }
      })()
    } catch (e) {
      console.error(e)
      setLog(formatError(e), 'err')
      setBusy(false)
    }
  }

  async function onGuarantee(vow) {
    await withBusy(
      `担保言约 #${vow.id}`,
      async () => {
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        await ensureAllowance(signer, guaranteeWei)
        const tx = await protocolContract(signer).guarantee(vow.id, guaranteeWei)
        const receipt = await tx.wait()
        pushActivity('我信他', receipt.hash, `言约 #${vow.id} · ${guaranteeAmount} YAN`, actor)
      },
      { vowId: vow.id, action: 'guarantee' },
    )
  }

  async function onFade(vow) {
    await withBusy(
      `看衰言约 #${vow.id}`,
      async () => {
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        await ensureAllowance(signer, fadeWei)
        const tx = await protocolContract(signer).fade(vow.id, fadeWei)
        const receipt = await tx.wait()
        pushActivity('赌你做不到', receipt.hash, `言约 #${vow.id} · ${fadeAmount} YAN`, actor)
      },
      { vowId: vow.id, action: 'fade' },
    )
  }

  async function onCheckIn(vow, note = '') {
    await withBusy(
      `签到言约 #${vow.id}`,
      async () => {
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        const protocol = protocolContract(signer)
        let tx
        if (vow.verifyMode === 1) {
          const hash = resolveEvidenceHash(note)
          if (hash === ethers.ZeroHash) throw new Error('请先上传证据图片或填写说明')
          tx = await protocol.checkInWithProof(vow.id, hash)
        } else {
          tx = await protocol.checkIn(vow.id)
        }
        const receipt = await tx.wait()
        pushActivity(
          vow.verifyMode === 1 ? '签到并上链证据' : '今日签到',
          receipt.hash,
          `言约 #${vow.id}`,
          actor,
        )
      },
      { vowId: vow.id, action: 'checkIn' },
    )
  }

  async function onMiss(vow) {
    await withBusy(
      `食言结算 #${vow.id}`,
      async () => {
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        const protocol = protocolContract(signer)
        let lastStatus = 2
        let lastHash = ''
        for (let i = 0; i < 6; i++) {
          const tx = await protocol.missSettle(vow.id)
          const receipt = await tx.wait()
          lastHash = receipt.hash
          const v = await protocol.getVow(vow.id)
          lastStatus = Number(v.status)
          if (lastStatus !== 2) break
          const epoch = Number(await protocol.currentEpoch())
          if (epoch <= Number(v.lastCheckEpoch) + 1) break
        }
        pushActivity(
          lastStatus === 4 ? '食言结算' : '结算尝试',
          lastHash,
          `言约 #${vow.id} · ${STATUS[lastStatus]}`,
          actor,
        )
        if (lastStatus === 4) setBrokenFlashId(vow.id)
      },
      { vowId: vow.id, action: 'miss' },
    )
  }

  async function onSubmitEvidence(vow, note = '') {
    await withBusy(
      `提交证据 #${vow.id}`,
      async () => {
        const hash = resolveEvidenceHash(note)
        if (hash === ethers.ZeroHash) throw new Error('请先上传证据图片或填写说明')
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        const tx = await protocolContract(signer).submitEvidence(vow.id, hash)
        const receipt = await tx.wait()
        pushActivity('提交证据', receipt.hash, shortHash(hash), actor)
      },
      { vowId: vow.id, action: 'submitEvidence' },
    )
  }

  async function onFulfillPay(vow) {
    await withBusy(
      `链上还款 #${vow.id}`,
      async () => {
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        await ensureAllowance(signer, vow.payAmount)
        const tx = await protocolContract(signer).fulfillPay(vow.id)
        const receipt = await tx.wait()
        pushActivity('链上还款', receipt.hash, `${formatYan(vow.payAmount)} YAN`, actor)
      },
      { vowId: vow.id, action: 'fulfillPay' },
    )
  }

  async function onClaimKept(vow) {
    await withBusy(
      `主张守诺 #${vow.id}`,
      async () => {
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        const tx = await protocolContract(signer).claimKept(vow.id)
        const receipt = await tx.wait()
        pushActivity('主张守诺', receipt.hash, `言约 #${vow.id}`, actor)
      },
      { vowId: vow.id, action: 'claimKept' },
    )
  }

  async function onRefereeResolve(vow, kept) {
    await withBusy(
      `${kept ? '裁判判定守诺' : '裁判判定食言'} #${vow.id}`,
      async () => {
        const signer = await getSigner()
        const actor = displayName(await signer.getAddress())
        const tx = await protocolContract(signer).refereeResolve(vow.id, kept)
        const receipt = await tx.wait()
        pushActivity(kept ? '裁判守诺' : '裁判食言', receipt.hash, `言约 #${vow.id}`, actor)
        if (!kept) setBrokenFlashId(vow.id)
      },
      { vowId: vow.id, action: kept ? 'refereeKeep' : 'refereeBreak' },
    )
  }

  async function onEnableSession() {
    await withBusy('授权日签钥匙', async () => {
      const signer = await getSigner()
      const owner = await signer.getAddress()
      const session = loadOrCreateSessionWallet(owner)
      if (!session) throw new Error('无法创建 session key')
      await fundSessionOnLocal(session)
      const tx = await protocolContract(signer).setSessionKey(session.address)
      const receipt = await tx.wait()
      pushActivity('授权日签', receipt.hash, shortAddr(session.address), displayName(owner))
      setSessionAddr(session.address)
      return isLocal
        ? `日签钥匙已授权：${shortAddr(session.address)}。本地已自动充 Gas，可点「日签打卡」。`
        : `日签钥匙已授权：${shortAddr(session.address)}。测试网请给该地址转一点 MON 作 Gas（不会自动灌），再点「日签打卡」——现场可用它代替空 pulse 讲高频履约。`
    })
  }

  async function onSessionCheckIn(vow) {
    await withBusy(
      `日签打卡 #${vow.id}`,
      async () => {
        if (vow.verifyMode === 1) {
          throw new Error('需要证据的签到请先在卡片里上传图片')
        }
        const ownerSigner = await getSigner()
        const owner = await ownerSigner.getAddress()
        const session = loadOrCreateSessionWallet(owner)
        if (!session) throw new Error('没有日签钥匙')
        const onChain = await protocolContract(getRpcProvider()).sessionKey(owner)
        if (!sameAddr(onChain, session.address)) {
          throw new Error('请先点「授权日签钥匙」')
        }
        await fundSessionOnLocal(session)
        const protocol = protocolContract(session)
        const tx = await protocol.checkIn(vow.id)
        const receipt = await tx.wait()
        pushActivity('日签打卡', receipt.hash, `session · #${vow.id}`, shortAddr(session.address))
      },
      { vowId: vow.id, action: 'sessionCheckIn' },
    )
  }

  async function onWarp() {
    if (!canWarp) {
      setLog('快进仅部署者可调用，避免测试网时钟被拨乱。', 'err')
      return
    }
    await withBusy('快进一天', async () => {
      const signer = await getSigner()
      const actor = displayName(await signer.getAddress())
      const tx = await protocolContract(signer).demoWarpRounds(1)
      const receipt = await tx.wait()
      pushActivity('快进一天', receipt.hash, `+${epochLen}s · owner`, actor)
    })
  }

  /** Concurrent on-chain burst via pulseAt(tag): distinct storage slots + local nonces. */
  async function onChainBurst() {
    const N = 8
    if (!connected) {
      setLog('请先连接钱包', 'err')
      return
    }
    await withBusy(`链上连发 ${N} 笔`, async () => {
      const signer = await getSigner()
      const actor = displayName(await signer.getAddress())
      const protocol = protocolContract(signer)
      const from = await signer.getAddress()
      const provider = signer.provider
      const t0 = performance.now()

      let hashes = []
      try {
        const [nonce, fee] = await Promise.all([
          provider.getTransactionCount(from, 'pending'),
          provider.getFeeData(),
        ])
        setLog(`链上并发提交 ${N} 笔 pulseAt…`, 'busy')
        const overrides = {
          gasLimit: 120000n,
        }
        if (fee.maxFeePerGas) {
          overrides.maxFeePerGas = fee.maxFeePerGas
          overrides.maxPriorityFeePerGas = fee.maxPriorityFeePerGas ?? fee.maxFeePerGas
        } else if (fee.gasPrice) {
          overrides.gasPrice = fee.gasPrice
        }
        const txs = await Promise.all(
          Array.from({ length: N }, (_, i) =>
            protocol.pulseAt(i, { ...overrides, nonce: nonce + i }),
          ),
        )
        hashes = txs.map((tx) => tx.hash)
        hashes.forEach((hash, i) => {
          pushActivity(`脉冲 ${i + 1}/${N}`, hash, `pulseAt(${i})`, actor)
        })
        await Promise.all(txs.map((tx) => tx.wait()))
      } catch (concurrentErr) {
        // MetaMask often serializes user confirms; fall back to sequential pulseAt.
        console.warn('concurrent burst failed, falling back', concurrentErr)
        hashes = []
        for (let i = 0; i < N; i++) {
          setLog(`链上连发 ${i + 1}/${N}…（请在钱包确认）`, 'busy')
          const tx = await protocol.pulseAt(i)
          const receipt = await tx.wait()
          hashes.push(receipt.hash)
          pushActivity(`脉冲 ${i + 1}/${N}`, receipt.hash, `pulseAt(${i})`, actor)
        }
      }

      const ms = Math.round(performance.now() - t0)
      const avg = Math.round(ms / N)
      const first = hashes[0]
      const last = hashes[hashes.length - 1]
      pushActivity('链上连发汇总', last, `${N} 笔 pulseAt · ${ms}ms · 均 ${avg}ms`, actor)
      return (
        `${N} 笔 pulseAt 已确认，共 ${ms}ms（均 ${avg}ms/笔）。独立槽写入 · 确认密度体感，不是 10k TPS。` +
        ` 口播：确认一慢，日签经济就空转——所以是 Monad。` +
        (first ? ` 首笔 ${txUrl(first)} · 末笔 ${txUrl(last)}` : '')
      )
    })
  }

  function resetGuide() {
    setGuideStep(0)
    setGuideVowId(null)
    setBrokenFlashId(null)
  }

  function onGuideStart() {
    if (!usingDemo || !isLocal) {
      setLog('分步演示需要本地 Hardhat + 演示模式。测试网请用 MetaMask。', 'err')
      return
    }
    setBrokenFlashId(null)
    setGuideVowId(null)
    setWalletId('w1')
    setGuideStep(1)
    setLog('引导已开始：点第 1 步「立约」。每一步都会上链。')
  }

  async function onGuideStep(stepId) {
    if (!usingDemo) {
      setLog('分步演示仅在演示模式下可用', 'err')
      return
    }
    if (busy || stepId !== guideStep) return

    try {
      setBusy(true)
      const a = await walletFromId('w1')
      const b = await walletFromId('w2')
      const c = await walletFromId('w3')

      if (stepId === 1) {
        setWalletId('w1')
        setLog('① 钱包 A 发起言约…')
        await ensureAllowance(a, stakeWei)
        const statement = String(statementText || '').trim() || DEMO_STATEMENT
        const tx = await protocolContract(a).createVow(rounds, stakeWei, statement)
        const receipt = await tx.wait()
        pushActivity('发起言约', receipt.hash, `「${statement}」 · ${rounds} 天`, displayName(await a.getAddress()))
        const data = await refresh()
        const vowId = data.vows[data.vows.length - 1].id
        setGuideVowId(vowId)
        setGuideStep(2)
        setLog(`言约 #${vowId} 已创建。继续点第 2 步：钱包 B「我信他」。`)
        return
      }

      if (stepId === 2) {
        if (guideVowId == null) throw new Error('还没有言约，请先执行第 1 步')
        setWalletId('w2')
        setLog(`② 钱包 B 担保言约 #${guideVowId}…`)
        await ensureAllowance(b, stakeWei)
        const tx = await protocolContract(b).guarantee(guideVowId, stakeWei)
        const receipt = await tx.wait()
        pushActivity('我信他', receipt.hash, `言约 #${guideVowId}`, displayName(await b.getAddress()))
        await refresh()
        setGuideStep(3)
        setLog('担保完成，合约开工。继续点第 3 步：钱包 C「赌你做不到」。')
        return
      }

      if (stepId === 3) {
        if (guideVowId == null) throw new Error('还没有言约，请先执行第 1 步')
        setWalletId('w3')
        setLog(`③ 钱包 C 看衰言约 #${guideVowId}…`)
        await ensureAllowance(c, fadeWei)
        const tx = await protocolContract(c).fade(guideVowId, fadeWei)
        const receipt = await tx.wait()
        pushActivity('赌你做不到', receipt.hash, `言约 #${guideVowId} · ${fadeAmount} YAN`, displayName(await c.getAddress()))
        await refresh()
        setGuideStep(4)
        setLog('看衰池已注入。继续点第 4 步：快进时间。')
        return
      }

      if (stepId === 4) {
        setWalletId('w1')
        setLog('④ 快进两天…')
        const tx = await protocolContract(a).demoWarpRounds(2)
        const receipt = await tx.wait()
        pushActivity('快进两天', receipt.hash, '演示时钟', displayName(await a.getAddress()))
        await refresh()
        setGuideStep(5)
        setLog('时间到了，立约人没签到。继续点第 5 步：食言结算。')
        return
      }

      if (stepId === 5) {
        if (guideVowId == null) throw new Error('还没有言约，请先执行第 1 步')
        setWalletId('w1')
        setLog(`⑤ 食言结算 #${guideVowId}…`)
        let lastStatus = 2
        let lastHash = ''
        const protocol = protocolContract(a)
        for (let i = 0; i < 6; i++) {
          const tx = await protocol.missSettle(guideVowId)
          const receipt = await tx.wait()
          lastHash = receipt.hash
          const v = await protocol.getVow(guideVowId)
          lastStatus = Number(v.status)
          if (lastStatus !== 2) break
          const epoch = Number(await protocol.currentEpoch())
          if (epoch <= Number(v.lastCheckEpoch) + 1) break
        }
        pushActivity('食言结算', lastHash, `言约 #${guideVowId}`, displayName(await a.getAddress()))
        const data = await refresh()
        if (lastStatus === 4) setBrokenFlashId(guideVowId)
        const fader = data.board.find((x) => sameAddr(x.address, DEMO_WALLETS[2].address))
        setGuideStep(6)
        setLog(
          lastStatus === 4
            ? `演示完成：已食言。钱包 C 现有 ${formatYan(fader?.balance || 0n)} YAN。看图谱红边与「最近活动」。`
            : '结算未完成，可再点言约上的「食言结算」，或点「再来一遍」。'
        )
      }
    } catch (e) {
      console.error(e)
      setLog(e.shortMessage || e.reason || e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  async function onOneClickDemo() {
    if (!usingDemo || !isLocal) {
      setLog('一键演示仅本地 Hardhat + 演示模式可用。测试网请用 MetaMask 切换账户，或展开路演工具点「链上连发」。', 'err')
      return
    }
    try {
      setBusy(true)
      setBrokenFlashId(null)
      setGuideStep(0)
      setGuideVowId(null)
      const t0 = performance.now()
      setLog('① 钱包 A 发起言约…')

      const a = await walletFromId('w1')
      const b = await walletFromId('w2')
      const c = await walletFromId('w3')

      await ensureAllowance(a, stakeWei)
      const statement = String(statementText || '').trim() || DEMO_STATEMENT
      let tx = await protocolContract(a).createVow(rounds, stakeWei, statement)
      let receipt = await tx.wait()
      pushActivity('发起言约', receipt.hash, `「${statement}」 · ${rounds} 天`, displayName(await a.getAddress()))
      let data = await refresh()
      const vowId = data.vows[data.vows.length - 1].id

      setLog('② 钱包 B 说：我信他…')
      await ensureAllowance(b, stakeWei)
      tx = await protocolContract(b).guarantee(vowId, stakeWei)
      receipt = await tx.wait()
      pushActivity('我信他', receipt.hash, `言约 #${vowId}`, displayName(await b.getAddress()))
      await refresh()

      setLog('③ 钱包 C 押：你做不到…')
      await ensureAllowance(c, fadeWei)
      tx = await protocolContract(c).fade(vowId, fadeWei)
      receipt = await tx.wait()
      pushActivity('赌你做不到', receipt.hash, `言约 #${vowId} · ${fadeAmount} YAN`, displayName(await c.getAddress()))
      await refresh()

      setLog('④ 时间走完…')
      tx = await protocolContract(a).demoWarpRounds(2)
      receipt = await tx.wait()
      pushActivity('快进两天', receipt.hash, '演示时钟 · owner', displayName(await a.getAddress()))
      await refresh()

      setLog('⑤ 食言结算…')
      let lastStatus = 2
      let lastHash = ''
      const protocol = protocolContract(a)
      for (let i = 0; i < 6; i++) {
        tx = await protocol.missSettle(vowId)
        receipt = await tx.wait()
        lastHash = receipt.hash
        const v = await protocol.getVow(vowId)
        lastStatus = Number(v.status)
        if (lastStatus !== 2) break
        const epoch = Number(await protocol.currentEpoch())
        if (epoch <= Number(v.lastCheckEpoch) + 1) break
      }
      pushActivity('食言结算', lastHash, `言约 #${vowId}`, displayName(await a.getAddress()))
      data = await refresh()
      if (lastStatus === 4) setBrokenFlashId(vowId)
      setGuideStep(6)
      setGuideVowId(vowId)

      const fader = data.board.find((x) => sameAddr(x.address, DEMO_WALLETS[2].address))
      const ms = Math.round(performance.now() - t0)
      setLog(
        lastStatus === 4
          ? `演示完成（${ms}ms）：已食言。钱包 C 现有 ${formatYan(fader?.balance || 0n)} YAN。看「最近活动」里的交易。`
          : `演示结束（${ms}ms），可再点该言约的食言结算`
      )
    } catch (e) {
      console.error(e)
      setLog(formatError(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  async function onConnectMetaMask() {
    if (!window.ethereum) {
      setLog('未检测到 MetaMask。路演可先点「使用演示模式」。', 'err')
      return
    }
    try {
      setBusy(true)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const session = await readMetaMaskSession()
      setMyAddress(accounts?.[0] || session.address || '')
      setMmChainId(session.chainId)
      setWalletMode('metamask')
      if (session.chainId !== chainId) {
        setLog(`已连接，请切换到 ${networkName}。`, 'err')
      } else {
        setLog('已连接。可立约、担保或看衰。', 'ok')
      }
    } catch (e) {
      setLog(e.shortMessage || e.reason || e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  async function onSwitchNetwork() {
    try {
      setBusy(true)
      await switchToAppNetwork()
      const session = await readMetaMaskSession()
      setMmChainId(session.chainId)
      await refresh()
      setLog(`已切换到 ${networkName}`, 'ok')
    } catch (e) {
      setLog(e.shortMessage || e.reason || e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  async function onRefreshBar() {
    try {
      setRefreshing(true)
      await refresh()
      setLog('已刷新余额与言约状态', 'ok')
    } catch (e) {
      setLog(e.shortMessage || e.reason || e.message, 'err')
    } finally {
      setRefreshing(false)
    }
  }

  async function onClaimYan() {
    await withBusy('领取测试 YAN', async () => {
      if (usingMetaMask && mmChainId !== chainId) {
        throw new Error(`请先切换到 ${networkName}，再领取`)
      }
      const signer = await getSigner()
      const actor = displayName(await signer.getAddress())
      const yan = yanContract(signer)
      const addr = await signer.getAddress()
      if (await yan.hasClaimed(addr)) {
        const bal = await yan.balanceOf(addr)
        return `该地址已领取过。当前余额 ${formatYan(bal)} YAN。`
      }
      const tx = await yan.claim()
      const receipt = await tx.wait()
      pushActivity('领取测试 YAN', receipt.hash, 'claim', actor)
      const link = txUrl(receipt.hash)
      return link ? `领取成功。交易：${link}` : '领取成功'
    })
  }

  async function onAddToken() {
    try {
      const ok = await watchYanToken()
      setLog(
        ok
          ? `已推荐添加 YAN（${shortAddr(yanAddress)}）。请到钱包代币页确认。`
          : '未添加 YAN（可能点了拒绝）',
        ok ? 'ok' : 'err'
      )
    } catch (e) {
      setLog(formatError(e), 'err')
    }
  }

  async function onChangeNetwork(nextId) {
    if (!NETWORKS[nextId] || nextId === networkId) return
    const next = setActiveNetwork(nextId)
    setNetworkId(nextId)
    setActivities([])
    setBrokenFlashId(null)
    resetGuide()

    if (nextId === 'local') {
      // 演示模式自动切本地；MetaMask 连接本地时提示切链
      if (walletMode === 'metamask') {
        setMmChainId(null)
        setLog(`已切到 ${next.name}。请点「切换到 ${next.name}」同步 MetaMask，或改用演示模式。`, 'info')
      } else if (walletMode === 'demo') {
        setMmChainId(next.chainId)
        setLog(`已切到 ${next.name} · 演示模式`, 'ok')
      } else {
        setLog(`已切到 ${next.name}。可点「使用演示模式」或连接 MetaMask。`, 'ok')
      }
    } else {
      // Monad Testnet：退出演示（演示钱包只在本地有效）
      if (walletMode === 'demo') {
        setWalletMode('disconnected')
        setMyAddress('')
        setBalance(0n)
        setMmChainId(null)
        setLog(`已切到 ${next.name}。演示模式仅本地可用，请连接 MetaMask。`, 'info')
      } else if (walletMode === 'metamask') {
        setMmChainId(null)
        setLog(`已切到 ${next.name}。请点「切换到 ${next.name}」同步 MetaMask。`, 'info')
      } else {
        setLog(`已切到 ${next.name}。`, 'ok')
      }
    }

    try {
      setRefreshing(true)
      await refresh()
    } catch (e) {
      setLog(
        nextId === 'local'
          ? `本地链暂不可用：${formatError(e)}。请先运行 start-demo.sh。`
          : formatError(e),
        'err',
      )
    } finally {
      setRefreshing(false)
    }
  }

  function onUseDemo() {
    // 演示模式强制本地链
    const next = setActiveNetwork('local')
    setNetworkId('local')
    setWalletMode('demo')
    setWalletId('w1')
    setMmChainId(next.chainId)
    resetGuide()
    setLog('已进入演示模式（自动切到本地链）。请确认已运行 start-demo.sh。', 'ok')
    refresh().catch((e) => {
      setLog(`本地链暂不可用：${formatError(e)}。请先运行 start-demo.sh。`, 'err')
    })
  }

  function onDisconnect() {
    setWalletMode('disconnected')
    setMyAddress('')
    setBalance(0n)
    setMmChainId(null)
    resetGuide()
    setLog('已断开。连接钱包后再操作。')
  }

  const sortedVows = useMemo(
    () => [...world.vows].sort((a, b) => b.id - a.id),
    [world.vows]
  )
  const openVows = useMemo(
    () => sortedVows.filter((v) => v.status === 1 || v.status === 2),
    [sortedVows]
  )
  const pendingVows = useMemo(
    () => sortedVows.filter((v) => v.status === 1),
    [sortedVows]
  )
  const closedVows = useMemo(
    () => sortedVows.filter((v) => v.status === 3 || v.status === 4),
    [sortedVows]
  )

  function enterMarket() {
    try {
      localStorage.setItem(ENTERED_KEY, '1')
    } catch {
      // ignore
    }
    setEntered(true)
  }

  function backToIntro() {
    try {
      localStorage.removeItem(ENTERED_KEY)
    } catch {
      // ignore
    }
    setEntered(false)
  }

  function scrollToCreate() {
    document.getElementById('create-vow')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function getEvidenceDraft(vowId) {
    return normalizeEvidenceDraft(evidenceDrafts[vowId])
  }

  function setEvidenceDraft(vowId, next) {
    setEvidenceDrafts((prev) => ({ ...prev, [vowId]: normalizeEvidenceDraft(next) }))
  }

  function clearEvidenceDraft(vowId) {
    setEvidenceDrafts((prev) => {
      const next = { ...prev }
      delete next[vowId]
      return next
    })
  }

  const btnCls = `yan-btn${busy ? ' is-busy' : ''}`

  if (!entered) {
    return <IntroGate onEnter={enterMarket} />
  }

  return (
    <div style={styles.page}>
      <WalletBar
        walletMode={walletMode}
        walletId={walletId}
        onChangeWallet={setWalletId}
        networkId={networkId}
        onChangeNetwork={onChangeNetwork}
        address={myAddress}
        balance={balance}
        mmChainId={mmChainId}
        refreshing={refreshing || busy}
        onRefresh={onRefreshBar}
        onSwitchNetwork={onSwitchNetwork}
        onClaim={onClaimYan}
        onAddToken={onAddToken}
        onConnectMetaMask={onConnectMetaMask}
        onUseDemo={onUseDemo}
        onDisconnect={onDisconnect}
        onBackIntro={backToIntro}
      />

      <div className="yan-story">
        <div style={styles.storyLine}>没有人担保，合约不开工。</div>
        <div style={styles.storyMeta}>
          最低押金 {minStake} YAN
          {' · '}演示一天 = {epochLen} 秒
          {' · '}{networkName}
          {' · '}确认一慢，日签经济就空转（Why Monad）
        </div>
      </div>

      <main className="yan-main">
        <div className="yan-col-main">
          <TrustGraph vows={world.vows} brokenFlashId={brokenFlashId} />

        <section style={styles.panel}>
          <h2 style={styles.h2}>言约市场</h2>
          <p style={styles.hint}>
            链上共 {sortedVows.length} 条言约，其中 <b>{pendingVows.length}</b> 条待担保。
            想开工就点 <b>我信他</b>；已开工的可直接 <b>赌你做不到</b>，投过仍可继续加注。
            <span style={styles.hintMute}> · {shortAddr(protocolAddress)}</span>
          </p>

          {!connected && (
            <div style={styles.connectBanner}>
              先在顶部连接 MetaMask，或使用演示模式。未连接不能投注或立约。
            </div>
          )}

          <div style={styles.marketBox}>
            <div style={styles.marketHead}>
              <h3 style={styles.marketTitle}>可投注</h3>
              <span style={styles.marketCount}>
                {pendingVows.length} 条待担保 · {openVows.length} 条开放中
              </span>
            </div>
            {openVows.length === 0 ? (
              <div style={styles.emptyMarket}>
                <div style={styles.emptyTitle}>近日没有开放盘口</div>
                <div>自己发起一条，或等朋友用另一个地址立约后，即可点相信／看衰。</div>
                <button
                  type="button"
                  className="yan-btn yan-empty-cta"
                  onClick={scrollToCreate}
                  style={styles.ctaBtn}
                >
                  发起第一条言约
                </button>
              </div>
            ) : (
              <div style={styles.vowList}>
                {openVows.map((vow) => (
                  <VowCard
                    key={vow.id}
                    vow={vow}
                    me={myAddress}
                    epoch={world.epoch}
                    busy={actionsLocked}
                    confirmingAction={pending?.vowId === vow.id ? pending.action : null}
                    hasSession={Boolean(sessionAddr)}
                    guaranteeAmount={guaranteeAmount}
                    onGuaranteeAmountChange={setGuaranteeAmount}
                    fadeAmount={fadeAmount}
                    onFadeAmountChange={setFadeAmount}
                    highlightBet
                    onGuarantee={() => onGuarantee(vow)}
                    onFade={() => onFade(vow)}
                    onCheckIn={() => onCheckIn(vow)}
                    onSessionCheckIn={() => onSessionCheckIn(vow)}
                    onMiss={() => onMiss(vow)}
                    evidenceDraft={getEvidenceDraft(vow.id)}
                    onEvidenceDraftChange={(draft) => setEvidenceDraft(vow.id, draft)}
                    onEvidenceCheckIn={() =>
                      onCheckIn(vow, getEvidenceDraft(vow.id)).then(() => clearEvidenceDraft(vow.id))
                    }
                    onSubmitEvidence={() =>
                      onSubmitEvidence(vow, getEvidenceDraft(vow.id)).then(() => clearEvidenceDraft(vow.id))
                    }
                    onFulfillPay={() => onFulfillPay(vow)}
                    onClaimKept={() => onClaimKept(vow)}
                    onRefereeKeep={() => onRefereeResolve(vow, true)}
                    onRefereeBreak={() => onRefereeResolve(vow, false)}
                  />
                ))}
              </div>
            )}
          </div>

          <MyVowsPanel
            vows={world.vows}
            me={myAddress}
            epoch={world.epoch}
            connected={connected}
            busy={actionsLocked}
            pending={pending}
            expandedId={expandedMyVowId}
            onExpand={setExpandedMyVowId}
            onCheckIn={onCheckIn}
            onSubmitEvidence={onSubmitEvidence}
            onClaimKept={onClaimKept}
            onFulfillPay={onFulfillPay}
            onScrollCreate={scrollToCreate}
            getEvidenceDraft={getEvidenceDraft}
            setEvidenceDraft={setEvidenceDraft}
            clearEvidenceDraft={clearEvidenceDraft}
          />

          {closedVows.length > 0 && (
            <details className="yan-more" style={styles.closedBox}>
              <summary style={styles.closedSum}>已结束 · {closedVows.length}</summary>
              <div style={{ ...styles.vowList, marginTop: 10 }}>
                {closedVows.map((vow) => (
                  <VowCard
                    key={vow.id}
                    vow={vow}
                    me={myAddress}
                    epoch={world.epoch}
                    busy={actionsLocked}
                    confirmingAction={pending?.vowId === vow.id ? pending.action : null}
                    hasSession={Boolean(sessionAddr)}
                    guaranteeAmount={guaranteeAmount}
                    onGuaranteeAmountChange={setGuaranteeAmount}
                    fadeAmount={fadeAmount}
                    onFadeAmountChange={setFadeAmount}
                    onGuarantee={() => onGuarantee(vow)}
                    onFade={() => onFade(vow)}
                    onCheckIn={() => onCheckIn(vow)}
                    onSessionCheckIn={() => onSessionCheckIn(vow)}
                    onMiss={() => onMiss(vow)}
                    evidenceDraft={getEvidenceDraft(vow.id)}
                    onEvidenceDraftChange={(draft) => setEvidenceDraft(vow.id, draft)}
                    onEvidenceCheckIn={() =>
                      onCheckIn(vow, getEvidenceDraft(vow.id)).then(() => clearEvidenceDraft(vow.id))
                    }
                    onSubmitEvidence={() =>
                      onSubmitEvidence(vow, getEvidenceDraft(vow.id)).then(() => clearEvidenceDraft(vow.id))
                    }
                    onFulfillPay={() => onFulfillPay(vow)}
                    onClaimKept={() => onClaimKept(vow)}
                    onRefereeKeep={() => onRefereeResolve(vow, true)}
                    onRefereeBreak={() => onRefereeResolve(vow, false)}
                  />
                ))}
              </div>
            </details>
          )}

          <details style={styles.advanced} open={!isLocal}>
            <summary style={styles.advancedSum}>路演工具 · Why Monad 现场拍</summary>
            <div style={styles.advancedBody}>
              <p style={styles.createHelp}>
                测试网推荐：预跑食言红边讲故事 → 再点下方「链上连发」看确认密度。
                口播：「履约要轻到能天天发生；确认一慢，日签经济就空转。」不是 10k TPS 证明。
              </p>
              <GuidedDemo
                enabled={usingDemo}
                busy={busy}
                step={guideStep}
                onStart={onGuideStart}
                onRunStep={onGuideStep}
                onRestart={onGuideStart}
              />
              <button
                type="button"
                disabled={!usingDemo || !isLocal || busy}
                onClick={onOneClickDemo}
                className={btnCls}
                style={styles.demoBtn}
              >
                一键跑完五步{isLocal ? '' : '（仅本地）'}
              </button>
              <button
                type="button"
                disabled={!connected || busy}
                onClick={onChainBurst}
                className={btnCls}
                style={styles.pulseBtn}
                title="连续发送 8 笔 pulseAt（独立槽）并计时——确认密度，非 TPS"
              >
                链上连发 8 笔并计时
              </button>
              <p style={styles.createHelp}>
                Why Monad 现场拍：真实 `pulseAt` 写入独立槽，测确认密度（并行友好写入），不是 10k TPS。
                口播咬死「确认一慢，日签经济就空转」。每笔上 Explorer；钱包可能仍串行弹窗。
              </p>
            </div>
          </details>

          <div
            className={`yan-log yan-log--${log.tone || 'info'}`}
            style={styles.log}
            role="status"
            aria-live="polite"
          >
            <span className="yan-log-dot" />
            <span>{log.text}</span>
          </div>
        </section>
        </div>

        <aside className="yan-col-side">
          <div id="create-vow" style={styles.createBoxSide}>
            <div style={styles.createTitle}>发起言约</div>
            <p style={styles.createHelp}>
              先写清楚你要对什么下赌注，例如「坚持跑步7天」「坚持11点前睡觉」。这段文字会上链。
              每日报到按「签到天数」逐日签到；到期验收只在截止前完成一次。
              需要证明完成度时，选证据模式：在市场卡片上传图片，文件哈希上链，并可设**独立裁判**（裁判 ≠ 担保人）。
              链上还款模式由合约直接验收转账。演示一天 = {epochLen} 秒。
            </p>
            <div style={styles.row}>
              <label style={{ ...styles.label, minWidth: '100%' }}>
                承诺内容（必填，自己写）
                <textarea
                  className="yan-input"
                  style={styles.textarea}
                  rows={2}
                  placeholder="例如：坚持跑步7天 / 坚持11点前睡觉"
                  value={statementText}
                  onChange={(e) => setStatementText(e.target.value)}
                  disabled={!connected}
                />
              </label>
            </div>
            <p style={styles.createHelp}>
              {statementByteLen(statementText)} / {MAX_STATEMENT_BYTES} 字节
              {statementByteLen(statementText) < 2
                ? ' · 至少写一句具体承诺'
                : statementByteLen(statementText) > MAX_STATEMENT_BYTES
                  ? ' · 超出上限，请缩短'
                  : ''}
            </p>
            <div style={styles.row}>
              <div style={styles.label}>
                约的种类
                <div style={styles.choiceRow}>
                  {[0, 1].map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={!connected || verifyMode === 2}
                      onClick={() => setVowKind(k)}
                      className="yan-btn"
                      style={{
                        ...styles.choiceBtn,
                        ...((verifyMode === 2 ? 1 : vowKind) === k ? styles.choiceOn : {}),
                      }}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.label}>
                如何验收
                <div style={styles.choiceRow}>
                  {[0, 1, 2].map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={!connected}
                      onClick={() => {
                        setVerifyMode(m)
                        if (m === 2) setVowKind(1)
                      }}
                      className="yan-btn"
                      style={{
                        ...styles.choiceBtn,
                        ...(verifyMode === m ? styles.choiceOn : {}),
                      }}
                    >
                      {VERIFY_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={styles.row}>
              <label style={styles.label}>
                {verifyMode === 2 || vowKind === 1 ? '期限天数' : '签到天数'}
                <input
                  className="yan-input"
                  style={styles.input}
                  type="number"
                  min="1"
                  max="30"
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  disabled={!connected}
                />
              </label>
              <label style={styles.label}>
                押金 YAN
                <input
                  className="yan-input"
                  style={styles.input}
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  disabled={!connected}
                />
              </label>
            </div>
            <p style={styles.createHelp}>看衰请在上方「可投注」卡片里直接下注，投过仍可继续加注。</p>
            {verifyMode === 1 && (
              <div style={styles.row}>
                <label style={styles.label}>
                  第三方裁判（可选）
                  <input
                    className="yan-input"
                    style={styles.input}
                    placeholder="0x… 留空则提交证据后可自行主张守诺"
                    value={refereeAddr}
                    onChange={(e) => setRefereeAddr(e.target.value.trim())}
                    disabled={!connected}
                  />
                </label>
              </div>
            )}
            {verifyMode === 2 && (
              <div style={styles.row}>
                <label style={styles.label}>
                  收款地址
                  <input
                    className="yan-input"
                    style={styles.input}
                    placeholder="0x…"
                    value={payeeAddr}
                    onChange={(e) => setPayeeAddr(e.target.value.trim())}
                    disabled={!connected}
                  />
                </label>
                <label style={styles.label}>
                  还款 YAN
                  <input
                    className="yan-input"
                    style={styles.input}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    disabled={!connected}
                  />
                </label>
              </div>
            )}
            {verifyMode === 1 && (
              <p style={styles.createHelp}>
                已选「需要证据」：担保开工后，在市场卡片里选图上传，哈希写入合约。
              </p>
            )}
            <div style={styles.actions}>
              <button
                type="button"
                disabled={
                  actionsLocked ||
                  statementByteLen(statementText) < 2 ||
                  statementByteLen(statementText) > MAX_STATEMENT_BYTES
                }
                onClick={onCreate}
                className={btnCls}
                style={{ ...styles.ctaBtn, width: '100%' }}
              >
                {busy ? '确认中…' : '发起言约'}
              </button>
            </div>
            <details className="yan-more" style={{ marginTop: 12 }}>
              <summary>进阶：快进时钟／日签钥匙</summary>
              <div className="yan-more-body">
                <p style={styles.createHelp}>
                  日签钥匙只能代打卡。测试网授权后须给钥匙地址转 MON（不会自动灌），再点卡片「日签打卡」——适合讲「高频微履约」。
                  需要人审时用证据模式 + 独立裁判（裁判不能担保/看衰）。
                </p>
                {DEMO_MODE && (
                  <button
                    type="button"
                    disabled={actionsLocked || !canWarp}
                    onClick={onWarp}
                    className={btnCls}
                    style={styles.btn}
                    title="仅协议 owner 可快进"
                  >
                    快进一天
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionsLocked}
                  onClick={onEnableSession}
                  className={btnCls}
                  style={styles.btn}
                >
                  {sessionAddr ? `日签已授权 ${shortAddr(sessionAddr)}` : '授权日签钥匙'}
                </button>
              </div>
            </details>
          </div>

          <StakeLedger vows={world.vows} />
          <div style={styles.sidePanel}>
            <ActivityFeed items={activities} />
          </div>
        </aside>
      </main>
    </div>
  )
}

function VowCard({
  vow,
  me,
  epoch,
  busy,
  confirmingAction,
  hasSession,
  highlightBet,
  guaranteeAmount,
  onGuaranteeAmountChange,
  fadeAmount,
  onFadeAmountChange,
  onGuarantee,
  onFade,
  onCheckIn,
  onSessionCheckIn,
  onMiss,
  evidenceDraft,
  onEvidenceDraftChange,
  onEvidenceCheckIn,
  onSubmitEvidence,
  onFulfillPay,
  onClaimKept,
  onRefereeKeep,
  onRefereeBreak,
}) {
  const isMaker = sameAddr(me, vow.maker)
  const isGuarantor = sameAddr(me, vow.guarantor)
  const isReferee = sameAddr(me, vow.referee)
  const isParty = isMaker || isGuarantor
  const canMiss = vow.status === 2 && Boolean(vow.pastDue)
  const hasGuarantor = vow.guarantor && vow.guarantor !== ethers.ZeroAddress
  const hasReferee = vow.referee && vow.referee !== ethers.ZeroAddress
  const canFadeBet = vow.status === 2 && !isParty && !isReferee
  const waitingBet = (vow.status === 1 && !isMaker) || canFadeBet
  const showFadeOdds = vow.status >= 2
  const isDaily = (vow.kind || 0) === 0
  const isDeadline = vow.kind === 1
  const needsEvidence = vow.verifyMode === 1
  const isPay = vow.verifyMode === 2
  const canCheckIn =
    vow.status === 2 &&
    isMaker &&
    !needsEvidence &&
    ((isDaily && !isPay) || (isDeadline && vow.verifyMode === 0))
  const evidenceCount = vow.evidenceCount || (vow.evidences || []).length
  const pct = vow.daysRequired
    ? Math.min(100, (Number(vow.daysChecked) / Number(vow.daysRequired)) * 100)
    : 0
  const actionBusy = (action) => confirmingAction === action
  const btnClsFor = (action) => `yan-btn${actionBusy(action) ? ' is-busy' : ''}`
  const labelFor = (action, fallback) => (actionBusy(action) ? '确认中…' : fallback)
  let guaranteeAmountOk = false
  try {
    guaranteeAmountOk = ethers.parseEther(String(guaranteeAmount || '0')) >= ethers.parseEther('1')
  } catch {
    guaranteeAmountOk = false
  }
  let fadeAmountOk = false
  try {
    fadeAmountOk = ethers.parseEther(String(fadeAmount || '0')) >= ethers.parseEther('1')
  } catch {
    fadeAmountOk = false
  }
  const fadePool = (vow.fades || []).reduce((sum, fade) => {
    try {
      return sum + BigInt(fade.amount || 0)
    } catch {
      return sum
    }
  }, 0n)
  const myFadeTotal = (vow.fades || []).reduce((sum, fade) => {
    if (!me || !sameAddr(me, fade.better)) return sum
    try {
      return sum + BigInt(fade.amount || 0)
    } catch {
      return sum
    }
  }, 0n)
  const fadeFull = (vow.fades || []).length >= MAX_FADERS
  const hasMyFade = myFadeTotal > 0n

  const more = []
  if (canCheckIn && hasSession) {
    more.push(
      <button
        key="sess"
        type="button"
        disabled={busy}
        onClick={onSessionCheckIn}
        className={btnClsFor('sessionCheckIn')}
        style={styles.btn}
      >
        {labelFor('sessionCheckIn', '日签打卡')}
      </button>,
    )
  }
  if (canMiss) {
    more.push(
      <button
        key="miss"
        type="button"
        disabled={busy}
        onClick={onMiss}
        className={btnClsFor('miss')}
        style={styles.dangerBtn}
      >
        {labelFor('miss', '食言结算')}
      </button>,
    )
  }

  return (
    <div
      className="yan-card"
      style={{ ...styles.card, ...(highlightBet && waitingBet ? styles.cardHot : {}) }}
    >
      <div style={styles.cardTop}>
        <span style={styles.cardId}>
          #{vow.id}
          <span className={`status-pill status-pill--${vow.status}`} style={{ marginLeft: 8 }}>
            {STATUS[vow.status]}
          </span>
        </span>
        <span style={styles.cardProg}>
          {KIND_LABEL[vow.kind || 0]} · {vow.daysChecked}/{vow.daysRequired}
          {isDeadline ? ' 天期限' : ' 天签到'}
        </span>
      </div>
      {vow.statement ? <div style={styles.cardStatement}>{vow.statement}</div> : null}
      <div className="vow-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      {waitingBet && (
        <div style={styles.betTag}>{vow.status === 1 ? '盘口开放 · 担保开工' : '盘口开放 · 可看衰'}</div>
      )}
      <div style={styles.cardBody}>
        立约 {displayName(vow.maker)} · 押 {formatYan(vow.stakeMaker)} YAN
        <span style={{ color: '#8a8376' }}> · {VERIFY_LABEL[vow.verifyMode || 0]}</span>
      </div>
      {needsEvidence && (
        <div style={styles.cardBody}>
          证据 {evidenceCount} 份
          {hasReferee ? ` · 裁判 ${displayName(vow.referee)}` : ' · 无裁判，可主张守诺'}
        </div>
      )}
      <FulfillmentBox
        compact
        vow={vow}
        me={me}
        epoch={epoch}
        busy={busy}
        confirmingAction={confirmingAction}
        evidenceDraft={evidenceDraft}
        onEvidenceDraftChange={onEvidenceDraftChange}
        onCheckIn={needsEvidence ? onEvidenceCheckIn : onCheckIn}
        onSubmitEvidence={onSubmitEvidence}
        onFulfillPay={onFulfillPay}
      />

      <div className={`odds-grid${showFadeOdds ? '' : ' odds-grid--solo'}`}>
        <div className="odds-cell odds-cell--trust">
          <div className="odds-k">信</div>
          <div className="odds-v">
            {hasGuarantor ? `${formatYan(vow.stakeGuarantor)} YAN` : '—'}
          </div>
          <div className="odds-s">{hasGuarantor ? displayName(vow.guarantor) : '等待担保'}</div>
        </div>
        {showFadeOdds && (
          <div className="odds-cell odds-cell--fade">
            <div className="odds-k">衰</div>
            <div className="odds-v">{formatYan(fadePool)} YAN</div>
            <div className="odds-s">
              {vow.fades.length === 0 ? '还没有人看衰' : `${vow.fades.length} 人看衰`}
            </div>
          </div>
        )}
      </div>
      {showFadeOdds && vow.fades.length > 0 && (
        <ul className="fade-legs">
          {vow.fades.map((fade, index) => (
            <li key={`${fade.better}-${index}`} title={fade.better}>
              <span>{displayName(fade.better)}</span>
              <span className="fade-legs-dir">衰 → {displayName(vow.maker)}</span>
              <span className="fade-legs-amt">
                {formatYan(fade.amount)} YAN
                {fade.paid ? ' · 已获赔' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div style={styles.cardActions}>
        {vow.status === 1 && !isMaker && (
          <div style={styles.fadeBetRow}>
            <label style={styles.fadeAmountLabel}>
              <span style={styles.fadeAmountHint}>担保 YAN</span>
              <input
                className="yan-input"
                style={styles.fadeAmountInput}
                value={guaranteeAmount}
                onChange={(e) => onGuaranteeAmountChange?.(e.target.value)}
                disabled={busy}
                inputMode="decimal"
                placeholder="20"
                aria-label="担保金额（YAN）"
              />
            </label>
            <button
              type="button"
              disabled={busy || !guaranteeAmountOk}
              onClick={onGuarantee}
              className={btnClsFor('guarantee')}
              style={styles.ctaBtn}
            >
              {labelFor('guarantee', `我信他 · ${guaranteeAmount || '0'} YAN`)}
            </button>
          </div>
        )}
        {vow.status === 1 && isMaker && <span style={styles.doneTag}>等待别人担保</span>}
        {canFadeBet && (
          <div style={styles.fadeBetCol}>
            {hasMyFade && (
              <div style={styles.fadeAgainHint}>
                你已押 {formatYan(myFadeTotal)} YAN，可继续加注
              </div>
            )}
            {fadeFull ? (
              <span style={styles.doneTag}>看衰席位已满（{MAX_FADERS}）</span>
            ) : (
              <div style={styles.fadeBetRow}>
                <label style={styles.fadeAmountLabel}>
                  <span style={styles.fadeAmountHint}>
                    {hasMyFade ? '再押 YAN' : '下注 YAN'}
                  </span>
                  <input
                    className="yan-input"
                    style={styles.fadeAmountInput}
                    value={fadeAmount}
                    onChange={(e) => onFadeAmountChange?.(e.target.value)}
                    disabled={busy}
                    inputMode="decimal"
                    placeholder="20"
                    aria-label={hasMyFade ? '继续看衰金额（YAN）' : '看衰下注金额（YAN）'}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !fadeAmountOk}
                  onClick={onFade}
                  className={btnClsFor('fade')}
                  style={styles.fadeBtn}
                >
                  {labelFor(
                    'fade',
                    hasMyFade
                      ? `继续看衰 · ${fadeAmount || '0'} YAN`
                      : `赌你做不到 · ${fadeAmount || '0'} YAN`,
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        {vow.status === 2 && isParty && (
          <span style={styles.doneTag}>立约/担保方不能看衰本条</span>
        )}
        {vow.status === 2 && isReferee && !isParty && (
          <span style={styles.doneTag}>裁判不能看衰本条</span>
        )}
        {vow.status === 2 &&
          isMaker &&
          needsEvidence &&
          evidenceCount > 0 &&
          (isDeadline || vow.daysChecked >= vow.daysRequired) && (
            <button
              type="button"
              disabled={busy}
              onClick={onClaimKept}
              className={btnClsFor('claimKept')}
              style={styles.btn}
            >
              {labelFor('claimKept', '主张守诺')}
            </button>
          )}
        {vow.status === 2 && isReferee && needsEvidence && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onRefereeKeep}
              className={btnClsFor('refereeKeep')}
              style={styles.ctaBtn}
            >
              {labelFor('refereeKeep', '裁判：守诺')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRefereeBreak}
              className={btnClsFor('refereeBreak')}
              style={styles.dangerCta}
            >
              {labelFor('refereeBreak', '裁判：食言')}
            </button>
          </>
        )}
        {vow.status >= 3 && <span style={styles.doneTag}>{STATUS[vow.status]}</span>}
      </div>

      {more.length > 0 && (
        <details className="yan-more" style={{ marginTop: 8 }}>
          <summary>更多操作</summary>
          <div className="yan-more-body">{more}</div>
        </details>
      )}
    </div>
  )
}


const styles = {
  page: { minHeight: '100vh', background: 'radial-gradient(1200px 600px at 50% -10%, #1a1408 0%, #07070a 55%)' },
  storyLine: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: 20,
    letterSpacing: 2,
    color: '#f4efe4',
  },
  storyMeta: { color: '#8a8376', fontSize: 12, lineHeight: 1.6 },
  sidePanel: {
    marginTop: 0,
    background: 'rgba(12,12,16,0.9)',
    border: '1px solid rgba(212,175,55,0.16)',
    borderRadius: 18,
    padding: '8px 16px 16px',
  },
  panel: {
    background: 'rgba(12,12,16,0.9)',
    border: '1px solid rgba(212,175,55,0.16)',
    borderRadius: 18,
    padding: 22,
  },
  h2: { fontFamily: '"Cormorant Garamond", serif', fontSize: 28, letterSpacing: 3, color: '#d4af37' },
  hint: { color: '#9a9488', fontSize: 13, margin: '8px 0 14px', lineHeight: 1.6 },
  hintMute: { color: '#6e685c' },
  connectBanner: {
    marginBottom: 14,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid rgba(212,175,55,0.28)',
    background: 'rgba(212,175,55,0.08)',
    color: '#e8d48b',
    fontSize: 13,
    lineHeight: 1.6,
  },
  demoBtn: {
    width: '100%',
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    padding: '12px 16px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 8,
  },
  pulseBtn: {
    width: '100%',
    background: 'transparent',
    color: '#d4af37',
    border: '1px solid rgba(212,175,55,0.45)',
    padding: '11px 16px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 10,
  },
  createBox: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  createBoxSide: {
    border: '1px solid rgba(212,175,55,0.28)',
    borderRadius: 18,
    padding: 16,
    marginTop: 0,
    background: 'rgba(12,12,16,0.9)',
  },
  createTitle: { color: '#e8d48b', fontSize: 13, fontWeight: 600, marginBottom: 6, letterSpacing: 1 },
  createHelp: { color: '#8a8376', fontSize: 12, lineHeight: 1.6, marginBottom: 12 },
  marketBox: {
    border: '1px solid rgba(212,175,55,0.28)',
    borderRadius: 14,
    padding: 14,
    background: 'rgba(212,175,55,0.04)',
    marginBottom: 4,
  },
  marketHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  marketTitle: { margin: 0, fontSize: 16, color: '#d4af37', letterSpacing: 1 },
  marketCount: { fontSize: 12, color: '#8a8376' },
  emptyMarket: {
    color: '#9a9488',
    fontSize: 13,
    lineHeight: 1.7,
    padding: '16px 14px',
    background: '#0a0a10',
    borderRadius: 10,
  },
  emptyTitle: { color: '#cfc6b8', fontSize: 14, fontWeight: 600, marginBottom: 6 },
  row: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  choiceRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  choiceBtn: {
    background: '#0d0d12',
    color: '#cfc6b8',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 12,
  },
  choiceOn: {
    background: 'rgba(212,175,55,0.16)',
    color: '#e8d48b',
    border: '1px solid rgba(212,175,55,0.55)',
  },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#9a9488', flex: 1, minWidth: 90 },
  input: {
    background: '#0d0d12',
    border: '1px solid rgba(212,175,55,0.28)',
    color: '#f4efe4',
    padding: '10px 12px',
    borderRadius: 8,
  },
  textarea: {
    background: '#0d0d12',
    border: '1px solid rgba(212,175,55,0.28)',
    color: '#f4efe4',
    padding: '10px 12px',
    borderRadius: 8,
    resize: 'vertical',
    minHeight: 64,
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  cardStatement: {
    color: '#e8d48b',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.45,
    marginTop: 8,
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  ctaBtn: {
    background: 'linear-gradient(90deg, #d4af37, #b8922a)',
    color: '#111',
    border: 'none',
    padding: '11px 18px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    minWidth: 132,
  },
  fadeBetRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 8,
    width: '100%',
  },
  fadeBetCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  fadeAgainHint: {
    color: '#9bb6ff',
    fontSize: 12,
    lineHeight: 1.4,
  },
  fadeAmountLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 96,
    flex: '0 0 auto',
  },
  fadeAmountHint: {
    color: '#8a8376',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  fadeAmountInput: {
    width: 104,
    padding: '10px 12px',
    fontWeight: 600,
    background: '#0d0d12',
    border: '1px solid rgba(212,175,55,0.28)',
    color: '#f4efe4',
    borderRadius: 8,
  },
  fadeBtn: {
    background: 'linear-gradient(90deg, #5b7cff, #3d5bd6)',
    color: '#f4efe4',
    border: 'none',
    padding: '11px 18px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    minWidth: 132,
  },
  btn: {
    background: 'transparent',
    color: '#f4efe4',
    border: '1px solid rgba(212,175,55,0.35)',
    padding: '9px 12px',
    borderRadius: 8,
  },
  dangerBtn: {
    background: 'transparent',
    color: '#ff8a8a',
    border: '1px solid rgba(255,77,77,0.5)',
    padding: '9px 12px',
    borderRadius: 8,
  },
  dangerCta: {
    background: 'rgba(255,77,77,0.16)',
    color: '#ffb4b4',
    border: '1px solid rgba(255,77,77,0.55)',
    padding: '11px 18px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
  },
  vowList: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 },
  card: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    background: '#0a0a10',
  },
  cardHot: {
    border: '1px solid rgba(212,175,55,0.45)',
    boxShadow: '0 0 0 1px rgba(212,175,55,0.08)',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardId: { color: '#d4af37', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center' },
  cardProg: { color: '#8a8376', fontSize: 12 },
  betTag: {
    display: 'inline-block',
    marginTop: 8,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(212,175,55,0.14)',
    color: '#e8d48b',
    fontSize: 11,
    fontWeight: 600,
  },
  cardBody: { color: '#cfc6b8', fontSize: 12, lineHeight: 1.6, marginTop: 8 },
  cardBodyMuted: { color: '#6e685c', fontSize: 11, lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' },
  cardActions: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  doneTag: { color: '#8a8376', fontSize: 12, alignSelf: 'center' },
  closedBox: {
    marginTop: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '10px 12px',
  },
  closedSum: { color: '#8a8376', fontSize: 13, fontWeight: 600 },
  advanced: {
    marginTop: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '8px 12px',
    color: '#9a9488',
  },
  advancedSum: { cursor: 'pointer', fontSize: 13, color: '#6e685c' },
  advancedBody: { marginTop: 12 },
  log: {
    marginTop: 16,
    padding: '12px 14px',
    background: '#0a0a10',
    borderRadius: 8,
    color: '#e8d48b',
    fontSize: 13,
    lineHeight: 1.6,
    minHeight: 44,
    wordBreak: 'break-word',
  },
}
