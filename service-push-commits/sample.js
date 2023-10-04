const express = require("express");
const app = express();
const axios = require("axios");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const { getCommit } = require("./getCommitID");

app.use(express.json());

const COL_NAME = "commitID";
const TOKEN_FILE_PATH = path.resolve(__dirname, "../token.txt");
require("dotenv").config({ path: TOKEN_FILE_PATH });

// Define the function to get the GitHub token
function getGitHubToken() {
  try {
    const token = fs.readFileSync(TOKEN_FILE_PATH, "utf8");
    console.log(token);
    return token;
  } catch (error) {
    console.error("Error reading GitHub token from file:", error);
    return null;
  }
}

// Welcome route
app.get("/", (req, res) => {
  res.send("Welcome");
});

// Get GitHub Token
app.get("/getGitHubToken", (req, res) => {
  const token = getGitHubToken();

  if (token) {
    res.json({ github_token: token });
  } else {
    res.status(500).json({ error: "GitHub token is not available" });
  }
});

// Get GitHub events and store commits in DynamoDB
app.get("/fetchGitHubEvents/:username", async (req, res) => {
  const username = req.params.username;
  const token = getGitHubToken();

  if (!token) {
    return res.status(500).json({ error: "GitHub token is not available" });
  }

  const url = `https://api.github.com/users/${username}/events`;

  const headers = {
    Authorization: `token ${token}`,
    "User-Agent": "developerIQ", // Replace with your app's User-Agent
  };

  try {
    const response = await axios.get(url, { headers });

    const session = new AWS.Session({ region: "ap-south-1" });
    const dynamodb = new AWS.DynamoDB.DocumentClient({ service: session });
    const tableName = "dev_commits";
    const table = dynamodb.createTable({
      TableName: tableName,
    });

    const maxId = await getCid.getMaxCid();

    if (response.status === 200) {
      const events = response.data;
      const commits = [];

      for (const event of events) {
        if (event.type === "PushEvent") {
          for (const commit of event.payload.commits.slice(0, 15)) {
            console.log(commit);
            commits.push(commit.url);

            await table
              .put({
                TableName: tableName,
                Item: {
                  commitID: maxId,
                  gh_username: username,
                  commit_url: commit.url,
                },
              })
              .promise();

            maxId += 1;
          }
        }
      }
      res.json({ message: "Commits saved successfully" });
    } else {
      console.error(`Error: ${response.status}`);
      res.status(response.status).json({ error: `Error: ${response.status}` });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get commits
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
