import json, time, urllib.parse, urllib.request, subprocess, os

BASE = "https://pwabuilder-cloudapk.azurewebsites.net"
HOST = "sudan-online-store-eta.vercel.app"

APPS = [
    dict(key="merchant", name="سند كاشير ونقاط البيع", launcher="كاشير سند",
         pkg="sd.sanad.merchant", app="merchant", manifest="manifest-merchant.json",
         theme="#0ea5e9", bg="#020617"),
    dict(key="admin", name="إدارة سند المركزية", launcher="إدارة سند",
         pkg="sd.sanad.admin", app="super_admin", manifest="manifest-admin.json",
         theme="#0f172a", bg="#0f172a"),
    dict(key="client", name="سند — متجر وسوق", launcher="متجر سند",
         pkg="sd.sanad.client", app="client", manifest="manifest-client.json",
         theme="#0ea5e9", bg="#f8fafc"),
]


def req(url, data=None, headers=None, raw=False):
    r = urllib.request.Request(url, data=data, headers=headers or {})
    with urllib.request.urlopen(r, timeout=180) as fh:
        return fh.read() if raw else json.loads(fh.read().decode())


for a in APPS:
    url = f"https://{HOST}/?app={a['app']}"
    payload = {
        "additionalTrustedOrigins": [], "appVersion": "1.0.0.0", "appVersionCode": 1,
        "backgroundColor": a["bg"], "display": "standalone",
        "enableSiteSettingsShortcut": True, "enableNotifications": False,
        "includeSourceCode": False, "fallbackType": "customtabs",
        "features": {"locationDelegation": {"enabled": False}, "playBilling": {"enabled": False}},
        "host": HOST,
        "iconUrl": f"https://{HOST}/icons/sanad-icon-512.png",
        "maskableIconUrl": f"https://{HOST}/icons/sanad-maskable-512.png",
        "launcherName": a["launcher"], "name": a["name"],
        "navigationColor": a["theme"], "navigationColorDark": a["theme"],
        "navigationDividerColor": a["theme"], "navigationDividerColorDark": a["theme"],
        "orientation": "default", "packageId": a["pkg"], "pwaUrl": url, "shortcuts": [],
        "signingMode": "new",
        "signing": {"file": None, "alias": "sanad", "fullName": "Sanad Store",
                    "organization": "Sanad", "organizationalUnit": "Apps",
                    "countryCode": "SD", "keyPassword": "sanad2026key",
                    "storePassword": "sanad2026key"},
        "startUrl": url, "themeColor": a["theme"], "splashScreenFadeOutDuration": 300,
        "webManifestUrl": f"https://{HOST}/{a['manifest']}",
    }
    r = req(BASE + "/enqueuePackageJob", json.dumps(payload).encode(),
            {"content-type": "application/json", "platform-identifier": "ServerUI",
             "platform-identifier-version": "1.0.0"})
    jid, tok = r.get("id"), r.get("accessToken")
    print(a["key"], "job", jid, flush=True)
    if not jid:
        raise SystemExit(f"enqueue failed for {a['key']}: {r}")
    for _ in range(45):
        st = req(f"{BASE}/getPackageJob?id={urllib.parse.quote(jid)}",
                 headers={"authorization": f"Bearer {tok}"})
        status = str(st.get("status", ""))
        if status.startswith("Completed"):
            data = req(f"{BASE}/downloadPackageZip?id={jid}",
                       headers={"authorization": f"Bearer {tok}"}, raw=True)
            out = f"/tmp/n_{a['key']}.zip"
            open(out, "wb").write(data)
            print(a["key"], "zip bytes", len(data), flush=True)
            break
        if status.startswith("Failed"):
            raise SystemExit(f"{a['key']} failed: {st.get('errors')}")
        time.sleep(6)
    else:
        raise SystemExit(f"{a['key']} timed out")
print("all done")
