const express = require("express");
const app = express();
const axios = require("axios");
const AWS = require("aws-sdk");
const fs = require("fs");
const uuid = require("uuid");
const path = require("path");
const { getCommit } = require("./getCommitID");

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

// Generate commitID based on UUID
function generateCommitID() {
  const commitID = uuid.v4();
  return commitID;
}

// Define a function to get the maximum commit ID from your data source
async function getMaxCommitID() {
  try {
    AWS.config.update({
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    const tableName = "dev_commits_update"; // Replace with your DynamoDB table name

    const scanResult = await dynamodb.scan({
      TableName: tableName,
      ProjectionExpression: COL_NAME,
    }).promise();

    if (scanResult.Items && scanResult.Items.length > 0) {
      const maxVal = Math.max(
        ...scanResult.Items.map((item) => item[COL_NAME])
      );
      return maxVal;
    } else {
      return 0; // Return 0 if there are no items in the table
    }
  } catch (error) {
    console.error("Error in getting the maximum commit ID: ", error);
    throw error; // You can handle the error appropriately in your code
  }
}

// Get commits
app.get("/getCommits", async (req, res) => {
  try {
    const commits = await getCommit();
    res.json(commits);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// Get max commit id
app.get("/getMaxCommitID", async (req, res) => {
  try {
    // Replace this with your logic to get the maximum commit ID
    const maxId = await getMaxCommitID();

    console.log(`The maximum value for ${COL_NAME} is: ${maxId}`);
    res.json({ maxVal: maxId + 1 });
  } catch (error) {
    console.error("Error in getting the maximum commit ID: ", error);
    res.status(500).json({
      error: "Error in getting the maximum commit ID",
    });
  }
});

app.use(express.json());

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

/*Add a new route to save GitHub username to DynamoDB
const path_aws = require("path");
const envPath = path_aws.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });

app.get("/saveGitHubUsername/:username", async (req, res) => {
  const username = req.params.username;

  const token = getGitHubToken();
  if (!token) {
    return res.status(500).json({ error: "GitHub token is not available" });
  }

  const commitID = generateCommitID();
  if (!commitID) {
    return res.status(500).json({ error: "Commit ID is not available" });
  } else {
    console.log(commitID);
  }

  AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const tableName = "dev_commits_update";

  try {
    // Check if the username already exists in DynamoDB
    const userExists = await dynamodb
      .get({
        TableName: tableName,
        Key: { commitID: commitID },
      })
      .promise();

    if (userExists.Item) {
      res.json({ message: "GitHub username already saved" });
    } else {
      // Save the GitHub username to DynamoDB
      await dynamodb
        .put({
          TableName: tableName,
          Item: {
            commitID: commitID,
            username: username,
          },
        })
        .promise();
      res.json({ message: "GitHub username saved successfully" });
    }
  } catch (error) {
    console.error("Error saving GitHub username to DynamoDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});*/

// Get GitHub events and store commits in DynamoDB
app.get("/fetchGitHubEvents/:username", async (req, res) => {
  const username = req.params.username;
  const token = getGitHubToken();

  if (!token) {
    return res.status(500).json({ error: "GitHub token is not available" });
  } else {
    console.log(token);

    const url = `https://api.github.com/users/${username}/events`;
    console.log(url);

    const headers = {
      Authorization: `token ${token}`,
    };

    console.log(headers);

    try {
      // Calculate the maximum commit ID from commitData
      const commitData = await getCommit();
      let maxId = 0; // Initialize maxId to 0

      if (commitData.Items && commitData.Items.length > 0) {
        maxId = Math.max(
          ...commitData.Items.map((item) => item[COL_NAME])
        );
      }

      // Check if the username already exists in DynamoDB
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const tableName = "dev_commits_update";

      const userExists = await dynamodb
        .get({
          TableName: tableName,
          Key: { commitID: maxId },
        })
        .promise();

      if (userExists.Item) {
        res.json({ message: "GitHub commits already saved" });
      } else {
        const response = await axios.get(url, { headers });

        if (response.status === 200) {
          const events = response.data;
          const commits = [];

          for (const event of events) {
            if (event.type === "PushEvent") {
              for (const commit of event.payload.commits.slice(0, 15)) {
                console.log(commit);
                commits.push(commit.url);

                await dynamodb
                  .put({
                    TableName: tableName,
                    Item: {
                      commitID: maxId,
                      username: username,
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
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
