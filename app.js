import express from "express";
import cors from "cors";
import routes from "./src/routes/index.js";
import errorHandler from "./src/middleware/errorMiddleware.js"; 

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/", (req, res) => {
  res.json({ message: "API is running..." });
});


app.use("/api", routes);


app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});


app.use(errorHandler); 

export default app;