const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
  },  
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  socketId: {
    type: String, // Le socketId doit être une chaîne de caractères
    unique: true, // Chaque utilisateur doit avoir un socketId unique
    sparse: true, // Si le socketId n'est pas fourni, il n'est pas obligatoire
  },
  connected: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
