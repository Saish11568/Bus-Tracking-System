# 🚌 BusTrack — Jain College of Engineering and Research | JCER

Real-time college bus tracking system with live GPS, admin control, and driver broadcasting.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
# → Server runs on http://localhost:5000

# 3. Open login page
# Open login.html in your browser (or serve via VS Code Live Server)
```

---

## 🔑 Demo Credentials

| Role    | Email                 | Password    |
|---------|-----------------------|-------------|
| Admin   | admin@jcer.edu        | admin123    |
| Driver  | driver@jcer.edu       | driver123   |
| Student | student@jcer.edu      | student123  |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint                    | Auth     | Description              |
|--------|-----------------------------|----------|--------------------------|
| POST   | /api/auth/login             | None     | Login (returns JWT token)|
| POST   | /api/auth/register          | None     | Register new account     |
| GET    | /api/auth/me                | Bearer   | Get current user info    |
| PUT    | /api/auth/change-password   | Bearer   | Change password          |

### Buses & Routes
| Method | Endpoint                        | Auth    | Description           |
|--------|---------------------------------|---------|-----------------------|
| GET    | /api/buses                      | Bearer  | All buses + positions |
| GET    | /api/buses/:busId               | Bearer  | Single bus details    |
| GET    | /api/routes                     | Bearer  | All routes            |
| GET    | /api/routes/:routeId            | Bearer  | Single route details  |

### Student
| Method | Endpoint                | Auth    | Role    | Description           |
|--------|-------------------------|---------|---------|----------------------|
| GET    | /api/student/my-bus     | Bearer  | student | Student's bus & ETA  |

### Driver
| Method | Endpoint                           | Auth   | Role   | Description            |
|--------|------------------------------------|--------|--------|------------------------|
| GET    | /api/driver/my-route               | Bearer | driver | Driver's assigned route|
| POST   | /api/driver/location               | Bearer | driver | REST location update   |
| POST   | /api/driver/attendance/check-in    | Bearer | driver | Mark attendance        |
| PUT    | /api/driver/attendance/check-out   | Bearer | driver | Check out + km driven  |
| POST   | /api/driver/maintenance            | Bearer | driver | Report bus issue       |

### Admin
| Method | Endpoint                          | Auth   | Role  | Description            |
|--------|-----------------------------------|--------|-------|------------------------|
| GET    | /api/admin/stats                  | Bearer | admin | Dashboard stats        |
| GET    | /api/admin/users                  | Bearer | admin | All users              |
| POST   | /api/admin/users                  | Bearer | admin | Create user            |
| PUT    | /api/admin/users/:id              | Bearer | admin | Update user            |
| DELETE | /api/admin/users/:id              | Bearer | admin | Delete user            |
| GET    | /api/admin/buses                  | Bearer | admin | All buses + status     |
| PUT    | /api/admin/buses/:busId/status    | Bearer | admin | Update bus status      |
| GET    | /api/admin/alerts                 | Bearer | admin | All alerts             |
| POST   | /api/admin/alerts                 | Bearer | admin | Send alert             |
| DELETE | /api/admin/alerts/:id             | Bearer | admin | Delete alert           |
| GET    | /api/admin/maintenance            | Bearer | admin | Maintenance requests   |
| PUT    | /api/admin/maintenance/:id        | Bearer | admin | Update request         |
| GET    | /api/admin/attendance             | Bearer | admin | Attendance records     |
| GET    | /api/admin/trips                  | Bearer | admin | Trip logs              |
| POST   | /api/admin/broadcast              | Bearer | admin | Broadcast to all users |

---

## 📡 Socket.IO Events

### Client → Server
| Event           | Payload                              | Description                     |
|----------------|--------------------------------------|---------------------------------|
| driverAuth     | { busId, routeId, driverId }         | Driver identifies their bus     |
| locationUpdate | { lat, lng, speed, heading, busId, routeId } | Driver sends GPS position |
| watchRoute     | { routeId }                          | Student subscribes to a route   |
| driverSOS      | { busId, routeId, lat, lng, message }| Driver sends emergency SOS      |
| tripStart      | { busId, routeId, driverId }         | Trip begins                     |
| tripEnd        | { busId }                            | Trip ends                       |

### Server → Client
| Event           | Payload                              | Description                     |
|----------------|--------------------------------------|---------------------------------|
| busLocation    | { lat, lng, speed, heading, busId, routeId } | Live bus position broadcast |
| busStatusUpdate| { busId, status }                    | Bus status changed              |
| newAlert       | { id, type, title, message, time }   | New alert pushed                |
| maintenanceRequest | { id, busId, issue, ... }        | New maintenance report          |
| broadcast      | { message, type, time }              | Admin broadcast message         |

---

## 🗂️ Project Structure
```
vedant/
├── server.js        ← Node.js backend (Express + Socket.IO + JWT)
├── package.json     ← Dependencies
├── login.html       ← Login page (Student / Driver / Admin)
├── login.css        ← Login styles
├── login.js         ← Login carousel & form helpers
├── index.html       ← Student dashboard
├── style.css        ← Student dashboard styles
├── script.js        ← Student dashboard map + socket logic
├── driver.html      ← Driver dashboard (GPS broadcast)
├── admin.html       ← Admin control centre
└── README.md        ← This file
```

---

## 🔧 Production Notes

- **JWT Secret**: Change `JWT_SECRET` in `server.js` to a strong random string
- **Database**: Replace in-memory arrays with MongoDB or PostgreSQL
- **HTTPS**: Use a reverse proxy (nginx) with SSL for production
- **Environment Variables**: Use `.env` for PORT, JWT_SECRET, DB_URL
- **CORS**: Restrict `origin: "*"` to your actual domain in production
