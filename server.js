require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  authorName: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  content: { type: String, required: true, trim: true, maxlength: 20000 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  authorName: { type: String, required: true },
  comments: [commentSchema]
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);

function createToken(user) {
  return jwt.sign({ id: user._id.toString(), name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}
function safePost(post) {
  return {
    id: post._id,
    title: post.title,
    content: post.content,
    author: post.authorName,
    authorId: post.author,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    comments: post.comments.map(c => ({
      id: c._id, author: c.authorName, authorId: c.author, text: c.text, createdAt: c.createdAt
    }))
  };
}

app.get("/api/health", (req, res) => res.json({ status: "ok", message: "Blog API is running" }));

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash });
    return res.status(201).json({ token: createToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) return res.status(401).json({ message: "Invalid email or password." });
    res.json({ token: createToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
});

app.get("/api/auth/me", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("name email");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ id: user._id, name: user.name, email: user.email });
  } catch (err) { next(err); }
});

app.get("/api/posts", async (req, res, next) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts.map(safePost));
  } catch (err) { next(err); }
});

app.get("/api/posts/:id", async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    res.json(safePost(post));
  } catch (err) { next(err); }
});

app.post("/api/posts", auth, async (req, res, next) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ message: "Title and content are required." });
    const post = await Post.create({ title: title.trim(), content: content.trim(), author: req.user.id, authorName: req.user.name, comments: [] });
    res.status(201).json(safePost(post));
  } catch (err) { next(err); }
});

app.put("/api/posts/:id", auth, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (post.author.toString() !== req.user.id) return res.status(403).json({ message: "You can edit only your own posts." });
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ message: "Title and content are required." });
    post.title = title.trim();
    post.content = content.trim();
    await post.save();
    res.json(safePost(post));
  } catch (err) { next(err); }
});

app.delete("/api/posts/:id", auth, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (post.author.toString() !== req.user.id) return res.status(403).json({ message: "You can delete only your own posts." });
    await post.deleteOne();
    res.json({ message: "Post deleted." });
  } catch (err) { next(err); }
});

app.post("/api/posts/:id/comments", auth, async (req, res, next) => {
  try {
    const text = (req.body.text || "").trim();
    if (!text) return res.status(400).json({ message: "Comment cannot be empty." });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    post.comments.push({ author: req.user.id, authorName: req.user.name, text });
    await post.save();
    res.status(201).json(safePost(post));
  } catch (err) { next(err); }
});

app.delete("/api/posts/:postId/comments/:commentId", auth, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found." });
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found." });
    if (comment.author.toString() !== req.user.id && post.author.toString() !== req.user.id) return res.status(403).json({ message: "Only the comment author or post author can remove this comment." });
    comment.deleteOne();
    await post.save();
    res.json(safePost(post));
  } catch (err) { next(err); }
});

app.use("/api", (req, res) => res.status(404).json({ message: "API route not found." }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid ID format." });
  if (err.code === 11000) return res.status(409).json({ message: "That email is already registered." });
  res.status(500).json({ message: "Server error. Check the terminal for details." });
});

if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET. Copy .env.example to .env and set JWT_SECRET.");
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Blog platform running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
