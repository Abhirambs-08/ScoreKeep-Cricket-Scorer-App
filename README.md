# ScoreKeep - Cricket Scorer App

A simple, responsive, and easy-to-use mobile-first web application for scoring cricket matches. It supports light/dark themes, detailed batsman and bowler stats tracking, over transitions, match state persistence, undo controls, and downloading scorecards as PDF.

## 📂 Project Structure

- `index.html` - The semantic HTML5 page layout (Setup screen, Live Dashboard, Dialog Modals, and Match Summary).
- `style.css` - Custom CSS containing HSL variables for Light/Dark themes, responsive grids, and micro-animations.
- `app.js` - The Javascript core engine handling scoring logic, player swaps, wickets, undo logs, and theme/state saving in `localStorage`.

---

## 🚀 How to Run Locally

Since this is built using standard vanilla web technologies (HTML, CSS, JS) without build step overhead, you can run it in multiple ways:

### Option 1: Double-Click (Offline Browser)
1. Navigate to the project directory: `cricket-scorer/`
2. Double-click `index.html` (or drag and drop it into any browser like Chrome, Firefox, or Safari).
3. The app will open and run completely offline!

### Option 2: Simple Python Local Server
Running a local server ensures native modal dialogs, persistence features, and printing work with maximum browser security:
1. Open a terminal and navigate to the project directory.
2. Run the command:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser and go to: **http://localhost:8000/**

### Option 3: Node.js (npx) Server
If you have Node.js installed, run:
```bash
npx serve .
```
Open the local address displayed in the terminal output.

---

## 🏏 How to Score a Match

1. **Setup:** Enter team names, match overs, active batsmen, and the opening bowler. Tap **Start Cricket Match**.
2. **Dashboard Controls:**
   - Tap `Dot`, `1`, `2`, `3`, `4`, `5`, or `6` to score standard runs.
   - Tap `WD` (Wide) to add 1 run (doesn't count as a legal ball).
   - Tap `NB` (No Ball) to add 1 run, and enter runs scored off the bat.
   - Tap `BYE` or `L.BYE` (Leg Bye) and enter runs run by the batters.
3. **Wicket:** Tap `WICKET!`, select who got out, dismissal type, whether the batters crossed, and input the new batter's name.
4. **Over Change:** After 6 legal balls, the striker ends will swap, and a modal will prompt you to select the next bowler. Tap an existing bowler's chip or enter a new bowler.
5. **Undo:** If you make a scoring error, click **Undo last ball** (on the dashboard or inside the bowler dialog) to roll back the delivery state.
6. **PDF Download:** Once the match concludes, go to the Match Summary screen and click **Download PDF** to print or save the scorecard to your device.

---

## 🌐 How to Host Online (For Free)

To share the application so anyone can use it on their phone on the field, you can deploy it online for free using either GitHub Pages or Vercel:

---

### Method A: GitHub Pages

GitHub Pages is ideal for hosting static files (HTML, CSS, JS) directly from a GitHub repository.

#### Option 1: Using the GitHub Web Browser Interface
1. Sign in to your account at [GitHub](https://github.com). If you don't have one, create it for free.
2. Click the **"+"** icon in the top-right corner and select **New repository**.
3. Name your repository `ScoreKeep-Cricket Scorer App`. Set it to **Public** so pages can load. Leave other initializers unselected, then click **Create repository**.
4. In the repository page, click the **"uploading an existing file"** link under the quick setup section.
5. Drag and drop `index.html`, `style.css`, and `app.js` from your local folder into the browser box.
6. Scroll down and click **Commit changes** (this saves the files into the repository).
7. Go to the repository **Settings** tab (the gear icon on top).
8. In the left sidebar under the "Code and automation" section, click **Pages**.
9. Under **Build and deployment -> Source**, ensure it is set to **Deploy from a branch**.
10. Under **Branch**, select `main` (or `master`) and `/ (root)` folder, then click **Save**.
11. Wait 1-2 minutes. Refresh the Page. You will see a link at the top of the Pages tab: `https://<your-username>.github.io/ScoreKeep-Cricket-Scorer-App/`. Open this link on any phone or device!

#### Option 2: Using the Command Line Interface (Git CLI)
If you have Git installed on your computer:
1. Open your terminal inside the `cricket-scorer/` directory.
2. Initialize Git and stage your files:
   ```bash
   git init
   git add index.html style.css app.js README.md
   git commit -m "Initial commit of ScoreKeep app"
   ```
3. Create your repository on [GitHub](https://github.com/new) named `ScoreKeep-Cricket Scorer App` (this becomes URL-friendly `ScoreKeep-Cricket-Scorer-App`).
4. Link your local files to GitHub and push (replace `<username>` with your GitHub username):
   ```bash
   git branch -M main
   git remote add origin https://github.com/<username>/ScoreKeep-Cricket-Scorer-App.git
   git push -u origin main
   ```
5. Go to the repository **Settings** tab -> **Pages** -> Select `main` branch -> Click **Save**.

---

### Method B: Vercel

Vercel provides ultra-fast hosting and can build directly from your drag-and-drop actions or your GitHub repositories.

#### Option 1: Drag-and-Drop Deploy (No Command Line Needed)
1. Navigate to the [Vercel Deploy Dashboard](https://vercel.com/import/project) (create a free account if you haven't).
2. Look for the **Drag and Drop** deploy section.
3. Drag your entire local `cricket-scorer/` folder and drop it into the upload box on Vercel.
4. Vercel will upload and deploy the files instantly.
5. Once complete, it will provide you with a custom production link (e.g., `https://scorekeep-cricket-scorer-app.vercel.app/`).

#### Option 2: Connect GitHub Repo (Recommended for Automatic Updates)
If you already uploaded your project to GitHub using Method A:
1. Log in to [Vercel](https://vercel.com) and click **Add New -> Project**.
2. Under **Import Git Repository**, connect your GitHub account.
3. Find your `ScoreKeep-Cricket-Scorer-App` repository and click **Import**.
4. Leave the default configurations (Framework Preset: *Other*, Root Directory: *./*).
5. Click **Deploy**.
6. Every time you push updates to GitHub (`git push`), Vercel will automatically redeploy the new version instantly!

