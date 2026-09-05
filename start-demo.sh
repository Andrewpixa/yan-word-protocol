#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.anvil"
mkdir -p "$LOG_DIR"

if ! command -v npx >/dev/null 2>&1; then
  echo "需要 Node.js / npx"
  exit 1
fi

if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "安装 backend 依赖…"
  (cd "$ROOT/backend" && npm install)
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "安装 frontend 依赖…"
  (cd "$ROOT/frontend" && npm install)
fi

if lsof -iTCP:8545 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "8545 已有节点在跑，跳过启动。"
else
  echo "启动本地 Hardhat 节点…"
  (cd "$ROOT/backend" && npx hardhat node --hostname 127.0.0.1 --port 8545 > "$LOG_DIR/node.log" 2>&1) &
  for i in $(seq 1 40); do
    if lsof -iTCP:8545 -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

echo "部署合约…"
(cd "$ROOT/backend" && npx hardhat run scripts/deploy.js --network local)

echo "启动前端 http://localhost:3000"
cd "$ROOT/frontend"
npm run dev
