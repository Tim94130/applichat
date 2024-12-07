const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const socketIo = require("socket.io");
const cors = require("cors");
const http = require("http");
const Filter = require("bad-words");
const filter = new Filter(); // Crée une nouvelle instance de Filter

dotenv.config(); // Charge les variables d'environnement depuis .env

const app = express();
const port = 4001;
const mongoURI = process.env.MONGO_URI;

const typingTimers = {};
const lastMessageTimestamps = {};
const MESSAGE_DELAY = 1500;

app.use(express.json());
app.use(cors());

// Socket IO CONFIG
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Remplacer par l'adresse correcte de ton frontend
    methods: ["GET", "POST"],
  },
});

let socketsConnected = new Set();
let users = {};
const {
  saveOrUpdateUser,
  markUserDisconnected,
  getConnectedUsers,
} = require("./controllers/userController");
io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);
  socketsConnected.add(socket.id);

  // Gestion des utilisateurs connectés
  socket.on("setUsername", async (username) => {
    try {
      // Enregistrer ou mettre à jour l'utilisateur dans la base de données
      await saveOrUpdateUser(socket.id, username);

      // Mettre à jour la liste des utilisateurs connectés
      const connectedUsers = await getConnectedUsers();
      users = connectedUsers.reduce((acc, user) => {
        acc[user.socketId] = user.username;
        return acc;
      }, {});
      io.emit("updateUserList", users);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde de l'utilisateur :", err);
    }
  });

  // Gestion des messages injurieux
  socket.on("message", async (message) => {
    if (filter.isProfane(message.text)) {
      socket.emit("systemMessage", {
        content:
          "Votre message contient des mots inappropriés et n'a pas été envoyé.",
        type: "error",
        timestamp: new Date(),
      });
      return;
    }

    const now = Date.now();
    if (
      lastMessageTimestamps[socket.id] &&
      now - lastMessageTimestamps[socket.id] < MESSAGE_DELAY
    ) {
      socket.emit("systemMessage", {
        content: `Vous envoyez des messages trop rapidement. Veuillez attendre ${Math.ceil(
          (MESSAGE_DELAY - (now - lastMessageTimestamps[socket.id])) / 1000
        )} seconde(s).`,
        type: "warning",
        timestamp: new Date(),
      });
      return;
    }

    lastMessageTimestamps[socket.id] = now;

    try {
      // Sauvegarde en base de données
      await saveMessage(message.senderId, message.recipientId, message.text);

      if (message.recipientId === "All") {
        io.emit("message", message); // Diffuse à tout le monde
      } else {
        io.to(message.recipientId).emit("privateMessage", message);
        socket.emit("privateMessage", message);
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du message :", error);
      socket.emit("systemMessage", {
        content: "Erreur lors de l'envoi du message.",
        type: "error",
        timestamp: new Date(),
      });
    }
    const loadUserHistory = async (username, socket) => {
      try {
        // Récupère les messages où cet utilisateur est impliqué
        const messages = await getMessageHistory(username, 50); // Derniers 50 messages
        socket.emit("history", messages); // Envoie l'historique au client
      } catch (error) {
        console.error(
          `Erreur lors du chargement de l'historique pour ${username}:`,
          error
        );
        socket.emit("systemMessage", {
          content: "Erreur lors du chargement de l'historique.",
          type: "error",
          timestamp: new Date(),
        });
      }
    };
  });

  // Gestion de la déconnexion
  socket.on("disconnect", async () => {
    try {
      // Marquer l'utilisateur comme déconnecté
      await markUserDisconnected(socket.id);

      // Mettre à jour la liste des utilisateurs connectés
      const connectedUsers = await getConnectedUsers();
      users = connectedUsers.reduce((acc, user) => {
        acc[user.socketId] = user.username;
        return acc;
      }, {});
      io.emit("updateUserList", users);
    } catch (err) {
      console.error("Erreur lors de la gestion de la déconnexion :", err);
    }
  });
});

const {
  saveMessage,
  getMessageHistory,
} = require("./controllers/messageController");

// Routes API
const apiRoutes = require("./routes");
app.use("/api", apiRoutes);

// Swagger config
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "NodeJS B3",
      version: "1.0",
      description: "Une API de fou maladaaade",
      contact: {
        name: "Chris",
      },
      servers: [
        {
          url: "http://localhost:4001",
        },
      ],
    },
  },
  apis: [
    `${__dirname}/routes.js`,
    `${__dirname}/models.js`,
    `${__dirname}/controllers.js`,
  ],
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Connect to MongoDB
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("Hello, bienvenue sur le serveur");
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
