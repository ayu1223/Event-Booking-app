require('dotenv').config();
const express = require("express");
const app = express();
const Event = require("./database/Event"); 
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");


// Middleware
app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true })); 

// GET /
app.get("/", (req, res) => {
  res.render("index"); 
});

// POST /book
app.post("/book", async (req, res) => {
  
  const { name, email, date} = req.body;
  const meetingLink = `https://meet.jit.si/${uuidv4()}`;

  const event = new Event({ name, email, date, meetingLink });
  await event.save();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Event Booking Confirmation",
    html: `
      <h2>Hello ${name},</h2>
      <h3>Booking Confirmed</h3>
      <p>Your event is booked for date: <strong>${date}</strong>.</p>
      <p>You can join the meeting here: <a href="${meetingLink}">${meetingLink}</a></p>
    `
  };
  
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error sending email.");
    }
    else{
      
      res.render("book",{email,meetingLink})

    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

