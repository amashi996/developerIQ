/*
const express = require("express");
const app = express();
const request = require("request-promise");
const fs = require("fs");
const { getCommit } = require("./getCommitID");

app.use(express.json());
const COL_NAME = "commitID";

app.get("/", (req, res) => {
  res.send("Welcome");
});

// Get GitHub Token
const path = require("path");
const TOKEN_FILE_PATH = path.resolve(__dirname, "../token.txt");
require("dotenv").config({ path: TOKEN_FILE_PATH });

app.get("/getGitHubToken", (req, res) => {
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

// Get GitHub events
app.get("/getGitHubEvents", async (req, res) => {
  const username = "amashi996"; // Hardcoded username

  // Retrieve GitHub token from the "token.txt" file
  try {
    const token = fs.readFileSync(TOKEN_FILE_PATH, "utf8");

    if (!token) {
      return res.status(500).json({ error: "GitHub token is not available" });
    }

    const options = {
      uri: `https://api.github.com/users/${username}/events`,
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "YourApp", // Replace with your app's User-Agent
      },
      json: true,
    };

    const events = await request(options);

    if (Array.isArray(events)) {
      res.json(events);
    } else {
      res.status(500).json({ error: "Unable to fetch GitHub events" });
    }
  } catch (error) {
    console.error("Error fetching GitHub events:", error);
    res.status(500).json({ error: "Error fetching GitHub events" });
  }
});

// Get max commit id
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

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

*/
