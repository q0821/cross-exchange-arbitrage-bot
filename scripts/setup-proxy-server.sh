#!/bin/bash
# ============================================================================
# HTTP Proxy 伺服器一鍵安裝腳本
#
# 用途：在 VPS 上快速建立 HTTP Proxy 供交易機器人使用
# 支援：Ubuntu 20.04+, Debian 11+
#
# 使用方式：
#   1. 在 VPS 上執行此腳本
#   2. 將輸出的 PROXY_URL 設定到 .env 檔案
#   3. 在交易所 API Key 設定中加入 VPS 的 IP 到白名單
#
# 執行指令：
#   curl -sSL https://raw.githubusercontent.com/your-repo/setup-proxy-server.sh | bash
#   或
#   bash setup-proxy-server.sh
# ============================================================================

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   HTTP Proxy 伺服器安裝腳本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 檢查是否為 root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}請使用 root 權限執行此腳本${NC}"
  echo "執行: sudo bash setup-proxy-server.sh"
  exit 1
fi

# 生成隨機密碼
PROXY_USER="proxyuser"
PROXY_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
PROXY_PORT=18888

# 取得伺服器 IP
SERVER_IP=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me || echo "YOUR_SERVER_IP")

echo -e "${YELLOW}[1/5] 更新系統套件...${NC}"
apt update -qq

echo -e "${YELLOW}[2/5] 安裝 tinyproxy...${NC}"
apt install -y tinyproxy apache2-utils > /dev/null

echo -e "${YELLOW}[3/5] 設定 tinyproxy...${NC}"

# 備份原始設定
cp /etc/tinyproxy/tinyproxy.conf /etc/tinyproxy/tinyproxy.conf.bak

# 建立新設定
cat > /etc/tinyproxy/tinyproxy.conf << EOF
# Tinyproxy 設定檔
# 為交易機器人優化

# 監聽埠號
Port ${PROXY_PORT}

# 監聽所有介面
Listen 0.0.0.0

# 允許所有來源（透過 BasicAuth 保護）
Allow 0.0.0.0/0

# 基本認證
BasicAuth ${PROXY_USER} ${PROXY_PASS}

# 超時設定（秒）
Timeout 600
ConnectPort 443
ConnectPort 80

# 日誌設定
LogFile "/var/log/tinyproxy/tinyproxy.log"
LogLevel Info

# 最大連線數
MaxClients 100

# 緩衝區大小
MinSpareServers 5
MaxSpareServers 20
StartServers 10

# 隱藏代理資訊
DisableViaHeader Yes
EOF

echo -e "${YELLOW}[4/5] 設定防火牆...${NC}"

# 檢查並設定 UFW
if command -v ufw &> /dev/null; then
  ufw allow ${PROXY_PORT}/tcp > /dev/null 2>&1 || true
  echo "UFW 規則已新增"
fi

# 檢查並設定 firewalld
if command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-port=${PROXY_PORT}/tcp > /dev/null 2>&1 || true
  firewall-cmd --reload > /dev/null 2>&1 || true
  echo "Firewalld 規則已新增"
fi

echo -e "${YELLOW}[5/5] 啟動 tinyproxy 服務...${NC}"
systemctl restart tinyproxy
systemctl enable tinyproxy > /dev/null 2>&1

# 等待服務啟動
sleep 2

# 檢查服務狀態
if systemctl is-active --quiet tinyproxy; then
  echo -e "${GREEN}tinyproxy 服務啟動成功！${NC}"
else
  echo -e "${RED}tinyproxy 服務啟動失敗，請檢查日誌：${NC}"
  echo "journalctl -u tinyproxy -n 20"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   安裝完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "伺服器 IP:  ${YELLOW}${SERVER_IP}${NC}"
echo -e "Proxy 埠號: ${YELLOW}${PROXY_PORT}${NC}"
echo -e "使用者名稱: ${YELLOW}${PROXY_USER}${NC}"
echo -e "密碼:       ${YELLOW}${PROXY_PASS}${NC}"
echo ""
echo -e "${GREEN}請將以下設定加入 .env 檔案：${NC}"
echo ""
echo -e "${YELLOW}PROXY_URL=http://${PROXY_USER}:${PROXY_PASS}@${SERVER_IP}:${PROXY_PORT}${NC}"
echo ""
echo -e "${GREEN}重要：請在交易所 API Key 設定中將以下 IP 加入白名單：${NC}"
echo -e "${YELLOW}${SERVER_IP}${NC}"
echo ""
echo -e "${GREEN}測試指令：${NC}"
echo -e "curl -x http://${PROXY_USER}:${PROXY_PASS}@${SERVER_IP}:${PROXY_PORT} https://api.ipify.org"
echo ""
echo -e "${GREEN}========================================${NC}"
