from flask import Flask, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
from bot import run
import pytz, os

app = Flask(__name__)

scheduler = BackgroundScheduler(timezone=pytz.timezone("Asia/Jerusalem"))
scheduler.add_job(run, "cron", hour=9, minute=0)
scheduler.start()

@app.route("/")
def home():
    return jsonify({"status": "בוט מונדיאל פעיל", "next_send": "09:00 IL"})

@app.route("/send-now")
def send_now():
    try:
        run()
        return jsonify({"status": "נשלח!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health")
def health():
    return "OK", 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
