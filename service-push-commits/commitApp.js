const express = require("express");
const app = express();
const { getCommit } = require("./getCommitID");
const fs = require("fs");

app.use(express.json());
const COL_NAME = "commitID";

app.get("/", (req, res) => {
  res.send("Welcome");
});

//Get commits
app.get("/getCommits", async (req, res) => {
  try {
    const commits = await getCommit();
    res.json(commits);
  } catch (error) {
    console.error(err);
    res.status(500).json({
      err: "Something went wrong",
    });
  }
});

//Get max commit id
app.get("/getMaxCommitID", async (req, res) => {
  try {
    const commitData = await getCommit();

    if (commitData.Items && commitData.Items.length > 0) {
      const maxVal = Math.max(
        ...commitData.Items.map((item) => item[COL_NAME])
      );
      console.log(`The maximum value for ${COL_NAME} is: ${maxVal}`);
      res.json({ maxVal: maxVal + 1 });
    } else {
      console.log("No items found in the table");
      res.status(404).json({ message: "No items found in the table" });
    }
  } catch (error) {
    console.error("Error in scanning the table: ", error);
    res.status(500).json({
      error: "Error in scanning the table",
    });
  }
});

//get github token
const path = require("path");
const TOKEN_FILE_PATH = path.resolve(__dirname, "../token.txt");
require("dotenv").config({ path: TOKEN_FILE_PATH });

app.get("/getGHToken", (req, res) => {
  try {
    const token = fs.readFileSync(TOKEN_FILE_PATH, "utf8");

    console.log(typeof token);
    console.log(token);
    res.json({ github_token: token });
  } catch (error) {
    console.error("Error reading GitHub token from file:", error);
    res.status(500).json({ error: "Error reading GitHub token from file" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on port port`);
});
