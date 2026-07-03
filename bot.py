import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime,timedelta

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GREEN_API_ID    = os.environ.get("GREEN_API_ID", "7107665984")
GREEN_API_TOKEN = os.environ.get("GREEN_API_TOKEN", "b9845f9e53c14dbe805579a2851f8e39291cdbfa4718417f9e")
MY_PHONE        = os.environ.get("MY_PHONE")  # פורמט: 972507747717 (בלי +)

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
        return "\n".join(headlines) if headlines else "אין כתבות זמינות"
    except:
        return "אין כתבות זמינות"

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
            return "\n".join(lines) if lines else "אין תוצאות זמינות"
    except:
        pass
    return "אין תוצאות זמינות כרגע"

def generate_review(results, news):
    today = datetime.now().strftime("%d/%m/%Y")
    try:
        prompt = f"""
אתה כתב בכיר של ONE ו-Sport5.

כתוב סקירת מונדיאל 2026 לוואטסאפ.

אלה המשחקים:
{results}

כותרות חדשות:
{news}

הוראות:
- תן כותרת ראשית מושכת.
- עבור כל משחק כתוב 5–7 שורות.
- תאר איך המשחק התפתח, מי שלט, ומה הייתה נקודת המפנה.
- אל תחזור רק על התוצאה.
- כתוב בסגנון עיתונאי, זורם ומעניין.
- אל תמציא עובדות שלא מופיעות בנתונים.
- השתמש באמוג'ים במידה.
- השתמש ב*מודגש* לכותרות.
- בסוף הוסף:
⭐ מצטיין היום
😲 הפתעת היום
📅 למה כדאי לחכות במשחקים הבאים (אם אפשר להסיק מהנתונים).
מתחת לכול כותרת משחק תכתוב מי הבקיע ובאיזה דקה.
מתחת לכל כותרת משחק אם מישהו קיבל כרטיס אדום תכתוב באיזה דקה ומי קיבל ליד אימוגי של כרטיס אדום.
מתחת לכל נתוני המשחק תכתוב את תקציר המשחק ואירועים מרכזיים.
תרשום ליד כל משחק באיזה שלב הוא בטורניר.
עזוב דברים שלא קשורים לקבוצות שהודחו שלב לפני.
אל תקשר כתבות מפיפא שלא קשורות.

שמור על אורך סביר שמתאים לקריאה בוואטסאפ.
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        res = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=20)
        res.raise_for_status()
        return res.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"AI נכשל, שולח תבנית קבועה: {e}")
        return (
            f"⚽ *סקירת מונדיאל 2026 — {today}*\n\n"
            f"📊 *תוצאות:*\n{results}\n\n"
            f"📰 *כתבות:*\n{news}\n\n"
            f"_עדכון אוטומטי יומי_ ⚽"
        )

def send_whatsapp(message, phone):
    """שולח הודעה דרך Green API"""
    url = f"https://api.green-api.com/waInstance{GREEN_API_ID}/sendMessage/{GREEN_API_TOKEN}"
    payload = {
        "chatId": f"{phone}@c.us",
        "message": message,
    }
    res = requests.post(url, json=payload, timeout=15)
    res.raise_for_status()
    print(f"נשלח ל-{phone}")
    return res.json()

def run():
    print(f"מתחיל — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    results = get_world_cup_data()
    news = get_israeli_news()
    review = generate_review(results, news)
    send_whatsapp(review, MY_PHONE)
    print("נשלח!")

if __name__ == "__main__":
    run()
