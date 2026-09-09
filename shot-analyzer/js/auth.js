// ============================================================================
// auth.js
// ----------------------------------------------------------------------------
// שכבת התחברות עם Google Identity Services (ה-SDK הרשמי של גוגל להתחברות
// בצד לקוח, בלי שרת משלנו). מרנדרת את כפתור "התחבר עם גוגל" הרשמי,
// ומפענחת את ה-JWT שחוזר כדי לקבל שם/אימייל/תמונת פרופיל.
// ============================================================================

import { GOOGLE_CLIENT_ID } from "./authConfig.js";

const STORAGE_KEY = "shotiq_user";

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
  return JSON.parse(json);
}

export class Auth {
  constructor() {
    this.user = null;
    this.configured = !!GOOGLE_CLIENT_ID;
    this.listeners = [];
    this._restore();
  }

  _restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.user = JSON.parse(raw);
    } catch (e) {
      /* פרטי דפדפן חסומים (מצב פרטי וכו') - פשוט נתחיל כאורח */
    }
  }

  onChange(fn) {
    this.listeners.push(fn);
    if (this.user) fn(this.user);
  }

  _emit() {
    for (const fn of this.listeners) fn(this.user);
  }

  async init(buttonContainerId) {
    if (!this.configured) return false;
    await this._loadScript();
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => this._handleCredential(resp),
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    const el = document.getElementById(buttonContainerId);
    if (el) {
      window.google.accounts.id.renderButton(el, {
        type: "standard",
        theme: "filled_black",
        size: "medium",
        shape: "pill",
        text: "signin_with",
        logo_alignment: "left",
      });
    }
    return true;
  }

  _loadScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("טעינת Google Identity Services נכשלה"));
      document.head.appendChild(s);
    });
  }

  _handleCredential(resp) {
    const payload = decodeJwt(resp.credential);
    this.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
    } catch (e) {}
    this._emit();
  }

  signOut() {
    this.user = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    this._emit();
  }
}
