const express = require("express");
const axios = require("axios");
const AWS = require("aws-sdk");
const getCommitID = require("./getCommitID"); // Assuming you have a separate "getCid.js" file

const app = express();
const port = 3000;

app.get("/getCommits", async (req, res) => {
  try {
    const username = "amashi996";
    const token = await getCommitID.getGHToken();
    console.log(token);

    const url = `https://api.github.com/users/${username}/events`;

    const response = await axios.get(url, {
      headers: { Authorization: `token ${token}` },
    });

    const session = new AWS.Session({ region: "ap-south-1" });
    const dynamodb = new AWS.DynamoDB.DocumentClient({ service: session });
    const tableName = "dev_commits";
    const table = dynamodb.createTable({
      TableName: tableName,
    });

    const maxId = await getCommitID.getMaxCommitID();

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
                  cid: maxId,
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
