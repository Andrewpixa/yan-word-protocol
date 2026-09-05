# Yan (言) — Word Protocol

**A vow cannot start without a guarantor.**

Chinese guide: [README_CN.md](README_CN.md) · Blitz prep: [BLITZ_PREP.md](BLITZ_PREP.md) · 5-min script: [DEMO_SCRIPT_5MIN.md](DEMO_SCRIPT_5MIN.md)

### Monad Testnet (current)

| Contract | Address |
|---|---|
| YanToken | [`0xCAd6963B2667E01891775fF6EB6cFd716FD39E80`](https://testnet.monadexplorer.com/address/0xCAd6963B2667E01891775fF6EB6cFd716FD39E80) |
| WordProtocol | [`0xB5893C58C2c7DdD554526878b7621Ca1a8035F98`](https://testnet.monadexplorer.com/address/0xB5893C58C2c7DdD554526878b7621Ca1a8035F98) |
| Deployer (owner) | `0x2Bb51761CAba8cCafb04cB91DDAb647de8e92102` |

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 — MetaMask on Monad Testnet → **+ YAN** → claim → vow.  
Demo tip: fund your session key with MON, then session check-in; or hit **burst 8× pulseAt** for confirmation density (not a TPS claim).

**Why Monad:** daily micro-commitments die if confirms are slow.

Public demo:

```bash
cd frontend && npx vercel --prod
```

### Local multi-wallet demo

```bash
bash start-demo.sh
```
