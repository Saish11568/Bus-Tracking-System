/**
 * BusTrack — JCER Backend Server
 * Full-featured: Auth (JWT), Bus Tracking via Socket.IO,
 * Admin APIs, Driver APIs, Student APIs
 */

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = 5000;
const JWT_SECRET = "bustrack_jcer_secret_2024";

// ── Simple JWT (no external dep) ────────────────────────────
function signJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body   = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 24*60*60*1000 })).toString("base64url");
  const sig    = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ message: "No token provided" });
  const payload = verifyJWT(h.slice(7));
  if (!payload) return res.status(401).json({ message: "Invalid or expired token" });
  req.user = payload;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ message: "Access denied" });
    next();
  };
}

// ── In-memory DB ─────────────────────────────────────────────
const users = [
  { id: "u1", name: "Admin",        email: "admin@jcer.edu",   password: "admin123",   role: "admin" },
  { id: "u2", name: "Ravi Patil",   email: "driver@jcer.edu",  password: "driver123",  role: "driver", driverCode: "DRV001", busId: "CB-101", routeId: "rto" },
  { id: "u3", name: "Suresh Kumar", email: "driver2@jcer.edu", password: "driver123",  role: "driver", driverCode: "DRV002", busId: "CB-102", routeId: "sambra" },
  { id: "u4", name: "Manoj Singh",  email: "driver3@jcer.edu", password: "driver123",  role: "driver", driverCode: "DRV003", busId: "CB-103", routeId: "mahantesh" },
  { id: "u5", name: "Student Demo", email: "student@jcer.edu", password: "student123", role: "student", usn: "2JC21CS001", routeId: "rto" },
];

const ROUTES = {
  rto:       { id: "rto",       name: "R.T.O Route",     busId: "CB-101", color: "#4F6FFF", duration: 35, stops: 12, distance: "18 km", driverName: "Ravi Patil"   },
  sambra:    { id: "sambra",    name: "Sambra Route",    busId: "CB-102", color: "#22C55E", duration: 42, stops: 8,  distance: "22 km", driverName: "Suresh Kumar"  },
  mahantesh: { id: "mahantesh", name: "Mahantesh Nagar", busId: "CB-103", color: "#F59E0B", duration: 28, stops: 10, distance: "14 km", driverName: "Manoj Singh"   },
  vadagaon:  { id: "vadagaon",  name: "Vadagaon Route",  busId: "CB-104", color: "#A78BFA", duration: 32, stops: 10, distance: "16 km", driverName: "Akshay Desai"  },
  hanuman:   { id: "hanuman",   name: "Hanuman Nagar",   busId: "CB-105", color: "#22D3EE", duration: 50, stops: 15, distance: "26 km", driverName: "Rahul Naik"    },
};

const busPositions = {
  "CB-101": { lat: 15.8497, lng: 74.4977, speed: 45, heading: 90,  status: "active",  routeId: "rto",       lastUpdate: Date.now() },
  "CB-102": { lat: 15.8590, lng: 74.6189, speed: 38, heading: 270, status: "active",  routeId: "sambra",    lastUpdate: Date.now() },
  "CB-103": { lat: 15.8672, lng: 74.5060, speed: 0,  heading: 0,   status: "delayed", routeId: "mahantesh", lastUpdate: Date.now() },
  "CB-104": { lat: 15.8950, lng: 74.5250, speed: 52, heading: 180, status: "active",  routeId: "vadagaon",  lastUpdate: Date.now() },
  "CB-105": { lat: 15.8720, lng: 74.4900, speed: 41, heading: 45,  status: "active",  routeId: "hanuman",   lastUpdate: Date.now() },
};

const alerts = [
  { id: "a1", type: "delay",  title: "CB-103 Delayed",  message: "Mahantesh Nagar route delayed by ~35 mins due to traffic.", time: Date.now() - 1800000, routeId: "mahantesh" },
  { id: "a2", type: "info",   title: "Early Departure", message: "CB-101 departing 5 mins early today.",                       time: Date.now() - 3600000, routeId: "rto" },
  { id: "a3", type: "notice", title: "Schedule Change", message: "Return trip CB-102 moved to 5:30 PM today.",                 time: Date.now() - 900000,  routeId: "sambra" },
];

const tripLogs    = [];
const attendance  = [];
const maintenance = [];
let alertIdCounter = 4;

// ── Socket.IO ─────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const driverSockets = {};

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("driverAuth", ({ busId, routeId, driverId }) => {
    driverSockets[socket.id] = { busId, routeId, driverId };
    socket.join(`route:${routeId}`);
    socket.join(`bus:${busId}`);
  });

  socket.on("locationUpdate", (data) => {
    const { lat, lng, speed = 0, heading = 0, busId, routeId } = data;
    if (busId && busPositions[busId]) {
      busPositions[busId] = { ...busPositions[busId], lat, lng, speed, heading, lastUpdate: Date.now() };
    }
    io.to(`route:${routeId}`).emit("busLocation", { lat, lng, speed, heading, busId, routeId });
    io.emit("busLocation", { lat, lng, speed, heading, busId, routeId });
  });

  socket.on("watchRoute", ({ routeId }) => {
    socket.join(`route:${routeId}`);
    const route = ROUTES[routeId];
    if (route) {
      const pos = busPositions[route.busId];
      if (pos) socket.emit("busLocation", { ...pos, busId: route.busId, routeId });
    }
  });

  socket.on("driverSOS", (data) => {
    const alert = { id: `a${alertIdCounter++}`, type: "sos", title: `SOS — ${data.busId}`, message: data.message || "Driver sent emergency alert.", time: Date.now(), routeId: data.routeId, location: { lat: data.lat, lng: data.lng } };
    alerts.unshift(alert);
    io.emit("newAlert", alert);
  });

  socket.on("tripStart", (data) => {
    const { busId, routeId, driverId } = data;
    if (busPositions[busId]) busPositions[busId].status = "active";
    io.emit("busStatusUpdate", { busId, status: "active" });
    tripLogs.push({ id: `t${Date.now()}`, busId, routeId, driverId, startTime: Date.now(), status: "in-progress" });
  });

  socket.on("tripEnd", (data) => {
    if (busPositions[data.busId]) busPositions[data.busId].status = "completed";
    io.emit("busStatusUpdate", { busId: data.busId, status: "completed" });
  });

  socket.on("disconnect", () => {
    const info = driverSockets[socket.id];
    if (info?.busId && busPositions[info.busId]) {
      busPositions[info.busId].status = "offline";
      io.emit("busStatusUpdate", { busId: info.busId, status: "offline" });
    }
    delete driverSockets[socket.id];
  });
});

// ── Auth ──────────────────────────────────────────────────────
app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ message: "Email, password and role are required." });

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.role === role);
  if (!user) return res.status(401).json({ message: "Invalid credentials. Check your email and password." });

  const token = signJWT({ id: user.id, email: user.email, role: user.role, name: user.name, busId: user.busId, routeId: user.routeId });
  res.json({ token, role: user.role, name: user.name, email: user.email, busId: user.busId || null, routeId: user.routeId || null, driverCode: user.driverCode || null, usn: user.usn || null, message: "Login successful" });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, role, usn, driverCode } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ message: "All fields are required." });
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: "Email already exists." });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

  const newUser = { id: `u${Date.now()}`, name, email: email.toLowerCase(), password, role, usn: usn || null, driverCode: driverCode?.toUpperCase() || null };
  users.push(newUser);
  const token = signJWT({ id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name });
  res.status(201).json({ token, role: newUser.role, name: newUser.name, email: newUser.email, message: "Account created successfully." });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const { password: _, ...safe } = user;
  res.json(safe);
});

app.put("/api/auth/change-password", authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.password !== currentPassword) return res.status(401).json({ message: "Current password is incorrect" });
  if (newPassword.length < 6) return res.status(400).json({ message: "Min 6 characters required" });
  user.password = newPassword;
  res.json({ message: "Password changed successfully" });
});

// ── Buses & Routes ────────────────────────────────────────────
app.get("/api/buses", authMiddleware, (req, res) => {
  res.json(Object.entries(busPositions).map(([busId, pos]) => {
    const route = Object.values(ROUTES).find(r => r.busId === busId);
    return { busId, ...pos, routeName: route?.name || "Unknown", driverName: route?.driverName || "Unknown" };
  }));
});

app.get("/api/buses/:busId", authMiddleware, (req, res) => {
  const pos = busPositions[req.params.busId];
  if (!pos) return res.status(404).json({ message: "Bus not found" });
  const route = Object.values(ROUTES).find(r => r.busId === req.params.busId);
  res.json({ busId: req.params.busId, ...pos, routeName: route?.name, driverName: route?.driverName });
});

app.get("/api/routes", authMiddleware, (req, res) => {
  res.json(Object.values(ROUTES).map(r => ({ ...r, status: busPositions[r.busId]?.status || "unknown", currentLocation: { lat: busPositions[r.busId]?.lat, lng: busPositions[r.busId]?.lng }, speed: busPositions[r.busId]?.speed || 0 })));
});

app.get("/api/routes/:routeId", authMiddleware, (req, res) => {
  const route = ROUTES[req.params.routeId];
  if (!route) return res.status(404).json({ message: "Route not found" });
  const pos = busPositions[route.busId];
  res.json({ ...route, status: pos?.status, currentLocation: { lat: pos?.lat, lng: pos?.lng }, speed: pos?.speed || 0 });
});

// ── Student ───────────────────────────────────────────────────
app.get("/api/student/my-bus", authMiddleware, requireRole("student"), (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  const route = ROUTES[user?.routeId];
  if (!route) return res.status(404).json({ message: "No route assigned" });
  const pos = busPositions[route.busId];
  res.json({ route, currentPosition: pos, eta: pos?.status === "active" ? Math.max(1, Math.round(Math.random() * route.duration)) : null, status: pos?.status || "unknown" });
});

// ── Driver ────────────────────────────────────────────────────
app.get("/api/driver/my-route", authMiddleware, requireRole("driver"), (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  const route = ROUTES[user?.routeId];
  if (!route) return res.status(404).json({ message: "No route assigned" });
  res.json(route);
});

app.post("/api/driver/location", authMiddleware, requireRole("driver"), (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  const { lat, lng, speed = 0, heading = 0 } = req.body;
  if (!lat || !lng) return res.status(400).json({ message: "lat and lng required" });
  if (user?.busId && busPositions[user.busId]) {
    busPositions[user.busId] = { ...busPositions[user.busId], lat, lng, speed, heading, lastUpdate: Date.now() };
    io.emit("busLocation", { lat, lng, speed, heading, busId: user.busId, routeId: user.routeId });
  }
  res.json({ message: "Location updated", busId: user?.busId });
});

app.post("/api/driver/attendance/check-in", authMiddleware, requireRole("driver"), (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  const record = { id: `att${Date.now()}`, driverId: user.id, driverName: user.name, busId: user.busId, routeId: user.routeId, date: new Date().toISOString().split("T")[0], checkIn: new Date().toISOString(), checkOut: null, kmDriven: 0, status: "present" };
  attendance.push(record);
  res.status(201).json({ message: "Checked in successfully", record });
});

app.put("/api/driver/attendance/check-out", authMiddleware, requireRole("driver"), (req, res) => {
  const { kmDriven = 0 } = req.body;
  const user = users.find(u => u.id === req.user.id);
  const today = new Date().toISOString().split("T")[0];
  const record = [...attendance].reverse().find(a => a.driverId === user.id && a.date === today && !a.checkOut);
  if (!record) return res.status(404).json({ message: "No active check-in found for today" });
  record.checkOut = new Date().toISOString();
  record.kmDriven = kmDriven;
  res.json({ message: "Checked out successfully", record });
});

app.post("/api/driver/maintenance", authMiddleware, requireRole("driver", "admin"), (req, res) => {
  const { busId, issue, priority = "medium" } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (!busId || !issue) return res.status(400).json({ message: "busId and issue required" });
  const request = { id: `mnt${Date.now()}`, busId, issue, priority, reportedBy: user.name, reportedById: user.id, status: "pending", createdAt: new Date().toISOString(), resolvedAt: null };
  maintenance.push(request);
  io.emit("maintenanceRequest", request);
  res.status(201).json({ message: "Maintenance request submitted", request });
});

// ── Admin ─────────────────────────────────────────────────────
app.get("/api/admin/stats", authMiddleware, requireRole("admin"), (req, res) => {
  const vals = Object.values(busPositions);
  res.json({
    activeBuses: vals.filter(b => b.status === "active").length,
    delayedBuses: vals.filter(b => b.status === "delayed").length,
    offlineBuses: vals.filter(b => b.status === "offline" || b.status === "completed").length,
    totalBuses: vals.length,
    totalStudents: users.filter(u => u.role === "student").length,
    totalDrivers: users.filter(u => u.role === "driver").length,
    totalRoutes: Object.keys(ROUTES).length,
    pendingMaintenanceRequests: maintenance.filter(m => m.status === "pending").length,
    totalTripsToday: tripLogs.filter(t => new Date(t.startTime).toDateString() === new Date().toDateString()).length,
    alertsToday: alerts.filter(a => new Date(a.time).toDateString() === new Date().toDateString()).length,
  });
});

app.get("/api/admin/users", authMiddleware, requireRole("admin"), (req, res) => {
  res.json(users.map(({ password: _, ...u }) => u));
});

app.post("/api/admin/users", authMiddleware, requireRole("admin"), (req, res) => {
  const { name, email, password = "changeme123", role, usn, driverCode, busId, routeId } = req.body;
  if (!name || !email || !role) return res.status(400).json({ message: "name, email, role required" });
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: "Email already exists" });
  const newUser = { id: `u${Date.now()}`, name, email: email.toLowerCase(), password, role, usn, driverCode, busId, routeId };
  users.push(newUser);
  const { password: _, ...safe } = newUser;
  res.status(201).json({ message: "User created", user: safe });
});

app.put("/api/admin/users/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  Object.assign(user, req.body);
  const { password: _, ...safe } = user;
  res.json({ message: "User updated", user: safe });
});

app.delete("/api/admin/users/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "User not found" });
  users.splice(idx, 1);
  res.json({ message: "User deleted" });
});

app.get("/api/admin/buses", authMiddleware, requireRole("admin"), (req, res) => {
  res.json(Object.entries(busPositions).map(([busId, pos]) => {
    const route = Object.values(ROUTES).find(r => r.busId === busId);
    return { busId, ...pos, routeName: route?.name, routeId: route?.id, driverName: route?.driverName };
  }));
});

app.put("/api/admin/buses/:busId/status", authMiddleware, requireRole("admin"), (req, res) => {
  const bus = busPositions[req.params.busId];
  if (!bus) return res.status(404).json({ message: "Bus not found" });
  bus.status = req.body.status;
  io.emit("busStatusUpdate", { busId: req.params.busId, status: req.body.status });
  res.json({ message: "Status updated", busId: req.params.busId, status: req.body.status });
});

app.get("/api/admin/alerts", authMiddleware, requireRole("admin"), (req, res) => res.json(alerts));

app.post("/api/admin/alerts", authMiddleware, requireRole("admin"), (req, res) => {
  const { type = "info", title, message, routeId } = req.body;
  if (!title || !message) return res.status(400).json({ message: "title and message required" });
  const alert = { id: `a${alertIdCounter++}`, type, title, message, routeId: routeId || null, time: Date.now() };
  alerts.unshift(alert);
  io.emit("newAlert", alert);
  res.status(201).json({ message: "Alert sent", alert });
});

app.delete("/api/admin/alerts/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const idx = alerts.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Alert not found" });
  alerts.splice(idx, 1);
  res.json({ message: "Alert deleted" });
});

app.get("/api/admin/maintenance", authMiddleware, requireRole("admin"), (req, res) => res.json(maintenance));

app.put("/api/admin/maintenance/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const req_mnt = maintenance.find(m => m.id === req.params.id);
  if (!req_mnt) return res.status(404).json({ message: "Request not found" });
  Object.assign(req_mnt, req.body);
  if (req.body.status === "resolved") req_mnt.resolvedAt = new Date().toISOString();
  res.json({ message: "Updated", request: req_mnt });
});

app.get("/api/admin/attendance", authMiddleware, requireRole("admin"), (req, res) => {
  const { date } = req.query;
  res.json(date ? attendance.filter(a => a.date === date) : attendance);
});

app.get("/api/admin/trips", authMiddleware, requireRole("admin"), (req, res) => res.json(tripLogs));

app.post("/api/admin/broadcast", authMiddleware, requireRole("admin"), (req, res) => {
  const { message, type = "info" } = req.body;
  if (!message) return res.status(400).json({ message: "message required" });
  const alert = { id: `a${alertIdCounter++}`, type, title: "Admin Broadcast", message, time: Date.now(), routeId: null };
  alerts.unshift(alert);
  io.emit("newAlert", alert);
  io.emit("broadcast", { message, type, time: Date.now() });
  res.json({ message: "Broadcast sent" });
});

// ── Health ────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "BusTrack JCER Backend running", port: PORT, routes: Object.keys(ROUTES).length, buses: Object.keys(busPositions).length }));
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ message: `${req.method} ${req.path} not found` }));

server.listen(PORT, () => {
  console.log(`\n🚀 BusTrack JCER Server → http://localhost:${PORT}`);
  console.log(`\n🔑 Demo credentials:`);
  console.log(`   Admin:   admin@jcer.edu / admin123`);
  console.log(`   Driver:  driver@jcer.edu / driver123`);
  console.log(`   Student: student@jcer.edu / student123\n`);
});
