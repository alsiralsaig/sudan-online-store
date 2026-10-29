"""يضبط server.url/startPath لكل تطبيق حتى يفتح وضعه الصحيح داخل الـWebView."""
import json, sys

key, path = sys.argv[1], sys.argv[2]
START = {
    "merchant": "/?app=merchant",
    "client": "/?app=client",
    "admin": "/?app=super_admin",
}
cfg = json.load(open(path))
cfg["server"] = {"androidScheme": "https", "startPath": START[key]}
json.dump(cfg, open(path, "w"), ensure_ascii=False, indent=2)
print("startPath:", START[key])
