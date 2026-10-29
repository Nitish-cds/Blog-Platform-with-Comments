const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { token: localStorage.getItem("blog_token"), user: null, posts: [], editingId: null, authMode: "login" };
const authDialog = $("#authDialog"), postDialog = $("#postDialog");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function showMessage(text) {
  const el = $("#message");
  el.textContent = text;
  el.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => el.classList.add("hidden"), 5000);
}
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) logout(false);
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}
function updateAuthUI() {
  $("#welcome").textContent = state.user ? `Hi, ${state.user.name}` : "";
  $("#loginOpen").classList.toggle("hidden", !!state.user);
  $("#registerOpen").classList.toggle("hidden", !!state.user);
  $("#logoutBtn").classList.toggle("hidden", !state.user);
  $("#writeOpen").textContent = state.user ? "＋ Write a post" : "＋ Log in to write";
}
function openAuth(mode = "login") {
  state.authMode = mode;
  const register = mode === "register";
  $("#authEyebrow").textContent = register ? "JOIN THE COMMUNITY" : "WELCOME BACK";
  $("#authTitle").textContent = register ? "Create account" : "Log in";
  $("#authSubmit").textContent = register ? "Create account" : "Log in";
  $("#nameLabel").classList.toggle("hidden", !register);
  $("#authName").required = register;
  $("#authPassword").autocomplete = register ? "new-password" : "current-password";
  $("#switchText").textContent = register ? "Already have an account?" : "New here?";
  $("#switchAuth").textContent = register ? "Log in" : "Create an account";
  $("#authError").textContent = "";
  authDialog.showModal();
}
function logout(notify = true) {
  state.token = null; state.user = null;
  localStorage.removeItem("blog_token");
  updateAuthUI(); renderPosts();
  if (notify) showMessage("You have logged out.");
}
async function loadUser() {
  if (!state.token) { updateAuthUI(); return; }
  try { state.user = await api("/api/auth/me"); }
  catch { state.token = null; state.user = null; localStorage.removeItem("blog_token"); }
  updateAuthUI();
}
function renderPosts() {
  const root = $("#posts");
  root.replaceChildren();
  if (!state.posts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No stories yet. Be the first to share an idea!";
    root.append(empty); return;
  }
  const template = $("#postTemplate");
  state.posts.forEach(post => {
    const fragment = template.content.cloneNode(true);
    const card = $(".post-card", fragment);
    const avatar = $(".avatar", card);
    avatar.textContent = (post.author || "?").trim().charAt(0).toUpperCase();
    $(".author", card).textContent = post.author;
    $("time", card).textContent = dateLabel(post.createdAt);
    $("time", card).dateTime = post.createdAt;
    $(".post-title", card).textContent = post.title;
    $(".post-content", card).textContent = post.content;
    $(".comment-count", card).textContent = `${post.comments.length} ${post.comments.length === 1 ? "comment" : "comments"}`;
    const ownerActions = $(".owner-actions", card);
    if (state.user && String(post.authorId) === String(state.user.id)) {
      ownerActions.classList.remove("hidden");
      $(".edit-post", card).addEventListener("click", () => openPostEditor(post));
      $(".delete-post", card).addEventListener("click", () => deletePost(post.id));
    }
    const commentsList = $(".comments-list", card);
    if (!post.comments.length) {
      const none = document.createElement("p"); none.className = "login-hint"; none.textContent = "No comments yet. Start the conversation."; commentsList.append(none);
    } else post.comments.forEach(comment => {
      const item = document.createElement("div"); item.className = "comment";
      const head = document.createElement("div"); head.className = "comment-head";
      const name = document.createElement("strong"); name.textContent = comment.author;
      const time = document.createElement("time"); time.textContent = dateLabel(comment.createdAt);
      head.append(name, time);
      if (state.user && (String(comment.authorId) === String(state.user.id) || String(post.authorId) === String(state.user.id))) {
        const remove = document.createElement("button"); remove.className = "comment-remove"; remove.type = "button"; remove.textContent = "Delete";
        remove.addEventListener("click", () => deleteComment(post.id, comment.id)); head.append(remove);
      }
      const text = document.createElement("p"); text.className = "comment-text"; text.textContent = comment.text;
      item.append(head, text); commentsList.append(item);
    });
    const commentForm = $(".comment-form", card);
    const commentInput = $(".comment-input", card);
    const commentButton = $("button", commentForm);
    if (!state.user) {
      commentInput.disabled = true; commentButton.disabled = true;
      $(".login-hint", card).classList.remove("hidden");
      commentForm.addEventListener("submit", e => e.preventDefault());
    } else commentForm.addEventListener("submit", async e => {
      e.preventDefault();
      const text = commentInput.value.trim(); if (!text) return;
      commentButton.disabled = true;
      try { await api(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ text }) }); await loadPosts(); }
      catch (err) { showMessage(err.message); }
      finally { commentButton.disabled = false; }
    });
    root.append(fragment);
  });
}
async function loadPosts() {
  $("#posts").innerHTML = '<div class="loading">Loading stories…</div>';
  try { state.posts = await api("/api/posts"); renderPosts(); }
  catch (err) { $("#posts").innerHTML = ""; showMessage(err.message); }
}
function openPostEditor(post = null) {
  if (!state.user) { openAuth("login"); return; }
  state.editingId = post ? post.id : null;
  $("#postDialogTitle").textContent = post ? "Edit your post" : "Write a post";
  $("#postTitle").value = post ? post.title : "";
  $("#postContent").value = post ? post.content : "";
  $("#postError").textContent = "";
  $("button[type=submit]", $("#postForm")).textContent = post ? "Save changes" : "Publish post";
  postDialog.showModal();
}
async function deletePost(id) {
  if (!confirm("Delete this post and all its comments? This cannot be undone.")) return;
  try { await api(`/api/posts/${id}`, { method: "DELETE" }); await loadPosts(); showMessage("Post deleted."); }
  catch (err) { showMessage(err.message); }
}
async function deleteComment(postId, commentId) {
  if (!confirm("Delete this comment?")) return;
  try { await api(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" }); await loadPosts(); }
  catch (err) { showMessage(err.message); }
}

$("#loginOpen").addEventListener("click", () => openAuth("login"));
$("#registerOpen").addEventListener("click", () => openAuth("register"));
$("#logoutBtn").addEventListener("click", () => logout());
$("#writeOpen").addEventListener("click", () => openPostEditor());
$("#refreshBtn").addEventListener("click", loadPosts);
$("#switchAuth").addEventListener("click", () => openAuth(state.authMode === "login" ? "register" : "login"));
$$("[data-close]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));

$("#authForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#authError").textContent = "";
  const register = state.authMode === "register";
  const body = { email: $("#authEmail").value.trim(), password: $("#authPassword").value };
  if (register) body.name = $("#authName").value.trim();
  try {
    const data = await api(`/api/auth/${register ? "register" : "login"}`, { method: "POST", body: JSON.stringify(body) });
    state.token = data.token; state.user = data.user; localStorage.setItem("blog_token", data.token);
    authDialog.close(); $("#authForm").reset(); updateAuthUI(); await loadPosts(); showMessage(register ? "Account created. Welcome to BlogSpace!" : "Welcome back!");
  } catch (err) { $("#authError").textContent = err.message; }
});

$("#postForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#postError").textContent = "";
  const body = { title: $("#postTitle").value.trim(), content: $("#postContent").value.trim() };
  const editing = Boolean(state.editingId);
  try {
    await api(editing ? `/api/posts/${state.editingId}` : "/api/posts", { method: editing ? "PUT" : "POST", body: JSON.stringify(body) });
    postDialog.close(); $("#postForm").reset(); state.editingId = null;
    await loadPosts(); showMessage(editing ? "Post updated." : "Your post is published.");
  } catch (err) { $("#postError").textContent = err.message; }
});

(async function init() { await loadUser(); await loadPosts(); })();