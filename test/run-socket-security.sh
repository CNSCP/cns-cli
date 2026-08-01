#!/bin/bash
# Boot a throwaway local realm using THIS checkout of cns-cli, then run the
# Stage 1 socket-fence regression test against it. Self-contained: etcd +
# cns-cli (dashboard) + cns-orchestrator. Requires: etcd/etcdctl on PATH or in
# $ETCD_DIR, and a cns-orchestrator checkout at $ORCH_DIR.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ETCD="${ETCD_DIR:-/tmp}/etcd"
ORCH="${ORCH_DIR:-/tmp/cnsx/cns-orchestrator}"
RUN=/tmp/realm

rm -rf "$RUN"; mkdir -p "$RUN"
"$ETCD" --name r0 --listen-client-urls http://127.0.0.1:2379 \
  --advertise-client-urls http://127.0.0.1:2379 --listen-peer-urls http://127.0.0.1:2380 \
  --initial-advertise-peer-urls http://127.0.0.1:2380 --initial-cluster r0=http://127.0.0.1:2380 \
  --data-dir "$RUN/etcd-data" > "$RUN/etcd.log" 2>&1 &
ETCD_PID=$!
sleep 4

export CNS_HOST=127.0.0.1 CNS_PORT=2379 CNS_USERNAME='' CNS_PASSWORD=''
( cd "$HERE" && node index.js "dashboard 8080" > "$RUN/cli.log" 2>&1 & echo $! > "$RUN/cli.pid" )
( cd "$ORCH" && node index.js > "$RUN/orch.log" 2>&1 & echo $! > "$RUN/orch.pid" )
sleep 5

set +e
node "$HERE/test/socket-security.mjs"
RC=$?
set -e

kill "$ETCD_PID" "$(cat "$RUN/cli.pid")" "$(cat "$RUN/orch.pid")" 2>/dev/null
exit $RC
