const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const cheerio = require("cheerio");

const app = express();

app.set("trust proxy", 1);

const securityEnabled = process.env.SECURITY === "enabled";

function sanitizeDomain(domain) {
  return domain.replace(/[^a-zA-Z0-9.-]/g, "");
}

const RAW_DOMAIN = process.env.DOMAIN || "";
const DOMAIN = sanitizeDomain(RAW_DOMAIN);

const PRIVACY_LINK = process.env.PRIVACY_LINK || null;
const TERMS_LINK = process.env.TERMS_LINK || null;
const IMPRINT_LINK = process.env.IMPRINT_LINK || null;

const PASSWORDS = (process.env.PASSWORDS || "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const API_KEYS = (process.env.API_KEYS || "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const HEAD_TAGS = (process.env.HEAD_TAGS || "")
  .split(",")
  .map((tag) => tag.trim())
  .filter(Boolean)
  .join("\n");

const isApiEnabled = API_KEYS.length > 0 && API_KEYS[0].toLowerCase() !== "none";

const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE_THIS_TO_A_LONG_RANDOM_STRING";

function passThrough(req, res, next) {
  return next();
}

function extractScriptUrls(headTags) {
  const $ = cheerio.load(`<head>${headTags}</head>`);
  const scriptUrls = [];
  $("script[src]").each((_, elem) => {
    const src = $(elem).attr("src");
    if (src) {
      scriptUrls.push(src);
    }
  });
  return scriptUrls;
}

const dynamicScriptUrls = extractScriptUrls(HEAD_TAGS);

const helmetMiddleware = securityEnabled
  ? helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://static.cloudflareinsights.com",
            ...dynamicScriptUrls,
          ],
        },
      },
    })
  : passThrough;

const loginLimiter = securityEnabled
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: "Too many failed login attempts, please try again later.",
    })
  : passThrough;

const apiLimiter = securityEnabled
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: "Too many API requests, please try again later.",
    })
  : passThrough;

app.use(helmetMiddleware);
app.use(cookieParser());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const UPLOAD_DIR = path.join(__dirname, "data/uploads");
const DB_FILE = path.join(__dirname, "data/db.json");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ files: [] }, null, 2), "utf-8");
}

let db = { files: [] };

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ files: [] }, null, 2), "utf-8");
  }
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  db = JSON.parse(raw);
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

loadDB();

function isAuthenticated(req, res, next) {
  if (req.session && req.session.loggedIn) {
    return next();
  }
  return res.status(403).send("Unauthorized. Please log in.");
}

function isApiAuthenticated(req, res, next) {
  const token = req.header("x-api-token");
  if (API_KEYS.includes(token)) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Invalid API token" });
}

app.get("/", (req, res) => {
  res.render("index", {
    domain: DOMAIN,
    loggedIn: !!req.session.loggedIn,
    files: db.files,
    headTags: HEAD_TAGS,
    privacyLink: PRIVACY_LINK,
    termsLink: TERMS_LINK,
    imprintLink: IMPRINT_LINK,
  });
});

app.post("/login", loginLimiter, (req, res) => {
  const { password } = req.body;
  if (PASSWORDS.includes(password)) {
    req.session.loggedIn = true;
    return res.redirect("/");
  }
  return res.render("index", {
    domain: DOMAIN,
    loggedIn: false,
    files: [],
    error: "Wrong password",
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

function createUploadHandler() {
  let generatedFilename = null;

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const hash = crypto.randomBytes(16).toString("hex");
      const filename = `${hash}-${file.originalname}`;
      generatedFilename = filename;
      cb(null, filename);
    },
  });

  const localUpload = multer({
    storage,
  }).single("file");

  return function (req, res, next) {
    req.on("aborted", () => {
      if (generatedFilename) {
        const partialPath = path.join(UPLOAD_DIR, generatedFilename);
        if (fs.existsSync(partialPath)) {
          fs.unlinkSync(partialPath);
          console.log(`Aborted upload deleted: ${partialPath}`);
        }
      }
    });

    localUpload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  };
}

app.post("/upload", isAuthenticated, createUploadHandler(), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file provided" });
  }

  const savedFilename = req.file.filename;
  const [hash, ...rest] = savedFilename.split("-");
  const originalName = rest.join("-");
  const fileSize = req.file.size;

  db.files.push({
    hash,
    originalName,
    savedFilename,
    size: fileSize,
  });
  saveDB();

  const fileURL = `https://${DOMAIN}/${hash}/${encodeURIComponent(originalName)}`;
  console.log(`File uploaded: ${originalName}, URL: ${fileURL}`);
  return res.json({ success: true, url: fileURL });
});

app.delete("/delete/:hash", isAuthenticated, (req, res) => {
  const { hash } = req.params;
  const fileIndex = db.files.findIndex((f) => f.hash === hash);
  if (fileIndex === -1) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  const fileToDelete = db.files[fileIndex];
  const filePath = path.join(UPLOAD_DIR, fileToDelete.savedFilename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`File deleted: ${fileToDelete.originalName}, Path: ${filePath}`);
  }
  db.files.splice(fileIndex, 1);
  saveDB();

  return res.json({ success: true });
});

if (securityEnabled && isApiEnabled) {
  app.use("/api", apiLimiter);

  app.post("/api/upload", isApiAuthenticated, createUploadHandler(), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const savedFilename = req.file.filename;
    const [hash, ...rest] = savedFilename.split("-");
    const originalName = rest.join("-");
    const fileSize = req.file.size;

    db.files.push({
      hash,
      originalName,
      savedFilename,
      size: fileSize
    });
    saveDB();

    const fileURL = `https://${DOMAIN}/${hash}/${encodeURIComponent(originalName)}`;
    console.log(`API: File uploaded: ${originalName}, URL: ${fileURL}`);
    return res.json({ success: true, url: fileURL });
  });

  app.delete("/api/delete/:hash", isApiAuthenticated, (req, res) => {
    const { hash } = req.params;
    const fileIndex = db.files.findIndex((f) => f.hash === hash);
    if (fileIndex === -1) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const fileToDelete = db.files[fileIndex];
    const filePath = path.join(UPLOAD_DIR, fileToDelete.savedFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`API: File deleted: ${fileToDelete.originalName}, Path: ${filePath}`);
    }
    db.files.splice(fileIndex, 1);
    saveDB();

    return res.json({ success: true });
  });
} else {
  console.log("API is disabled due to missing or invalid API_KEYS.");
}

app.get("/:hash/:filename", (req, res) => {
  const { hash, filename } = req.params;
  const fileEntry = db.files.find((f) => f.hash === hash && f.originalName === filename);
  if (!fileEntry) {
    return res.status(404).send("File not found");
  }

  const filePath = path.join(UPLOAD_DIR, fileEntry.savedFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File no longer exists");
  }
  return res.sendFile(filePath);
});

app.use((req, res, next) => {
  res.status(404).render("404", {
    domain: DOMAIN,
    headTags: HEAD_TAGS,
    privacyLink: PRIVACY_LINK,
    termsLink: TERMS_LINK,
    imprintLink: IMPRINT_LINK,
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`qCDN running on port ${PORT} (http://localhost:${PORT})`);
  console.log(`Security Enabled? ${securityEnabled}`);
});