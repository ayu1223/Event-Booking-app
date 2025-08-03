# 📅 Event Booking App

A simple Node.js + Express.js web application for booking events, generating unique meeting links, and sending email confirmations using Nodemailer.

---

## 🚀 Features

- Collects event details: name, email, and date
- Auto-generates a unique meeting link using `uuid`
- Sends booking confirmation email via Gmail SMTP
- Stores data in MongoDB using Mongoose
- Simple EJS-based frontend with basic styling

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express.js
- **Templating Engine:** EJS
- **Database:** MongoDB (Mongoose)
- **Email Service:** Nodemailer
- **Utilities:** UUID
- **Deployment:** Render

---

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/event-booking-app.git
   cd event-booking-app

2. **Install dependencies from package.json**
   npm install dependencyname

3. **Set up environment variables in .env file**
   EMAIL_USER = your_email@gmail.com
   EMAIL_PASS = your_app_password
   MONGO_URI  = your_mongodb_connection_string

4. **Runnig locally**
   npm start

5. **Open your browser at**
   http://localhost:3000