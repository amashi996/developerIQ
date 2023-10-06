const express = require("express");
const app = express();
const axios = require("axios");
const AWS = require("aws-sdk");
const fs = require("fs");
const { SecretsManagerClient, GetSecretValueCommand }  = require("@aws-sdk/client-secrets-manager");

const { getIssues } = require("./getIssueID");

const COL_NAME = "issueID";

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

//Define a function to get the maximum issue ID from data source
async function getMaxIssueID() {
    try {
        AWS.config.update({
            region: process.env.AWS_DEFAULT_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const tableName = "dev_issues_update";

        const scanIssueResults = await dynamodb.scan({
            TableName: tableName,
            ProjectionExpression: COL_NAME,
        }).promise();

        if (scanIssueResults.Items && scanIssueResults.Items.length > 0) {
            const maxIssueVal = Math.max(
                ...scanIssueResults.Items.map((item) => item[COL_NAME])
            );
            return maxIssueVal;
        } else {
            return 0;
        }
    } catch (error) {
        console.error("Error in getting the maximum issue ID: ", error);
        throw error;
    }
}

app.use(express.json());

//Welcome issue route
app.get("/", (req, res) => {
    res.send("Welcome issue route handler")
});

// Get issues
app.get("/getIssues", async (req, res) => {
    try {
        const issues = await getIssues();
        res.json(issues);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong",
        });
    }
});

//Get max issue id
app.get("/getMaxIssueID", async (req, res) => {
    try {
        const maxIssueID = await getMaxIssueID();

        console.log(`The maximum value for ${COL_NAME} is: ${maxIssueID}`);
        res.json({ maxIssueVal: maxIssueID });
    } catch (error) {
        console.error("Error in the scanning table: ", error);
        res.status(500).json({
            error: "Error in the scanning table"
        })
    }
})

//Get Github token
app.get("/getGitHubToken", async (req, res) => {
    const tokenResponse = await getGitHubToken();
  
    if (tokenResponse) {
      res.json(tokenResponse);
    } else {
      res.status(500).json({ error: "GitHub token is not available" });
    }
  });

// Route to fetch issues and store them in DynamoDB
app.get('/fetchGitHubIssues/:username', async (req, res) => {
    const username = req.params.username;
    const tokenResponse = await getGitHubToken();

    if (!tokenResponse) {
        return res.status(500).json({
            error: "GitHub token is not available"
        });
    } else {
        try {
            const githubToken = tokenResponse.github_token; 
            console.log(githubToken);

            const issue_url = `https://api.github.com/search/issues?q=author:${username}`;
            
            // Initialize DynamoDB DocumentClient
            const dynamodb = new AWS.DynamoDB.DocumentClient();
            const tableName = "dev_issues_update";

            const issue_responses = await axios.get(issue_url, {
                headers: { Authorization: `token ${githubToken}` },
            });

            if (issue_responses.status === 200) {
                const exist_issues = issue_responses.data.items;

                console.log(`Issues created by ${username}:`);
                let maxIssId = await getMaxIssueID(); // Initialize maxIssId once

                for (const issue of exist_issues) {
                    // Increment the maxIssId for each issue
                    maxIssId++;

                    await dynamodb
                        .put({
                            TableName: tableName,
                            Item: {
                                issueID: maxIssId,
                                username: username,
                                issue_title: issue.title,
                                issue_url: issue.html_url,
                                type: 'CREATED',
                            },
                        })
                        .promise();

                    console.log(`- ${issue.title} (${issue.html_url})`);
                }

                res.json({ message: `Stored ${exist_issues.length} issues created by ${username}` });
            } else {
                console.error(`Error: ${issue_responses.status}`);
                res.status(issue_responses.status).json({ error: 'Error fetching created issues' });
            }
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

const port = process.env.port || 3002;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
