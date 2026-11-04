"""Submit once, or resume an existing Seedance draft, without copying credentials."""
import argparse
import json
import pathlib
import re
import time
import urllib.error
import urllib.request
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = "https://openrouter.ai/api/v1/"
parser = argparse.ArgumentParser()
parser.add_argument("--env", required=True, type=pathlib.Path)
parser.add_argument("--reference-urls", type=pathlib.Path)
parser.add_argument("--receipt", required=True, type=pathlib.Path)
parser.add_argument("--output", required=True, type=pathlib.Path)
parser.add_argument("--prompt", type=pathlib.Path, default=ROOT / "notes/prompts/sr71-seedance-route-b.txt")
args = parser.parse_args()

key = None
for line in args.env.read_text().splitlines():
    match = re.match(r"^\s*(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.*?)\s*$", line)
    if match:
        key = match[1].strip("\"'")
if not key:
    raise SystemExit("OPENROUTER_API_KEY is missing from the supplied environment file")

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected and urllib.parse.urlsplit(newurl).netloc != "openrouter.ai":
            redirected.remove_header("Authorization")
        return redirected

opener = urllib.request.build_opener(SafeRedirect())

def request(path, body=None, binary=False):
    # Only send the credential to the fixed OpenRouter origin.
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    try:
        with opener.open(req, timeout=120) as response:
            return response.read() if binary else json.load(response)
    except urllib.error.HTTPError as error:
        # Provider errors may contain input URLs; do not echo the raw response.
        raise SystemExit(f"OpenRouter HTTP {error.code}; no automatic resubmission") from None

def receipt(job):
    safe = {name: job[name] for name in ("id", "status", "generation_id", "usage", "error") if name in job}
    safe.update(model="bytedance/seedance-2.5", duration=10, resolution="480p", aspect_ratio="16:9", generate_audio=False)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(safe, indent=2) + "\n")

if args.receipt.exists():
    job = json.loads(args.receipt.read_text())
    print("Resuming existing job:", job["id"], flush=True)
else:
    if args.reference_urls is None:
        raise SystemExit("--reference-urls is required for a new submission")
    urls = json.loads(args.reference_urls.read_text())
    if not 1 <= len(urls) <= 2:
        raise SystemExit("Expected one poster, or poster then storyboard reference URLs")
    payload = {
        "model": "bytedance/seedance-2.5",
        "prompt": args.prompt.read_text(),
        "duration": 10,
        "resolution": "480p",
        "aspect_ratio": "16:9",
        "generate_audio": False,
        "input_references": [{"type": "image_url", "image_url": {"url": url}} for url in urls],
    }
    # Never retry a POST automatically: an ambiguous response could already be billed.
    job = request("videos", payload)
    receipt(job)
    print("Submitted:", job["id"], "status:", job["status"], flush=True)

for attempt in range(60):
    job = request("videos/" + job["id"])
    receipt(job)
    print("Status:", job["status"], flush=True)
    if job["status"] == "completed":
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(request("videos/" + job["id"] + "/content?index=0", binary=True))
        print("Saved:", str(args.output), "bytes:", args.output.stat().st_size, "usage:", job.get("usage"), flush=True)
        break
    if job["status"] in ("failed", "cancelled", "expired"):
        raise SystemExit("Generation ended: " + job["status"])
    time.sleep(30)
else:
    raise SystemExit("Polling window ended; resume using the same receipt to avoid a duplicate charge")
