// ============================================================================
// authConfig.js
// ----------------------------------------------------------------------------
// הגדרות התחברות עם גוגל ושמירת היסטוריה בענן. שני הערכים למטה ריקים
// כברירת מחדל בכוונה: SHOT IQ לא "מחזיק" חשבון גוגל או פרויקט Firebase
// בשבילכם - אתם יוצרים אותם בעצמכם, בחינם, בכמה דקות, בחשבון הגוגל שלכם.
// עד אז האפליקציה עובדת מצוין בלי זה: היא שומרת היסטוריה מקומית בדפדפן.
// ============================================================================

// --- שלב 1: כפתור "התחבר עם גוגל" ---------------------------------------
// 1. https://console.cloud.google.com/apis/credentials
// 2. צרו פרויקט (אם אין), ואז "Create Credentials" → "OAuth client ID"
// 3. Application type: "Web application"
// 4. תחת "Authorized JavaScript origins" הוסיפו את הכתובת שבה תריצו את
//    האתר (למשל http://localhost:8080 או https://YOUR-USERNAME.github.io)
// 5. העתיקו את ה-Client ID שנוצר לכאן:
export const GOOGLE_CLIENT_ID = "";

// --- שלב 2 (אופציונלי): סנכרון היסטוריית זריקות בין מכשירים ---------------
// בלי את זה, ההיסטוריה עדיין נשמרת - אבל רק בדפדפן הספציפי הזה.
// 1. https://console.firebase.google.com → Add project (חינמי)
// 2. Build → Authentication → Sign-in method → הפעילו ספק "Google"
// 3. Build → Firestore Database → Create database
// 4. Project settings → General → "Your apps" → הוסיפו Web app (</>) →
//    העתיקו את אובייקט הקונפיגורציה לכאן במקום null:
export const FIREBASE_CONFIG = null;
// דוגמה:
// export const FIREBASE_CONFIG = {
//   apiKey: "AIza...", authDomain: "your-app.firebaseapp.com",
//   projectId: "your-app", storageBucket: "your-app.appspot.com",
//   messagingSenderId: "...", appId: "1:...:web:...",
// };
