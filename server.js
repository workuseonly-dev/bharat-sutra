const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.get("/dashboard.html", (_q, r) => r.redirect("/"));
app.use(express.static(__dirname + "/public"));

const users = new Map(); // socket.id -> name
const history = [];
const names = () => [...users.values()];
const clean = (s, n) => String(s || "").trim().slice(0, n);

require("./markets").setup(io);
const news = require("./news").setup(io);
require("./impact").setup(io, news);
require("./jobs").setup(io);

io.on("connection", (socket) => {
  socket.on("join", (raw, ack) => {
    let name = clean(raw, 20);
    if (!name) return ack?.({ error: "Name required" });
    if (names().some((n) => n.toLowerCase() === name.toLowerCase()))
      return ack?.({ error: "Name already taken" });
    users.set(socket.id, name);
    ack?.({ ok: true, history });
    socket.broadcast.emit("system", `${name} joined`);
    io.emit("users", names());
  });

  socket.on("message", (text) => {
    const name = users.get(socket.id);
    text = clean(text, 1000);
    if (!name || !text) return;
    const msg = { id: Date.now() + Math.random(), name, text, ts: Date.now() };
    history.push(msg);
    if (history.length > 50) history.shift();
    io.emit("message", msg);
  });

  socket.on("typing", (on) => {
    const name = users.get(socket.id);
    if (name) socket.broadcast.emit("typing", { name, on: !!on });
  });

  socket.on("disconnect", () => {
    const name = users.get(socket.id);
    if (!name) return;
    users.delete(socket.id);
    io.emit("system", `${name} left`);
    io.emit("users", names());
  });
});

server.listen(process.env.PORT || 8080, "0.0.0.0", () => console.log("listening"));
