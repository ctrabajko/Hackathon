#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &gt; /dev/null 2&gt;&amp;1 &amp;&amp pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." &amp;&amp pwd)"

cd "${ROOT_DIR}"

ZIP_NAME="doctor-appointment-agent.zip"

echo "Creating ${ZIP_NAME} from ${ROOT_DIR}..."

# Remove existing zip if present
if [ -f "${ZIP_NAME}" ]; then
  rm "${ZIP_NAME}"
fi

zip -r "${ZIP_NAME}" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "*.log" \
  -x "${ZIP_NAME}"

echo "Done. Created ${ZIP_NAME} in ${ROOT_DIR}."