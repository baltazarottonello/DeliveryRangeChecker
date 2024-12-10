import express from "express";
import path from "path";

const app = express();

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.static("."));

app.get("/index.html", (req, res) => {
  const filePath = path.join(process.cwd(), "index.html");
  res.sendFile(filePath);
});

app.listen(3000, () => {
  console.log(`Server listen on PORT 3000`);
});
