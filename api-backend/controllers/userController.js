const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message.toString() });
  }
};

exports.getUserById = async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error", error: error.message.toString() });
  }
};

exports.createUser = async (req, res) => {
  const { username, email, password, role } = req.body;

  // Vérifier si l'email est défini et non nul
  if (!email || email.trim() === "") {
    return res
      .status(400)
      .json({ message: "L'email est requis et ne peut pas être vide" });
  }

  try {
    // Vérifier si un utilisateur avec ce même email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Un utilisateur avec cet email existe déjà" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
    });

    const savedUser = await newUser.save();
    res.status(201).json({
      message: "Utilisateur créé avec succès !",
      user: savedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = req.params.id;
  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      message: "User deleted successfully",
      user: deletedUser,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error", error: error.message.toString() });
  }
};

exports.updateUser = async (req, res) => {
  const userId = req.params.id;
  const { username, email, password, role } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);
    if (role) user.role = role;

    const updatedUser = await user.save();
    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error", error: error.message.toString() });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      token,
      user: user,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error", error: error.message.toString() });
  }
};
exports.saveOrUpdateUser = async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res
      .status(400)
      .json({ message: "Email, username, and password are required" });
  }

  try {
    // Logique pour sauvegarder ou mettre à jour l'utilisateur
  } catch (error) {
    console.error("Error saving user:", error);
    res
      .status(500)
      .json({ message: "Error saving user", error: error.message });
  }
};  

exports.markUserDisconnected = async (socketId) => {
  try {
    // Mettre à jour l'état de l'utilisateur pour le marquer comme déconnecté
    const user = await User.findOneAndUpdate(
      { socketId },
      { connected: false, lastSeen: Date.now() },
      { new: true }
    );
    return user;
  } catch (error) {
    console.error("Erreur lors de la déconnexion de l'utilisateur", error);
    throw error;
  }
};

exports.getConnectedUsers = async () => {
  try {
    // Récupérer tous les utilisateurs connectés
    const users = await User.find({ connected: true });
    return users;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des utilisateurs connectés",
      error
    );
    throw error;
  }
};
