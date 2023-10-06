const express = require("express");
const app = express();
const axios = require("axios");
const AWS = require("aws-sdk");
const fs = require("fs");
const { getCommit } = require("./getCommitID");
const { SecretsManagerClient, GetSecretValueCommand }  = require("@aws-sdk/client-secrets-manager");

const COL_NAME = "commitID";

//Define a function to get the GitHub token
async function getGitHubToken() {
  const secret_name = "GITHUB_TOKEN";

  const client = new SecretsManagerClient({
    region: "ap-south-1",
  });

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT",
      })
    );

    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString); 
      if (secret.github_token) {
        return { github_token: secret.github_token };
      } else {
        console.error("GitHub token not found in AWS Secrets Manager");
        return null;
      }
    } else {
      console.error("GitHub token not found in AWS Secrets Manager");
      return null;
    }
  } catch (error) {
    console.error("Error fetching GitHub token from AWS Secrets Manager:", error);
    return null;
  }
}

// Define a function to get the maximum commit ID your data source
async function getMaxCommitID() {
  try {
    AWS.config.update({
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    const tableName = "dev_commits_update"; 

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
      return 0; 
    }
  } catch (error) {
    console.error("Error in getting the maximum commit ID: ", error);
    throw error; 
  }
}

app.use(express.json());

// Welcome route
app.get("/", (req, res) => {
  res.send("Welcome");
});

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
    const maxId = await getMaxCommitID();

    console.log(`The maximum value for ${COL_NAME} is: ${maxId}`);
    res.json({ maxVal: maxId });
  } catch (error) {
    console.error("Error in getting the maximum commit ID: ", error);
    res.status(500).json({
      error: "Error in getting the maximum commit ID",
    });
  }
});

//Get Github token
app.get("/getGitHubToken", async (req, res) => {
  const tokenResponse = await getGitHubToken();

  if (tokenResponse) {
    res.json(tokenResponse);
  } else {
    res.status(500).json({ error: "GitHub token is not available" });
  }
});

// Get GitHub events and store commits in DynamoDB
app.get("/fetchGitHubEvents/:username", async (req, res) => {
  const username = req.params.username;
  const tokenResponse = await getGitHubToken();

  if (!tokenResponse) {
    return res.status(500).json({ error: "GitHub token is not available" });
  } else {
    const githubToken = tokenResponse.github_token; // Extract the GitHub token
    console.log(githubToken);

    const url = `https://api.github.com/users/${username}/events`;
    console.log(url);

    const headers = {
      Authorization: `token ${githubToken}`, // Extract the token part
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
