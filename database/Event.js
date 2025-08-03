const mongoose = require("mongoose");

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
  meetingLink: String
});

module.exports = mongoose.model("Event", eventSchema);