# NYC 2026 – הוראות העלאה

זמן משוער: 20 דקות. עושים את זה פעם אחת.

## 1. פיירבייס
1. נכנסים ל־console.firebase.google.com ויוצרים פרויקט חדש בשם `nyc-2026`. אפשר לכבות את Analytics.
2. **Authentication** ← Get started ← Sign-in method ← מפעילים **Anonymous**.
3. **Firestore Database** ← Create database ← Production mode ← מיקום `nam5` (ארה"ב).
4. ב־Firestore ← לשונית **Rules** ← מוחקים הכול, מדביקים את התוכן של `firestore.rules` ← Publish.
5. ⚙️ Project settings ← Your apps ← אייקון `</>` ← רושמים אפליקציה ← מעתיקים את `firebaseConfig`.
6. פותחים את `app.js` ומדביקים את הערכים במקום `PASTE_HERE` (שורות 10–17).
7. Authentication ← Settings ← Authorized domains ← מוסיפים `<שם-המשתמש-שלך>.github.io`.

המפתח שב־config לא סודי. מה שמגן על הנתונים זה חוקי האבטחה משלב 4.

## 2. גיטהאב
1. ריפו חדש בשם `nyc-2026` (ציבורי).
2. מעלים את כל הקבצים מהתיקייה, כמו שהם, לשורש הריפו.
3. Settings ← Pages ← Source: Deploy from a branch ← `main` / `root` ← Save.
4. אחרי דקה-שתיים האתר עולה בכתובת `https://<שם-המשתמש>.github.io/nyc-2026/`.

## 3. כניסה ראשונה
1. נכנסים לאתר ← מסך "הגדרה ראשונה" ← קובעים קוד של 4 ספרות לכל אחד ← שמירה.
2. **נכנסים ראשון בתור דור.** זה טוען את כל הלו"ז, הטיסות והמשימות.
3. שולחים למוטי ולבן את הקישור ואת הקוד שלהם.
4. בטלפון: שיתוף ← "הוסף למסך הבית", וזה נפתח כמו אפליקציה.

לשנות קוד בהמשך: ב־Firestore מוחקים את `meta/setup` ואת שלושת המסמכים ב־`users`, ונכנסים שוב לאתר.

## 4. המפות (Google My Maps)
חוזרים על זה פעמיים, פעם לכל קובץ:
1. mymaps.google.com ← Create a new map ← Import ← מעלים את `map-brothers.csv`.
2. עמודת מיקום: **Address**. עמודת כותרת: **Name**.
3. בשכבה: Uniform style ← Style by data column ← **Day**. כל יום מקבל צבע.
4. Share ← "Anyone with the link can view".
5. ⋮ ← Embed on my site ← מעתיקים את הקוד.
6. באתר: תפריט ← הגדרות ← מדביקים בשדה של המפה ← שמירה.

אחר כך אותו דבר עם `map-mba.csv`.

## מה יש בתיקייה
| קובץ | מה זה |
| --- | --- |
| index.html, styles.css, app.js | האתר |
| data.js | כל הנתונים ההתחלתיים: לו"ז, טיסות, משימות |
| firestore.rules | חוקי האבטחה של הדאטהבייס |
| sw.js, manifest.webmanifest, icon* | התקנה למסך הבית ועבודה בלי קליטה |
| map-brothers.csv, map-mba.csv | לייבוא ל־My Maps |
