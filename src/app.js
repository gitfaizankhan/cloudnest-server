import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // allow cookies to be sent
  })
);

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/auth", userRouter);

export default app;
