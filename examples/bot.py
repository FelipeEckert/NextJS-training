"""Moving-average example bot for the paper-trading API.

Run it once:
    API_KEY=... python examples/bot.py

Optional environment variables:
    BASE_URL  API host (default: the deployed app)
    PAIR      currency pair, case-insensitive (default: USD-BRL)

It buys R$ 1000.00 when the 5-day average of daily closes is above the 20-day
average and the wallet holds no position, and sells everything when the reverse
holds. Standard library only.
"""

import json
import os
import sys
import urllib.error
import urllib.request
import uuid

BASE_URL = os.environ.get("BASE_URL", "https://next-js-training-ten-gamma.vercel.app")
PAIR = os.environ.get("PAIR", "USD-BRL").upper()
API_KEY = os.environ.get("API_KEY", "")


def call(method, path, body=None, headers=None):
    """Send one request and return the parsed "data" field, or exit with the API's error."""
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE_URL + path, data=data, method=method)
    request.add_header("Authorization", f"Bearer {API_KEY}")
    if body is not None:
        request.add_header("Content-Type", "application/json")
    for name, value in (headers or {}).items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)["data"]
    except urllib.error.HTTPError as error:
        raw = error.read().decode(errors="replace")
        try:
            detail = json.loads(raw)["error"]
            print(f"{error.code} {detail['code']}: {detail['message']}", file=sys.stderr)
        except (ValueError, KeyError, TypeError):
            print(f"{error.code} {raw}", file=sys.stderr)
        sys.exit(1)


def main():
    if not API_KEY:
        sys.exit("Set API_KEY to a key from /settings/api-keys.")

    # History is oldest first, so the newest closes are at the end of the list
    closes = [point["close"] for point in call("GET", f"/api/v1/history/{PAIR}")]
    if len(closes) < 20:
        sys.exit(f"Need at least 20 daily closes, got {len(closes)}.")
    short = sum(closes[-5:]) / 5
    long = sum(closes[-20:]) / 20

    wallet = call("GET", "/api/v1/wallet")
    holding = any(position["pair"].upper() == PAIR for position in wallet["positions"])

    if short > long and not holding:
        order = {"pair": PAIR, "side": "buy", "brl": "1000.00"}
    elif short < long and holding:
        order = {"pair": PAIR, "side": "sell", "quantity": "all"}
    else:
        print(f"Holding steady (5-day {short:.4f}, 20-day {long:.4f}).")
        return

    # A fresh key per run, so this order can't be replayed by accident
    trade = call("POST", "/api/v1/orders", order, {"Idempotency-Key": str(uuid.uuid4())})
    print(f"{trade['side']} {trade['quantity']} {trade['pair']} at {trade['price']}, total {trade['total']}")


if __name__ == "__main__":
    main()
