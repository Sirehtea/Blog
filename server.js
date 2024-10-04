const mongoose = require("mongoose");
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const app = express();

// Store the upload time per IP address
const uploadAttempts = {};

app.use(cors());
app.use(express.json());

// Serve static files from uploads and public directory
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB connectie
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/blog";
mongoose
  .connect(mongoUrl)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Video schema
const videoSchema = new mongoose.Schema({
  title: String,
  filePath: String,
});

const Video = mongoose.model("Video", videoSchema);

// Multer setup for file uploads with 500MB size limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files are allowed!"), false);
    }
    cb(null, true);
  },
});

// Helper function to get the IP address
const getClientIp = (req) => {
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  return ip;
};

// Middleware to check upload limit per IP
const checkUploadLimit = (req, res, next) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Check if the IP is in the uploadAttempts object
  if (uploadAttempts[ip]) {
    const lastUploadTime = uploadAttempts[ip];

    // If the last upload was within the last 24 hours, block the request
    if (now - lastUploadTime < oneDay) {
      return res.status(429).send("You can only upload once per day.");
    }
  }

  // If no recent upload or it's been more than 24 hours, allow upload
  uploadAttempts[ip] = now;
  next();
};

// Endpoint for video upload with rate limiting
app.post("/upload", checkUploadLimit, (req, res) => {
  upload.single("videoFile")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .send("File is too large. Maximum size is 500MB.");
      }
      return res.status(500).send(err.message);
    } else if (err) {
      return res.status(500).send(err.message);
    }

    const { title } = req.body;
    const videoPath = req.file.path;

    const newVideo = new Video({ title, filePath: videoPath });
    newVideo
      .save()
      .then(() => res.status(200).send("Video uploaded successfully"))
      .catch((error) => res.status(500).send("Error uploading video"));
  });
});

// Endpoint to fetch all videos
app.get("/videos", (req, res) => {
  Video.find({})
    .then((videos) => res.status(200).json(videos))
    .catch((error) => res.status(500).send("Error fetching videos"));
});

// Serve uploaded videos with correct MIME types
app.get("/uploads/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  const ext = path.extname(filePath).toLowerCase();

  // Determine the MIME type based on the file extension
  const mimeTypes = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
  };

  const mimeType = mimeTypes[ext] || "application/octet-stream";
  res.setHeader("Content-Type", mimeType);

  // Stream the video
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// Serve the index.html when visiting the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
