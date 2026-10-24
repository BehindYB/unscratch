import urllib.request
import re
import json
import os
import html as html_lib
from concurrent.futures import ThreadPoolExecutor, as_completed

workspace = os.path.dirname(os.path.abspath(__file__))

EXPLICIT_PRICES = {
    "fortuna-in-tasca": 0.5,
    "ping-pong": 0.5,
    "la-grande-occasione": 15.0,
    "super-gold": 25.0,
    "milioni-di-diamanti": 25.0,
    "-e2-82-ac50-e2-82-ac100": 10.0,
}

CLEAN_NAMES = {
    "-e2-82-ac50-e2-82-ac100": "50€ & 100€",
    "buond-c3-ac": "Buondì",
    "casin%c3%b2-ricco": "Casinò Ricco",
    "color-puzzle-10%e2%82%ac": "Color Puzzle 10€",
    "color-puzzle-5-e2-82-ac": "Color Puzzle 5€",
    "pop-5-e2-82-ac": "POP 5€",
    "-tombola-classic-": "Tombola Classic",
    "-tombola-mini-": "Tombola Mini",
    "-tombola-super-": "Tombola Super",
}

def parse_it_num(s):
    s = re.sub(r'[^\d\.,]', '', s).strip()
    if not s:
        return 0.0
    return float(s.replace('.', '').replace(',', '.'))

def norm_name(s):
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    return s

def fetch_all_sources():
    items = []
    seen_urls = set()

    # 1. ADM official active lotteries
    for cur in range(1, 9):
        u = f"https://www.adm.gov.it/portale/monopoli/giochi/lotterie/lotterie_istantanee/lot_ist_attive?p_p_id=com_liferay_asset_publisher_web_portlet_AssetPublisherPortlet_INSTANCE_FwJ7joLIAMG9&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_com_liferay_asset_publisher_web_portlet_AssetPublisherPortlet_INSTANCE_FwJ7joLIAMG9_delta=10&p_r_p_resetCur=false&_com_liferay_asset_publisher_web_portlet_AssetPublisherPortlet_INSTANCE_FwJ7joLIAMG9_cur={cur}"
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            raw = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
            matches = re.findall(r'<a[^>]+href=["\']([^"\']*?/portale/web/guest/-/[^"\']+)["\'][^>]*>(.*?)</a>', raw, re.DOTALL)
            for href, title in matches:
                t = html_lib.unescape(re.sub(r'<[^>]+>', '', title)).strip()
                t = t.replace('“', '').replace('”', '').replace('"', '').replace('', '').strip()
                if not href.startswith("http"):
                    href = "https://www.adm.gov.it" + href
                slug = href.rstrip("/").split("/")[-1].lower()
                if slug in CLEAN_NAMES:
                    t = CLEAN_NAMES[slug]
                if href not in seen_urls and t:
                    seen_urls.add(href)
                    items.append({"id": slug, "name": t, "price": EXPLICIT_PRICES.get(slug), "url": href, "source": "ADM"})
        except Exception:
            pass

    # 2. GrattaeVinci.com master probability page
    try:
        url = "https://www.grattaevinci.com/probabilita-di-vincita"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        raw_html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", errors="ignore")
        tables = re.findall(r'<table.*?</table>', raw_html, re.DOTALL | re.IGNORECASE)
        for tb in tables:
            rows = re.findall(r'<tr.*?</tr>', tb, re.DOTALL | re.IGNORECASE)
            for r in rows:
                cells = [html_lib.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c))).strip() for c in re.findall(r'<t[dh].*?</t[dh]>', r, re.DOTALL | re.IGNORECASE)]
                links = re.findall(r'href=["\']([^"\']+)["\']', r)
                if len(cells) >= 3 and links and "Nome" not in cells[0]:
                    href = links[0]
                    if not href.startswith("http"):
                        href = "https://www.grattaevinci.com" + href
                    slug = href.rstrip("/").split("/")[-1].lower()
                    if slug in ("new-super-sette-e-mezzo", "la-grande-occasione", "lastar"):
                        continue
                    price = parse_it_num(cells[1])
                    if href not in seen_urls and price > 0:
                        seen_urls.add(href)
                        items.append({"id": slug, "name": cells[0], "price": price, "url": href, "source": "GEV"})
    except Exception:
        pass

    return items

def scrape_single_ticket(item):
    try:
        req = urllib.request.Request(item["url"], headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
        tables = re.findall(r'<table.*?</table>', html, re.DOTALL | re.IGNORECASE)
        if not tables:
            return None
        rows = re.findall(r'<tr.*?</tr>', tables[0], re.DOTALL | re.IGNORECASE)

        lotto = None
        raw_tiers = []
        seen_tiers = set()

        for r in rows:
            cells = [html_lib.unescape(re.sub(r'\s+', ' ', re.sub(r'&nbsp;', ' ', re.sub(r'<[^>]+>', '', c)))).strip() for c in re.findall(r'<t[dh].*?</t[dh]>', r, re.DOTALL | re.IGNORECASE)]
            if not cells:
                continue
            header_str = " ".join(cells)
            m = re.search(r'\(\s*n\.\s*([\d\.]+)\s*\)', header_str, re.IGNORECASE)
            if not m:
                m = re.search(r'\(([\d\.]{6,})\)', header_str)
            if m and lotto is None:
                lotto = int(parse_it_num(m.group(1)))
                continue
            if "TOTALI" in cells[0].upper() or "IMPORTO" in cells[0].upper():
                continue
            if len(cells) >= 2:
                p = parse_it_num(cells[0])
                w = int(parse_it_num(cells[1]))
                if p > 0 and w > 0 and (p, w) not in seen_tiers:
                    seen_tiers.add((p, w))
                    raw_tiers.append((p, w))

        if not lotto or not raw_tiers:
            return None

        raw_tiers.sort(key=lambda x: x[0], reverse=True)
        if item["id"] == "milioni-di-diamanti" and raw_tiers[-1][0] == 50.0:
            raw_tiers[-1] = (25.0, raw_tiers[-1][1])
        price = item["price"] if item["price"] else raw_tiers[-1][0]

        tiers = []
        for p, w in raw_tiers:
            tax = max(0.0, (p - 500.0) * 0.20)
            net_p = p - tax
            tiers.append({
                "prize": p,
                "net_prize": round(net_p, 2),
                "tax": round(tax, 2),
                "winners": w,
                "one_in": round(lotto / w, 2),
                "pct": round((w / lotto) * 100, 6),
                "excluded_by_law": (p <= price)
            })

        total_win_any = sum(t["winners"] for t in tiers)
        total_win_even = sum(t["winners"] for t in tiers if t["prize"] <= price)
        total_win_gain = sum(t["winners"] for t in tiers if t["prize"] > price)
        total_loss = lotto - total_win_any

        gross_pool = sum(t["prize"] * t["winners"] for t in tiers)
        net_pool = sum(t["net_prize"] * t["winners"] for t in tiers)
        revenue = lotto * price

        return {
            "id": item["id"],
            "name": item["name"],
            "price": price,
            "url": item["url"],
            "source": item["source"],
            "lotto": lotto,
            "max_prize": tiers[0]["prize"],
            "max_prize_net": tiers[0]["net_prize"],
            "max_prize_one_in": tiers[0]["one_in"],
            "rtp_gross": round((gross_pool / revenue) * 100, 2),
            "rtp_net": round((net_pool / revenue) * 100, 2),
            "ev_gross": round(gross_pool / lotto, 2),
            "ev_net": round(net_pool / lotto, 2),
            "expected_loss_net": round(price - (net_pool / lotto), 2),
            "prob_any_one_in": round(lotto / total_win_any, 2) if total_win_any else 0,
            "prob_gain_one_in": round(lotto / total_win_gain, 2) if total_win_gain else 0,
            "prob_even_one_in": round(lotto / total_win_even, 2) if total_win_even else 0,
            "pct_loss": round((total_loss / lotto) * 100, 2),
            "pct_even": round((total_win_even / lotto) * 100, 2),
            "pct_gain": round((total_win_gain / lotto) * 100, 2),
            "tiers": tiers
        }
    except Exception:
        return None

def fetch_recent_wins():
    try:
        req = urllib.request.Request("https://www.grattaevinci.com/", headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
        links = sorted(set(re.findall(r'href=["\'](/news/vincita-[^"\']+)["\']', html)))
        wins = []
        for l in links:
            slug = l.replace("/news/vincita-gratta-e-vinci-", "").replace("-", " ")
            wins.append({"slug": slug.title(), "url": "https://www.grattaevinci.com" + l})
        return wins
    except Exception:
        return []

if __name__ == "__main__":
    items = fetch_all_sources()
    scraped = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(scrape_single_ticket, it): it for it in items}
        for fut in as_completed(futures):
            res = fut.result()
            if res:
                scraped.append(res)

    scraped.sort(key=lambda x: (0 if x["source"] == "ADM" else 1))
    dedup = {}
    for t in scraped:
        key = (norm_name(t["name"]), t["price"])
        if key not in dedup:
            dedup[key] = t

    final_list = sorted(dedup.values(), key=lambda x: (x["price"], -x["rtp_net"]))
    recent_wins = fetch_recent_wins()

    with open(os.path.join(workspace, "catalogo_completo.json"), "w", encoding="utf-8") as f:
        json.dump({"tickets": final_list, "recent_wins": recent_wins}, f, indent=2, ensure_ascii=False)

    out_js = (
        "window.UNSCRATCH_DATA = " + json.dumps(final_list, indent=2, ensure_ascii=False) + ";\n"
        "window.UNSCRATCH_WINS = " + json.dumps(recent_wins, indent=2, ensure_ascii=False) + ";\n"
    )
    with open(os.path.join(workspace, "data.js"), "w", encoding="utf-8") as f:
        f.write(out_js)

    print(f"OK: {len(final_list)} biglietti validati salvati in data.js")
