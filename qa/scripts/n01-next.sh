#!/bin/bash
# 사용: n01-next.sh <선택지 번호> : 번호를 보내고 다음 선택지(또는 종료)가 나올 때까지 기다려 내용을 보여준다
cd "$(dirname "$0")/../results"
ID=${2:-M3-N01}
prev=$(grep -o '"n": [0-9]*' $ID-status.json | grep -o '[0-9]*')
echo "$1" > $ID-cmd.txt
for i in $(seq 1 400); do
  sleep 1
  cur=$(grep -o '"n": [0-9]*' $ID-status.json | grep -o '[0-9]*')
  if [ "$cur" != "$prev" ]; then cat $ID-status.json; exit 0; fi
  if [ -f $ID-report.json ]; then echo "REPORT READY"; exit 0; fi
done
echo TIMEOUT
