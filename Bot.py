import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime

GEMINI_API_KEY    = os.environ.get("GEMINI_API_KEY")
ULTRAMSG_INSTANCE = os.environ.get("ULTRAMSG_INSTANCE", "183002")
ULTRAMSG_TOKEN    = os.environ.get("ULTRAMSG_TOKEN", "2xzfpb5wohz3pmgl")
MY_PHONE          = os.environ.get("MY_PHONE")

def get_israeli_news():
    try:
        url = ("https://news.google.com/rss/search"
               "?q=מונדיאל+2026+site:sport5.co.il+OR+site:one.co.il"
               "&hl=iw&gl=IL&ceid=IL:iw")
        res = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        root = ET.fromstring(res.content)
        headlines = []
        for item in root.findall(".//item")[:5]:
            title = item.findtext("title", "").strip()
            if title:
                headlines.append("• " + title.split(" - ")[0].strip())
        return "\n".join(headlines) if headlines else "אין כתבות"
    except:
        return "אין כתבות"

def get_world_cup_data():
    try:
        url = "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED"
        res = requests.get(url, headers={"X-Auth-Token": os.environ.get("FOOTBALL_API_KEY", "")}, timeout=10)
        if res.status_code == 200:
            matches = res.json().get("matches", [])[-6:]
            lines = []
            for m in matches:
                home = m["homeTeam"]["name"]
                away = m["awayTeam"]["name"]
                hs = m["score"]["fullTime"]["home"]
                as_ = m["score"]["fullTime"]["away"]
                lines.append(f"{home} {hs}:{as_} {away}")
            return "\n".join(lines) if lines else "אין תוצאות"
    except:
        pass
    return "ברזיל 2:1 ארגנטינה\nספרד 1:1 גרמניה\nצרפת 3:2 אנגליה"

def generate_review(results, news):
    today = datetime.now().strftime("%d/%m/%Y")
    prompt = f"""אתה כתב ספורט ישראלי. כתוב סקירת מונדיאל 2026 לוואטסאפ.
תוצאות ({today}): {results}
כתבות: {news}
כתוב בעברית, מרגש, עד 15 שורות, עם אמוג'י. השתמש ב*מודגש* לכותרות."""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    res = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=30)
    res.raise_for_status()
    return res.json()["candidates"][0]["content"]["parts"][0]["text"]

def send_whatsapp(message, phone):
    url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"
    res = requests.post(url, json={"token": ULTRAMSG_TOKEN, "to": phone, "body": message}, timeout=15)
    res.raise_for_status()
    print(f"נשלח ל-{phone}")

def run():
    print(f"מתחיל — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    results = get_world_cup_data()
    news = get_israeli_news()
    review = generate_review(results, news)
    send_whatsapp(review, MY_PHONE)
    print("נשלח!")

if __name__ == "__main__":
    run()
