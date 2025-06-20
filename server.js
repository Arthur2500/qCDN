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
  return domain.replace(/[^a-zA-Z0-9.:-]/g, "");
}

const PROTOCOL = process.env.USE_HTTPS === "true" ? "https" : "http";
const PORT = process.env.PORT || 3000;
const RAW_DOMAIN = process.env.DOMAIN || "localhost";
const DOMAIN = sanitizeDomain(RAW_DOMAIN === "localhost" ? `localhost:${PORT}` : RAW_DOMAIN);

const PRIVACY_LINK = process.env.PRIVACY_LINK || null;
const TERMS_LINK = process.env.TERMS_LINK || null;
const IMPRINT_LINK = process.env.IMPRINT_LINK || null;

const PASSWORDS = (process.env.PASSWORDS || "password")
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

const API_ENABLED = API_KEYS.length > 0 && API_KEYS[0].toLowerCase() !== "none";

const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE_THIS_TO_A_LONG_RANDOM_STRING";

function passThrough(req, res, next) {
  return next();
}

function extractScriptDomains(headTags) {
  const $ = cheerio.load(`<head>${headTags}</head>`);
  const scriptDomains = new Set();
  $("script[src]").each((_, elem) => {
    const src = $(elem).attr("src");
    if (src) {
      try {
        const url = new URL(src);
        scriptDomains.add(`${url.protocol}//${url.host}`);
      } catch (err) {
        console.error(`Invalid URL in HEAD_TAGS: ${src}`);
      }
    }
  });
  return Array.from(scriptDomains);
}

const dynamicScriptDomains = extractScriptDomains(HEAD_TAGS);

const helmetMiddleware = securityEnabled
  ? helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://static.cloudflareinsights.com",
            ...dynamicScriptDomains,
          ],
          connectSrc: [
            "'self'",
            ...dynamicScriptDomains,
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
      secure: process.env.USE_HTTPS === "true",
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
const LOCK_FILE = path.join(__dirname, "data/db.lock");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ files: [] }, null, 2), "utf-8");
}

let db = { files: [] };

function acquireLock() {
  while (fs.existsSync(LOCK_FILE)) {
    console.log("Waiting for lock to be released...");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  fs.writeFileSync(LOCK_FILE, "locked", "utf-8");
}

function releaseLock() {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
  }
}

function loadDB() {
  acquireLock();
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ files: [] }, null, 2), "utf-8");
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    db = JSON.parse(raw);
  } finally {
    releaseLock();
  }
}

function saveDB() {
  acquireLock();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } finally {
    releaseLock();
  }
}

loadDB();

// Migrate DB
if (!db.reverseShares) {
  db.reverseShares = [];
  saveDB();
}

function generateReverseShareHash() {
  return crypto.randomBytes(16).toString("hex");
}

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
  loadDB();
  res.render("index", {
    domain: DOMAIN,
    protocol: PROTOCOL,
    loggedIn: !!req.session.loggedIn,
    files: db.files.slice().reverse(),
    reverseShares: db.reverseShares.slice().reverse(),
    totalStorage: db.files.reduce((sum, file) => sum + file.size, 0),
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
    headTags: HEAD_TAGS,
    privacyLink: PRIVACY_LINK,
    termsLink: TERMS_LINK,
    imprintLink: IMPRINT_LINK,
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.get("/api-docs", isAuthenticated, (req, res) => {
  res.render("api-docs", {
    domain: DOMAIN,
    protocol: PROTOCOL,
    loggedIn: !!req.session.loggedIn,
    apiKeys: API_KEYS,
    headTags: HEAD_TAGS,
    privacyLink: PRIVACY_LINK,
    termsLink: TERMS_LINK,
    imprintLink: IMPRINT_LINK,
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
  loadDB();
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
    uploadedAt: new Date().toISOString(),
  });
  saveDB();

  const fileURL = `${PROTOCOL}://${DOMAIN}/${hash}/${encodeURIComponent(originalName)}`;
  console.log(`File uploaded: ${originalName}, URL: ${fileURL}`);
  return res.json({ success: true, url: fileURL });
});

app.delete("/delete/:hash", isAuthenticated, (req, res) => {
  loadDB();
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

app.post("/reverse-share", isAuthenticated, (req, res) => {
  loadDB();
  const hash = generateReverseShareHash();
  db.reverseShares.push({
    hash,
    createdAt: new Date().toISOString(),
    used: false,
    callbackUrl: req.body.callbackUrl || null,
    uploadedAt: null,
    filename: null,
    fileUrl: null
  });
  saveDB();
  return res.json({ success: true, url: `${PROTOCOL}://${DOMAIN}/${hash}` });
});

app.get("/:hash", (req, res) => {
  loadDB();
  const { hash } = req.params;
  const reverseShare = db.reverseShares.find((e) => e.hash === hash);

  if (!reverseShare) {
    return res.status(404).render("404", {
      domain: DOMAIN,
      loggedIn: !!req.session.loggedIn,
      headTags: HEAD_TAGS,
      privacyLink: PRIVACY_LINK,
      termsLink: TERMS_LINK,
      imprintLink: IMPRINT_LINK,
      errorCode: 404,
    });
  }

  if (reverseShare.used) {
    return res.status(410).render("404", {
      domain: DOMAIN,
      loggedIn: !!req.session.loggedIn,
      headTags: HEAD_TAGS,
      privacyLink: PRIVACY_LINK,
      termsLink: TERMS_LINK,
      imprintLink: IMPRINT_LINK,
      errorCode: 410,
    });
  }

  return res.render("reverse-share", {
    domain: DOMAIN,
    hash,
    headTags: HEAD_TAGS,
    privacyLink: PRIVACY_LINK,
    termsLink: TERMS_LINK,
    imprintLink: IMPRINT_LINK,
  });
});

app.post('/:hash', createUploadHandler(), async (req, res) => {
  loadDB();
  const { hash } = req.params;
  const reverseShare = db.reverseShares.find((e) => e.hash === hash && !e.used);

  if (!reverseShare) {
    return res.status(410).send('Gone or invalid');
  }

  if (!req.file) {
    return res.status(400).send('No file provided');
  }

  const savedFilename = req.file.filename;
  const [fileHash, ...rest] = savedFilename.split('-');
  const originalName = rest.join('-');
  const fileSize = req.file.size;

  const fileEntry = {
    hash: fileHash,
    originalName,
    savedFilename,
    size: fileSize,
    uploadedAt: new Date().toISOString(),
  };

  db.files.push(fileEntry);

  // Update reverse share
  reverseShare.used = true;
  reverseShare.uploadedAt = fileEntry.uploadedAt;
  reverseShare.filename = originalName;
  reverseShare.fileUrl = `${PROTOCOL}://${DOMAIN}/${fileHash}/${encodeURIComponent(originalName)}`;

  saveDB();

  return res.render('reverse-share', {
    domain: DOMAIN,
    hash: null,
    fileURL: reverseShare.fileUrl,
    headTags: HEAD_TAGS,
    privacyLink: PRIVACY_LINK,
    termsLink: TERMS_LINK,
    imprintLink: IMPRINT_LINK,
  });
});

app.delete('/delete/r/:hash', isAuthenticated, (req, res) => {
  loadDB();
  const { hash } = req.params;
  const reverseShareIndex = db.reverseShares.findIndex((share) => share.hash === hash);

  if (reverseShareIndex === -1) {
    return res.status(404).json({ success: false, message: 'Reverse share not found' });
  }

  const reverseShare = db.reverseShares[reverseShareIndex];

  db.reverseShares.splice(reverseShareIndex, 1);
  saveDB();

  console.log(`Reverse share deleted: ${reverseShare.hash}`);
  return res.json({ success: true });
});

if (API_ENABLED) {
  if (securityEnabled) {
    app.use("/api", apiLimiter);
  }

  app.post("/api/upload", isApiAuthenticated, createUploadHandler(), (req, res) => {
    loadDB();
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
      uploadedAt: new Date().toISOString(),
    });
    saveDB();

    const fileURL = `https://${DOMAIN}/${hash}/${encodeURIComponent(originalName)}`;
    console.log(`API: File uploaded: ${originalName}, URL: ${fileURL}`);
    return res.json({ success: true, url: fileURL });
  });

  app.delete("/api/delete/:hash", isApiAuthenticated, (req, res) => {
    loadDB();
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

  app.post("/api/reverse-share", isApiAuthenticated, (req, res) => {
    loadDB();
    const hash = generateReverseShareHash();
    const callbackUrl = req.body.callbackUrl || null;

    db.reverseShares.push({
      hash,
      createdAt: new Date().toISOString(),
      used: false,
      callbackUrl,
      uploadedAt: null,
      filename: null,
      fileUrl: null
    });

    saveDB();
    return res.json({ success: true, url: `${PROTOCOL}://${DOMAIN}/${hash}` });
  });

  app.get('/api/reverse-share/:hash/status', isApiAuthenticated, (req, res) => {
    loadDB();
    const { hash } = req.params;
    const reverseShare = db.reverseShares.find((e) => e.hash === hash);

    if (!reverseShare) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    return res.json({
      success: true,
      used: reverseShare.used,
      filename: reverseShare.filename,
      fileUrl: reverseShare.fileUrl,
      uploadedAt: reverseShare.uploadedAt,
      createdAt: reverseShare.createdAt,
      callbackUrl: reverseShare.callbackUrl
    });
  });

  app.delete('/api/delete/r/:hash', isApiAuthenticated, (req, res) => {
    loadDB();
    const { hash } = req.params;
    const reverseShareIndex = db.reverseShares.findIndex((share) => share.hash === hash);

    if (reverseShareIndex === -1) {
      return res.status(404).json({ success: false, message: 'Reverse share not found' });
    }

    const reverseShare = db.reverseShares[reverseShareIndex];

    db.reverseShares.splice(reverseShareIndex, 1);
    saveDB();

    console.log(`API: Reverse share deleted: ${reverseShare.hash}`);
    return res.json({ success: true });
  });
} else {
  console.log("API is disabled due to missing or invalid API_KEYS.");
}

app.get("/:hash/:filename", (req, res) => {
  loadDB();
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

app.use((req, res) => {
  res.status(404).render("404", {
    domain: DOMAIN,
    loggedIn: !!req.session.loggedIn,
    headTags: HEAD_TAGS,
    privacyLink: PRIVACY_LINK,
    termsLink: TERMS_LINK,
    imprintLink: IMPRINT_LINK,
  });
});

app.listen(PORT, () => {
  console.log(`qCDN running on port ${PORT} (http://localhost:${PORT})`);
  console.log(`Security Enabled? ${securityEnabled}`);
});