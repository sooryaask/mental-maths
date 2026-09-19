# Putting No Calculator online with a leaderboard

The site is plain HTML/CSS/JS. The leaderboard uses a free Firebase project for storage.
Setup takes about 10 minutes and needs a Google account. Nothing here costs money on
Firebase's free (Spark) plan.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and click **Create a project**.
   Give it any name (e.g. `no-calculator`). You can turn Google Analytics off.
2. In the left menu open **Build → Firestore Database → Create database**.
   Choose **Start in production mode** and a location near you (e.g. `europe-west2` for London).
3. In Firestore, open the **Rules** tab, replace everything with the contents of
   [`firestore.rules`](firestore.rules), and click **Publish**.
4. Open **Build → Authentication → Get started → Sign-in method**, click **Anonymous**,
   switch it on and **Save**. (Players never see a sign-in screen; this is what lets a
   browser own the username it claimed.)

## 2. Connect the site to it

1. Click the gear icon → **Project settings**. Under **Your apps**, click the web icon `</>`.
   Register an app with any nickname. Leave "Firebase Hosting" unticked.
2. Firebase shows a `firebaseConfig = { ... }` block. Copy the object and paste it into
   [`js/firebase-config.js`](js/firebase-config.js) in place of `null`, so the line reads
   `const FIREBASE_CONFIG = { apiKey: "...", ... };`

These values are meant to be public. The rules file is what protects the data.

## 3. Put the site online

The easiest option is **Netlify Drop**:

1. Go to <https://app.netlify.com/drop> (a free Netlify account is needed to keep the site).
2. Drag the whole `MentalArithmetic` folder onto the page. You get a link like
   `https://something-random.netlify.app`, which you can rename in Site settings.

Or use **GitHub Pages**: push the folder to a repository, then
Settings → Pages → Deploy from branch → `main` / root.

## 4. Allow your site's address

In Firebase: **Authentication → Settings → Authorized domains → Add domain**, and add
your site's domain (e.g. `something-random.netlify.app`). `localhost` is already allowed.

## 5. Check it works

Open your link, enter a name, pick **Set · 10 questions**, and finish the set. Your score
should appear in the leaderboard on the results page and on the start page. Open the
link on your phone to see the same leaderboard.

To test on your computer first, run a local server from this folder (opening
`index.html` directly as a file won't sign in):

```bash
python3 -m http.server 8000
```

then visit <http://localhost:8000>.

## How the leaderboard works

- Each combination of topics, difficulty, mode, length and answer style has its own
  leaderboard, so everyone on a board did the same kind of paper.
- **Set**: most correct wins, then the fastest time. **Sprint**: most correct wins, then the
  fewest wrong answers. Each name keeps only its best score on each board.
- Only completed Sprint and Set runs count. Zen runs, quitting early and "Drill my
  mistakes" aren't ranked.
- A username belongs to the browser that claimed it. Clearing browser data, or using a
  different browser or device, means claiming a new name there.

## Duels and ratings

A duel is a head-to-head time trial. One player creates a room and gets a four-character
code (and a shareable link like `?duel=K7Q2`); the other types the code or opens the link.

- **Same questions, both sides.** The room stores a single random *seed*, and each browser
  builds the identical twenty questions from it locally. No question and no answer ever
  travels over the network.
- **Lowest total time wins.** A wrong answer or a skip adds **five seconds** and moves you
  straight on, so nobody gets stuck. 20/20 in 50s beats 18/20 in 44s.
- **Each player is timed on their own device**, from their own 3-2-1 countdown. A slow
  connection cannot cost you the race; the live opponent bar is only for watching.
- **Ratings work like chess.** Everyone starts at 1200. K is 40 for your first ten duels,
  then 24 — so one duel moves a rating by at most 40 points. Beating someone much stronger
  is worth far more than beating someone weaker.
- **Walking out loses.** If you finish and your opponent goes quiet for 45 seconds, they
  forfeit and you win. If both of you walk out, it's a draw and nobody's rating moves.
- The room settings come from whoever created it: their sections, difficulty and answer
  style. Mode and length are ignored — a duel is always twenty questions.

Duels need a claimed name, since a rating has to belong to someone. They use four new
collections — `matches`, `matches/*/players`, `duels` and `ratings` — and none of them touch
the existing leaderboard under `boards/`.

Optional tidy-up: in Firestore, **TTL** on the `matches` collection with the field
`expiresAt` will delete abandoned invite rooms automatically, at no cost.

## Limits worth knowing

- Scores are checked for plausibility (e.g. at least 0.4 s per question, and correct ≤
  total), but the browser marks the answers, so someone determined could still post a
  fake score under their own name. You can delete bad entries in the Firebase console
  under **Firestore → Data → boards**.
- Duel ratings have the same honest limit. Reproducing the exact Elo arithmetic inside
  security rules would mean float maths matching the browser's to the last bit, which is
  too brittle to rely on, so the rules enforce bounds instead: a rating can only move by
  40 points at a time, each duel can only ever be counted once, and every change must point
  at a real, immutable record in `duels` naming a real opponent. Inflating a rating
  therefore means fabricating many duels, all of them visible under **Firestore → Data →
  duels** and deletable from the console. A Cloud Function would close the gap properly,
  but that needs the paid Blaze plan.
- The free plan allows about 50,000 reads and 20,000 writes a day, which is far more
  than a class or friend group will use.
