const mongoose = require("mongoose");
require('dotenv').config()
const uri = process.env.MONGO_URI;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected!'))
.catch(err => console.error('Connection error:', err));


const eventSchema = new mongoose.Schema({
  name: String,
  email: String,
  date: String,
  mode:String,
  location:String,
  time: String,
  meetingLink: String
});

module.exports = mongoose.model("Event", eventSchema);