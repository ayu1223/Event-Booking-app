const mongoose = require("mongoose");
const connect = mongoose.connect("mongodb://localhost:27017/event_booking")

connect.then(()=>{
  console.log("Database connected successfully!")
})

connect.catch(()=>{
  console.log("Database connection failed!")
})

const eventSchema = new mongoose.Schema({
  name: String,
  email: String,
  date: String,
  meetingLink: String
});

module.exports = mongoose.model("Event", eventSchema);