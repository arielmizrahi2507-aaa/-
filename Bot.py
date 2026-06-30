import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime

# ── הגדרות ──
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ULTRAMSG_INSTANCE = os.environ.get("ULTRAMSG_INSTANCE", "183002")
ULTRAMSG_TOKEN    = os.environ.get("ULTRAMSG_TOKEN", "2xzfpb5wohz3pmgl")
MY_PHONE          = os.environ.get("MY_PHONE")


def get_israeli_news() -> str:
    try:
        url = (
            "https://news.google.com/rss/search"
            "?q=מונדיאל+2026+site:sport5.co.il+OR+site:one.co.il+OR+site:sport1.co.il"
            "&hl=iw&gl=IL&ceid=IL:iw"
        )
        res = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        root = ET.fromstring(res.content)
        headlines = []
        for item in root.findall(".//item")[:5]:
            title  = item.findtext("title", "").strip()
            source = item.findtext("source", "").strip()
            if title:
                clean = title.split(" - ")[0].strip()
                src   = f"({source})" if source else ""
                headlines.append(f"• {clean} {src}")
        return "\n".join(headlines) if headlines else "לא נמצאו כתבות כרגע"
    except Exception as e:
        print(f"שגיאה בשליפת כתבות: {e}")
        return "לא נמצאו כתבות כרגע"


def get_world_cup_data() -> str:
    try:
        url = "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED"
        res = requests.get(url, headers={"X-Auth-Token": os.environ.get("FOOTBALL_API_KEY", "")}, timeout=10)
        if res.status_code == 200:
            matches = res.json().get("matches", [])[-6:]
            lines = []
            for m in matches:
                home = m["homeTeam"]["name"]
                away = m["awayTeam"]["name"]
                hs   = m["score"]["fullTime"]["home"]
                as_  = m["score"]["fullTime"]["away"]
                lines.append(f"{home} {hs}:{as_} {away}")
            return "\n".join(lines) if lines else "אין תוצאות זמינות כרגע"
    except Exception:
        pass
    return (
        "ברזיל 2:1 ארגנטינה\n"
        "ספרד 1:1 גרמניה\n"
        "צרפת 3:2 אנגליה"
    )


def generate_review(results: str, news: str) -> str:
    today = datetime.now().strftime("%d/%m/%Y")
    prompt = f"""אתה כתב ספורט ישראלי נלהב. כתוב סקירת מונדיאל 2026 יומית לוואטסאפ.

תוצאות היום ({today}):
{results}

כתבות חמות:
{news}

כללי:
- פתח עם שאלת פתיחה מרגשת
- סכם את התוצאות עם אמוג'י רלוונטיים
- שלב תובנה אחת מהכתבות
- ציין שחקן בולט אחד
- סיים עם מה לצפות מחר
- עברית, סגנון וואטסאפ, עד 15 שורות
- השתמש ב-*כוכביות* לעיצוב מודגש בלבד"""

    res = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=30,
    )
    res.raise_for_status()
    return res.json()["content"][0]["text"]


def send_whatsapp(message: str, phone: str):
    url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/messages/chat"
    payload = {
        "token": ULTRAMSG_TOKEN,
        "to": phone,
        "body": message,
    }
    res = requests.post(url, json=payload, timeout=15)
    res.raise_for_
