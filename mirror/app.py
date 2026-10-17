import json
import os

import anthropic
from flask import Flask, Response, jsonify, request, send_from_directory, stream_with_context

MODEL = os.environ.get("MIRROR_MODEL", "claude-opus-5-5")
MAX_TOKENS = 64000
MAX_MESSAGES = 200
MAX_CHARS = 200_000

SYSTEM = (
    "You are a helpful, direct and thoughtful assistant inside a chat app called Mirror. "
    "Reply in the language the user writes in. Use Markdown when it helps readability "
    "(lists, code blocks), and keep answers as short as the question allows."
)

app = Flask(__name__, static_folder="static", static_url_path="/static")
_client = None


def get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def sse(event):
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def parse_messages(payload):
    messages = payload.get("messages") if isinstance(payload, dict) else None
    if not isinstance(messages, list) or not 0 < len(messages) <= MAX_MESSAGES:
        return None
    clean, total = [], 0
    for m in messages:
        if not isinstance(m, dict) or m.get("role") not in ("user", "assistant"):
            return None
        content = m.get("content")
        if not isinstance(content, str) or not content.strip():
            return None
        total += len(content)
        clean.append({"role": m["role"], "content": content})
    if clean[0]["role"] != "user" or clean[-1]["role"] != "user" or total > MAX_CHARS:
        return None
    return clean


def generate(messages):
    try:
        with get_client().messages.stream(
            model=MODEL, max_tokens=MAX_TOKENS, system=SYSTEM, messages=messages
        ) as stream:
            for text in stream.text_stream:
                yield sse({"t": "text", "v": text})
            final = stream.get_final_message()
        if final.stop_reason == "refusal":
            yield sse({"t": "notice", "v": "המודל סירב לענות על הבקשה הזו."})
        elif final.stop_reason == "max_tokens":
            yield sse({"t": "notice", "v": "התשובה נקטעה בגלל מגבלת אורך."})
        yield sse({"t": "done"})
    except anthropic.AuthenticationError:
        yield sse({"t": "error", "v": "מפתח ה-API לא תקין. בדוק את ANTHROPIC_API_KEY."})
    except anthropic.RateLimitError:
        yield sse({"t": "error", "v": "יותר מדי בקשות כרגע. נסה שוב בעוד רגע."})
    except anthropic.APIConnectionError:
        yield sse({"t": "error", "v": "אין חיבור ל-API של Anthropic."})
    except anthropic.APIStatusError as e:
        yield sse({"t": "error", "v": f"שגיאת API ({e.status_code})."})
    except TypeError:
        # The SDK raises TypeError when no credentials can be resolved.
        yield sse({"t": "error", "v": "לא הוגדר מפתח API. הגדר ANTHROPIC_API_KEY והפעל מחדש."})


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.post("/api/chat")
def chat():
    messages = parse_messages(request.get_json(silent=True))
    if messages is None:
        return jsonify({"error": "בקשה לא תקינה."}), 400
    return Response(
        stream_with_context(generate(messages)),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
def health():
    return "OK", 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=port, threaded=True)
