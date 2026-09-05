import { ethers } from 'ethers'

/** @typedef {{ id: string, chainId: number, name: string, rpcUrl: string, yan: string, protocol: string, explorer: string, currency: string, demoMode: boolean, epochSeconds: number }} NetworkProfile */

/** 测网地址只来自 env；空字符串表示尚未部署（勿写死旧合约） */
const MONAD_YAN = (import.meta.env.VITE_YAN_ADDRESS || '').trim()
const MONAD_PROTOCOL = (import.meta.env.VITE_PROTOCOL_ADDRESS || '').trim()

/** Hardhat 默认首两次部署地址；本地 start-demo 后若不同，以 local-deploy.json / VITE_LOCAL_* 为准 */
import localFromFile from '../local-deploy.json'

const DEFAULT_LOCAL_YAN = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const DEFAULT_LOCAL_PROTOCOL = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'

/** @type {Record<string, NetworkProfile>} */
export const NETWORKS = {
  monad: {
    id: 'monad',
    chainId: 10143,
    name: 'Monad Testnet',
    // Prefer official public RPC; Ankr often returns 413 on large batches.
    rpcUrl:
      import.meta.env.VITE_RPC_URL?.includes('testnet-rpc.monad')
        ? import.meta.env.VITE_RPC_URL
        : 'https://testnet-rpc.monad.xyz/',
    yan: MONAD_YAN,
    protocol: MONAD_PROTOCOL,
    explorer: 'https://testnet.monadexplorer.com',
    currency: 'MON',
    demoMode: true,
    epochSeconds: parseInt(import.meta.env.VITE_EPOCH_SECONDS || '60', 10),
  },
  local: {
    id: 'local',
    chainId: 31337,
    name: '本地链',
    rpcUrl: 'http://127.0.0.1:8545',
    yan:
      import.meta.env.VITE_LOCAL_YAN_ADDRESS ||
      localFromFile.yan ||
      DEFAULT_LOCAL_YAN,
    protocol:
      import.meta.env.VITE_LOCAL_PROTOCOL_ADDRESS ||
      localFromFile.protocol ||
      DEFAULT_LOCAL_PROTOCOL,
    explorer: '',
    currency: 'ETH',
    demoMode: true,
    epochSeconds: parseInt(import.meta.env.VITE_LOCAL_EPOCH_SECONDS || '60', 10),
  },
}

export const NETWORK_OPTIONS = [NETWORKS.monad, NETWORKS.local]

const NETWORK_STORAGE_KEY = 'yan-active-network'

function defaultNetworkId() {
  const envId = parseInt(import.meta.env.VITE_CHAIN_ID || '10143', 10)
  return envId === 31337 ? 'local' : 'monad'
}

/**
 * Blitz / production default: always open on Monad Testnet so the UI loads
 * live testnet vows. Local is only used after an explicit user switch
 * (or when VITE_CHAIN_ID=31337).
 */
function readStoredNetworkId() {
  const fallback = defaultNetworkId()
  if (fallback === 'monad') {
    try {
      localStorage.setItem(NETWORK_STORAGE_KEY, 'monad')
    } catch {
      // ignore
    }
    return 'monad'
  }
  try {
    const v = localStorage.getItem(NETWORK_STORAGE_KEY)
    if (v && NETWORKS[v]) return v
  } catch {
    // ignore
  }
  return fallback
}

let _activeId = typeof window !== 'undefined' ? readStoredNetworkId() : defaultNetworkId()
const _listeners = new Set()

export function getActiveNetworkId() {
  return _activeId
}

export function getActiveNetwork() {
  return NETWORKS[_activeId] || NETWORKS.monad
}

export function setActiveNetwork(id) {
  if (!NETWORKS[id]) throw new Error(`未知网络：${id}`)
  if (_activeId === id) return getActiveNetwork()
  _activeId = id
  try {
    localStorage.setItem(NETWORK_STORAGE_KEY, id)
  } catch {
    // ignore
  }
  const net = getActiveNetwork()
  _listeners.forEach((fn) => {
    try {
      fn(net)
    } catch {
      // ignore
    }
  })
  return net
}

export function subscribeNetwork(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/** 兼容旧代码：以下为「当前活跃网络」的快照式访问器（每次读取最新） */
export function getChainId() {
  return getActiveNetwork().chainId
}
export function getRpcUrl() {
  return getActiveNetwork().rpcUrl
}
export function getYanAddress() {
  return getActiveNetwork().yan
}
export function getProtocolAddress() {
  return getActiveNetwork().protocol
}
export function getExplorerUrl() {
  return getActiveNetwork().explorer
}
export function getNetworkName() {
  return getActiveNetwork().name
}
export function isLocalNetwork() {
  return getActiveNetwork().chainId === 31337
}

/** @deprecated 请优先用 getActiveNetwork()；保留名称以免大面积改 import */
export const CHAIN_ID = NETWORKS[defaultNetworkId()].chainId
export const RPC_URL = NETWORKS[defaultNetworkId()].rpcUrl
export const YAN_ADDRESS = NETWORKS[defaultNetworkId()].yan
export const PROTOCOL_ADDRESS = NETWORKS[defaultNetworkId()].protocol
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false'
export const EPOCH_SECONDS = NETWORKS[defaultNetworkId()].epochSeconds
export const EXPLORER_URL = NETWORKS[defaultNetworkId()].explorer
export const NETWORK_NAME = NETWORKS[defaultNetworkId()].name
export const IS_LOCAL = NETWORKS[defaultNetworkId()].chainId === 31337
export const NETWORK_CURRENCY = NETWORKS[defaultNetworkId()].currency

export const FAUCET_URL = 'https://faucet.monad.xyz/'

export const STATUS = ['空', '待担保', '履约中', '已守诺', '已食言']
export const KIND_LABEL = ['每日报到', '到期验收']
export const VERIFY_LABEL = ['无需证据', '需要证据', '链上还款']

export function hashEvidence(text) {
  const t = String(text || '').trim()
  if (!t) return ethers.ZeroHash
  return ethers.id(t)
}

const EVIDENCE_PREVIEW_KEY = 'yan-evidence-previews'
export const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024

export function emptyEvidenceDraft() {
  return { text: '', hash: '', preview: '', fileName: '' }
}

export function normalizeEvidenceDraft(draft) {
  if (!draft) return emptyEvidenceDraft()
  if (typeof draft === 'string') return { ...emptyEvidenceDraft(), text: draft }
  return { ...emptyEvidenceDraft(), ...draft }
}

export function resolveEvidenceHash(draft) {
  const d = normalizeEvidenceDraft(draft)
  if (d.hash && d.hash !== ethers.ZeroHash) return d.hash
  return hashEvidence(d.text)
}

export async function hashFile(file) {
  if (!file) return ethers.ZeroHash
  const buf = await file.arrayBuffer()
  return ethers.keccak256(new Uint8Array(buf))
}

export async function fileToPreview(file, maxEdge = 720) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取图片'))
    }
    img.src = url
  })
}

function readPreviewMap() {
  try {
    return JSON.parse(localStorage.getItem(EVIDENCE_PREVIEW_KEY) || '{}')
  } catch {
    return {}
  }
}

export function cacheEvidencePreview(hash, dataUrl) {
  const key = String(hash || '').toLowerCase()
  if (!key || key === ethers.ZeroHash.toLowerCase() || !dataUrl) return
  try {
    const map = readPreviewMap()
    map[key] = dataUrl
    const keys = Object.keys(map)
    if (keys.length > 24) {
      keys.slice(0, keys.length - 24).forEach((k) => {
        delete map[k]
      })
    }
    localStorage.setItem(EVIDENCE_PREVIEW_KEY, JSON.stringify(map))
  } catch {
    try {
      localStorage.setItem(EVIDENCE_PREVIEW_KEY, JSON.stringify({ [key]: dataUrl }))
    } catch {
      // quota
    }
  }
}

export function getEvidencePreview(hash) {
  try {
    const map = readPreviewMap()
    return map[String(hash || '').toLowerCase()] || ''
  } catch {
    return ''
  }
}

export function shortHash(h) {
  if (!h || h === ethers.ZeroHash) return '—'
  return `${String(h).slice(0, 10)}…`
}

export function getInjectedProvider() {
  if (typeof window === 'undefined') return null
  if (window.ethereum?.providers?.length) {
    return window.ethereum.providers.find((p) => p.isMetaMask) || window.ethereum.providers[0]
  }
  return window.ethereum || null
}

export async function readMetaMaskSession() {
  const injected = getInjectedProvider()
  if (!injected) return { address: '', chainId: null }
  const accounts = await injected.request({ method: 'eth_accounts' })
  const chainHex = await injected.request({ method: 'eth_chainId' })
  return {
    address: accounts?.[0] || '',
    chainId: chainHex ? parseInt(chainHex, 16) : null,
  }
}

/** MetaMask 图标：金色底 +「言」。用 data URI，避免依赖外部图片。 */
const YAN_TOKEN_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" rx="56" fill="#111118"/>
      <rect x="12" y="12" width="232" height="232" rx="48" fill="none" stroke="#d4af37" stroke-width="10"/>
      <text x="128" y="168" text-anchor="middle" font-family="serif" font-size="128" fill="#d4af37">言</text>
    </svg>`,
  )

/**
 * 向 MetaMask 推荐添加 YAN。
 * 先切到本应用当前网络，再读链上 symbol。
 */
export async function watchYanToken() {
  const injected = getInjectedProvider()
  if (!injected) throw new Error('未检测到 MetaMask')
  const net = getActiveNetwork()
  if (!net.yan) throw new Error('未配置言币地址')

  await switchToAppNetwork()

  const session = await readMetaMaskSession()
  if (session.chainId !== net.chainId) {
    throw new Error(`请先把 MetaMask 切到 ${net.name}（Chain ID ${net.chainId}），再添加 YAN`)
  }

  const onChain = new ethers.Contract(
    net.yan,
    [
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function decimals() view returns (uint8)',
    ],
    getRpcProvider(),
  )
  let symbol
  let decimals = 18
  try {
    symbol = await onChain.symbol()
    decimals = Number(await onChain.decimals())
  } catch {
    throw new Error('当前网络读不到言币合约。请确认已切换到正确网络，且合约已部署。')
  }
  if (symbol !== 'YAN') {
    throw new Error(
      `链上代币符号是「${symbol}」，不是 YAN。地址 ${net.yan} 在当前链上不是言币。`,
    )
  }

  const ok = await injected.request({
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {
        address: net.yan,
        symbol: 'YAN',
        decimals,
        image: YAN_TOKEN_IMAGE,
      },
    },
  })
  return ok
}

export async function switchToAppNetwork() {
  const injected = getInjectedProvider()
  if (!injected) throw new Error('未检测到 MetaMask')
  const net = getActiveNetwork()
  const hexId = '0x' + net.chainId.toString(16)

  try {
    await injected.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexId }],
    })
    return
  } catch (err) {
    if (err?.code !== 4902) throw err
  }

  if (net.chainId === 10143) {
    await injected.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexId,
          chainName: 'Monad Testnet',
          nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
          rpcUrls: [net.rpcUrl || 'https://testnet-rpc.monad.xyz/'],
          blockExplorerUrls: [net.explorer || 'https://testnet.monadexplorer.com/'],
        },
      ],
    })
    return
  }

  if (net.chainId === 31337) {
    await injected.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexId,
          chainName: 'Hardhat Local',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: [net.rpcUrl || 'http://127.0.0.1:8545'],
        },
      ],
    })
    return
  }

  throw new Error(`请在 MetaMask 手动添加 Chain ID ${net.chainId}`)
}

/** 本地演示用的多个钱包，不是「身份职业」 */
export const DEMO_WALLETS = [
  {
    id: 'w1',
    name: '钱包 A',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
  {
    id: 'w2',
    name: '钱包 B',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
  {
    id: 'w3',
    name: '钱包 C',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  },
  {
    id: 'w4',
    name: '钱包 D',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
]

// 兼容旧引用
export const DEMO_ROLES = DEMO_WALLETS

const YAN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function claim() external',
  'function hasClaimed(address) view returns (bool)',
]

const PROTOCOL_ABI = [
  'function createVow(uint256 daysRequired, uint256 stake, string statement) returns (uint256)',
  'function createVowEx(uint256 duration,uint256 stake,uint8 kind,uint8 verifyMode,address referee,address payee,uint256 payAmount,string statement) returns (uint256)',
  'function cancelVow(uint256 id)',
  'function guarantee(uint256 id, uint256 stake)',
  'function fade(uint256 id, uint256 amount)',
  'function checkIn(uint256 id)',
  'function checkInWithProof(uint256 id, bytes32 evidenceHash)',
  'function submitEvidence(uint256 id, bytes32 evidenceHash)',
  'function fulfillPay(uint256 id)',
  'function claimKept(uint256 id)',
  'function refereeResolve(uint256 id, bool kept)',
  'function missSettle(uint256 id)',
  'function setSessionKey(address key)',
  'function sessionKey(address user) view returns (address)',
  'function pulse() returns (uint256)',
  'function pulseAt(uint256 tag) returns (uint256)',
  'function pulseCountOf(address user) view returns (uint256)',
  'function pulseStamp(address user, uint256 tag) view returns (uint256)',
  'function demoWarp(uint256 secs)',
  'function demoWarpRounds(uint256 rounds)',
  'function demoMode() view returns (bool)',
  'function EPOCH() view returns (uint256)',
  'function vowCount() view returns (uint256)',
  'function currentEpoch() view returns (uint256)',
  'function isPastDue(uint256 id) view returns (bool)',
  'function minStakeOf(address user) view returns (uint256)',
  'function owner() view returns (address)',
  'function actorCount() view returns (uint256)',
  'function actors(uint256) view returns (address)',
  'function getVow(uint256 id) view returns (tuple(address maker,address guarantor,uint256 stakeMaker,uint256 stakeGuarantor,uint256 daysRequired,uint256 daysChecked,uint256 lastCheckEpoch,uint256 fadePool,uint8 status))',
  'function getRules(uint256 id) view returns (tuple(uint8 kind,uint8 verifyMode,address referee,address payee,uint256 payAmount,uint256 paidAmount,uint256 deadlineEpoch,uint256 evidenceCount))',
  'function getEvidence(uint256 id, uint256 index) view returns (bytes32)',
  'function statements(uint256 id) view returns (string)',
  'function getFades(uint256 id) view returns (tuple(address better,uint256 amount,bool paid)[])',
  'event VowCreated(uint256 indexed id, address indexed maker, uint256 stake, uint256 daysRequired, string statement)',
  'event Guaranteed(uint256 indexed id, address indexed guarantor, uint256 stake)',
  'event Faded(uint256 indexed id, address indexed better, uint256 amount)',
  'event VowKept(uint256 indexed id, uint256 bonus)',
  'event VowBroken(uint256 indexed id, uint256 prize)',
]

const SESSION_STORAGE_PREFIX = 'yan-session-key:'

/** Create or reuse a local session key for gasless-style check-ins. */
export function loadOrCreateSessionWallet(ownerAddress) {
  if (!ownerAddress || typeof localStorage === 'undefined') return null
  const key = SESSION_STORAGE_PREFIX + ownerAddress.toLowerCase()
  let pk = localStorage.getItem(key)
  if (!pk) {
    pk = ethers.Wallet.createRandom().privateKey
    localStorage.setItem(key, pk)
  }
  return new ethers.Wallet(pk, getRpcProvider())
}

/** Local Hardhat only: give the session key gas so check-in works without MetaMask. */
export async function fundSessionOnLocal(session) {
  if (!isLocalNetwork() || !session) return
  const provider = getRpcProvider()
  await provider.send('hardhat_setBalance', [
    session.address,
    '0x8AC7230489E80000', // 10 ETH
  ])
}

export function formatError(e) {
  const msg = e?.shortMessage || e?.reason || e?.message || String(e)
  const net = getActiveNetwork()
  if (net.explorer && net.protocol) {
    return `${msg} · 合约 ${net.explorer}/address/${net.protocol}`
  }
  return msg
}

export function shortAddr(addr) {
  if (!addr || addr === ethers.ZeroAddress) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatYan(value) {
  const n = Number(ethers.formatEther(value || 0n))
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function txUrl(hash) {
  if (!hash) return ''
  const explorer = getExplorerUrl()
  if (explorer) return `${explorer}/tx/${hash}`
  return `https://testnet.monadexplorer.com/tx/${hash}`
}

export function getRpcProvider() {
  const net = getActiveNetwork()
  // Ankr (and some public RPCs) reject large JSON-RPC batches with 413 /
  // "Batch size too large". Disable batching so Promise.all eth_calls stay safe.
  return new ethers.JsonRpcProvider(net.rpcUrl, net.chainId, {
    batchMaxCount: 1,
    staticNetwork: ethers.Network.from(net.chainId),
  })
}

export async function walletFromId(walletId) {
  const w = DEMO_WALLETS.find((x) => x.id === walletId)
  if (!w) throw new Error('未知钱包')
  return getRpcProvider().getSigner(w.address)
}

export async function walletFromRole(role) {
  return getRpcProvider().getSigner(role.address)
}

export function yanContract(signerOrProvider) {
  const yan = getYanAddress()
  if (!yan) throw new Error('未配置言币地址，请先部署合约')
  return new ethers.Contract(yan, YAN_ABI, signerOrProvider)
}

export function protocolContract(signerOrProvider) {
  const protocol = getProtocolAddress()
  if (!protocol) throw new Error('未配置协议地址，请先部署合约')
  return new ethers.Contract(protocol, PROTOCOL_ABI, signerOrProvider)
}

export async function ensureAllowance(signer, amount) {
  const yan = yanContract(signer)
  const owner = await signer.getAddress()
  const current = await yan.allowance(owner, getProtocolAddress())
  if (current >= amount) return null
  const tx = await yan.approve(getProtocolAddress(), ethers.MaxUint256)
  const receipt = await tx.wait()
  return receipt
}

const CHAIN_ACTIVITY_EVENTS = ['VowCreated', 'Guaranteed', 'Faded', 'VowKept', 'VowBroken']

function formatLogTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function activityFromLog(log, timestamp) {
  const name = log.fragment?.name || log.eventName
  const id = Number(log.args?.id)
  const hash = log.transactionHash
  const time = formatLogTime(timestamp)
  if (name === 'VowCreated') {
    const statement = log.args.statement ? `「${log.args.statement}」 · ` : ''
    return {
      id: hash,
      label: '发起言约',
      hash,
      detail: `言约 #${id} · ${statement}${formatYan(log.args.stake)} YAN`,
      actor: displayName(log.args.maker),
      time,
      fromChain: true,
    }
  }
  if (name === 'Guaranteed') {
    return {
      id: hash,
      label: '我信他',
      hash,
      detail: `言约 #${id} · ${formatYan(log.args.stake)} YAN`,
      actor: displayName(log.args.guarantor),
      time,
      fromChain: true,
    }
  }
  if (name === 'Faded') {
    return {
      id: hash,
      label: '赌你做不到',
      hash,
      detail: `言约 #${id} · ${formatYan(log.args.amount)} YAN`,
      actor: displayName(log.args.better),
      time,
      fromChain: true,
    }
  }
  if (name === 'VowKept') {
    return {
      id: hash,
      label: '守诺结算',
      hash,
      detail: `言约 #${id}`,
      actor: '',
      time,
      fromChain: true,
    }
  }
  if (name === 'VowBroken') {
    return {
      id: hash,
      label: '食言结算',
      hash,
      detail: `言约 #${id}`,
      actor: '',
      time,
      fromChain: true,
    }
  }
  return null
}

/** Rebuild the activity list from protocol events so a refresh still shows them. */
export async function loadChainActivities(provider) {
  if (!getProtocolAddress()) return []
  const protocol = protocolContract(provider)
  const latest = await provider.getBlockNumber()
  // Narrower window on testnet: full history belongs in an indexer, not every refresh.
  const fromBlock = isLocalNetwork() ? 0 : Math.max(0, latest - 5000)
  const groups = await Promise.all(
    CHAIN_ACTIVITY_EVENTS.map((name) =>
      protocol.queryFilter(protocol.filters[name](), fromBlock, latest).catch(() => []),
    ),
  )
  const logs = groups.flat()
  logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber
    return (a.index ?? 0) - (b.index ?? 0)
  })
  const recent = logs.slice(-30)
  const blockNums = [...new Set(recent.map((log) => log.blockNumber))]
  const times = {}
  await Promise.all(
    blockNums.map(async (n) => {
      const block = await provider.getBlock(n)
      times[n] = Number(block?.timestamp || 0)
    }),
  )
  return recent
    .map((log) => activityFromLog(log, times[log.blockNumber]))
    .filter(Boolean)
    .reverse()
}

export function mergeChainActivities(fromChain, fromSession) {
  const chain = fromChain || []
  const seen = new Set(chain.map((item) => item.hash?.toLowerCase()).filter(Boolean))
  const extra = (fromSession || []).filter((item) => {
    if (item.fromChain) return false
    if (!item.hash) return true
    return !seen.has(item.hash.toLowerCase())
  })
  return [...extra, ...chain].slice(0, 30)
}

async function loadOneVow(protocol, i, epochNow) {
  const [v, fades, statement, rulesPack] = await Promise.all([
    protocol.getVow(i),
    protocol.getFades(i),
    protocol.statements(i).catch(() => ''),
    Promise.all([protocol.getRules(i), protocol.isPastDue(i)]).catch(() => null),
  ])

  let rules = emptyRules()
  let pastDue = false
  let evidences = []

  if (rulesPack) {
    rules = serializeRules(rulesPack[0])
    pastDue = Boolean(rulesPack[1])
    if (rules.evidenceCount > 0) {
      evidences = await Promise.all(
        Array.from({ length: rules.evidenceCount }, (_, j) => protocol.getEvidence(i, j)),
      )
    }
  } else {
    pastDue = epochNow > Number(v.lastCheckEpoch) + 1
  }

  const lastEvidence =
    evidences.length > 0 ? evidences[evidences.length - 1] : ethers.ZeroHash

  return {
    id: i,
    ...serializeVow(v),
    ...rules,
    statement: statement || '',
    pastDue,
    evidences,
    lastEvidence,
    fades: fades.map(serializeFade),
  }
}

export async function loadWorld(provider) {
  const protocol = protocolContract(provider)
  const yan = yanContract(provider)

  const [countBn, epochBn, actorNBn, epochRaw] = await Promise.all([
    protocol.vowCount(),
    protocol.currentEpoch(),
    protocol.actorCount(),
    protocol.EPOCH().catch(() => null),
  ])

  const count = Number(countBn)
  const epochNow = Number(epochBn)
  const actorN = Number(actorNBn)
  const epochLen = epochRaw != null ? Number(epochRaw) : getActiveNetwork().epochSeconds

  // Load vows in small chunks (not one giant parallel fan-out).
  const vows = []
  const CHUNK = 2
  for (let start = 0; start < count; start += CHUNK) {
    const slice = Array.from(
      { length: Math.min(CHUNK, count - start) },
      (_, j) => loadOneVow(protocol, start + j, epochNow),
    )
    vows.push(...(await Promise.all(slice)))
  }

  const actors = []
  for (let i = 0; i < actorN; i++) {
    actors.push(await protocol.actors(i))
  }

  const balances = []
  for (let i = 0; i < actors.length; i += CHUNK) {
    const slice = actors.slice(i, i + CHUNK)
    const part = await Promise.all(slice.map((addr) => yan.balanceOf(addr)))
    balances.push(...part)
  }
  const board = actors.map((address, i) => ({
    address,
    balance: balances[i],
  }))

  return { vows, board, epoch: epochNow, epochLen }
}

function emptyRules() {
  return {
    kind: 0,
    verifyMode: 0,
    referee: ethers.ZeroAddress,
    payee: ethers.ZeroAddress,
    payAmount: 0n,
    paidAmount: 0n,
    deadlineEpoch: 0,
    evidenceCount: 0,
  }
}

function serializeRules(r) {
  return {
    kind: Number(r.kind),
    verifyMode: Number(r.verifyMode),
    referee: r.referee,
    payee: r.payee,
    payAmount: r.payAmount,
    paidAmount: r.paidAmount,
    deadlineEpoch: Number(r.deadlineEpoch),
    evidenceCount: Number(r.evidenceCount),
  }
}

function serializeVow(v) {
  return {
    maker: v.maker,
    guarantor: v.guarantor,
    stakeMaker: v.stakeMaker,
    stakeGuarantor: v.stakeGuarantor,
    daysRequired: Number(v.daysRequired),
    daysChecked: Number(v.daysChecked),
    lastCheckEpoch: Number(v.lastCheckEpoch),
    fadePool: v.fadePool,
    status: Number(v.status),
  }
}

function serializeFade(f) {
  return {
    better: f.better,
    amount: f.amount,
    paid: Boolean(f.paid),
  }
}

export function sameAddr(a, b) {
  if (!a || !b) return false
  try {
    return ethers.getAddress(a) === ethers.getAddress(b)
  } catch {
    return String(a).toLowerCase() === String(b).toLowerCase()
  }
}

export function displayName(addr) {
  if (!addr || addr === ethers.ZeroAddress) return '—'
  const demo = DEMO_WALLETS.find((w) => sameAddr(w.address, addr))
  if (demo) return demo.name
  return shortAddr(addr)
}

export function displayShort(addr) {
  return displayName(addr)
}
