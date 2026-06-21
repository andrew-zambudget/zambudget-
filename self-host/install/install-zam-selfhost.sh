#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
SELF_HOST_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
ANSIBLE_DIR="${SELF_HOST_DIR}/ansible"

echo "Zam! self-host installer prototype"
echo "Target OS: Ubuntu Server LTS or Debian"
echo

if [ ! -f /etc/os-release ]; then
  echo "Cannot identify this Linux distribution. Use Ubuntu Server LTS or Debian for the guided installer."
  exit 1
fi

. /etc/os-release

if [ "${ID:-}" != "ubuntu" ] && [ "${ID:-}" != "debian" ]; then
  echo "Unsupported OS: ${PRETTY_NAME:-unknown}"
  echo "Use Ubuntu Server LTS or Debian for the guided installer."
  exit 1
fi

if [ "${ID:-}" = "ubuntu" ]; then
  case "${VERSION_ID:-}" in
    22.04|24.04|26.04)
      ;;
    *)
      echo "Unsupported Ubuntu version: ${VERSION_ID:-unknown}"
      echo "Supported installer targets: Ubuntu Server 22.04 LTS, 24.04 LTS, 26.04 LTS."
      echo "Use 24.04 LTS first until 26.04 is fully tested for Zam self-host."
      exit 1
      ;;
  esac
fi

if [ "${ID:-}" = "debian" ]; then
  case "${VERSION_ID:-}" in
    12|13)
      ;;
    *)
      echo "Unsupported Debian version: ${VERSION_ID:-unknown}"
      echo "Supported installer targets: Debian 12 and Debian 13."
      exit 1
      ;;
  esac
fi

if [ "$(id -u)" -ne 0 ] && ! command -v sudo >/dev/null 2>&1; then
  echo "This installer needs root or sudo access."
  exit 1
fi

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

echo "Updating apt metadata and installing installer dependencies..."
run_as_root apt-get update

if [ "${ZAM_SKIP_SYSTEM_UPGRADE:-0}" != "1" ]; then
  echo "Applying available package upgrades. Set ZAM_SKIP_SYSTEM_UPGRADE=1 to skip this step."
  run_as_root env DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
fi

run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ansible \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  openssl \
  python3

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Installing Docker Engine from Docker's official apt repository..."
  run_as_root install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /tmp/zam-docker.gpg
  run_as_root rm -f /etc/apt/keyrings/docker.gpg
  run_as_root gpg --dearmor -o /etc/apt/keyrings/docker.gpg /tmp/zam-docker.gpg
  rm -f /tmp/zam-docker.gpg
  run_as_root chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    | run_as_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  run_as_root apt-get update
  run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    containerd.io \
    docker-buildx-plugin \
    docker-ce \
    docker-ce-cli \
    docker-compose-plugin
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required but was not found after installation."
  exit 1
fi

echo
echo "Starting Zam Ansible installer..."
ansible-playbook -i "${ANSIBLE_DIR}/inventory.local" "${ANSIBLE_DIR}/playbook.yml" --connection local
