const express = require("express");
const app = express();
const axios = require("axios");
const AWS = require("aws-sdk");
const fs = require("fs");
const { SecretsManagerClient, GetSecretValueCommand }  = require("@aws-sdk/client-secrets-manager");

const { getPullReq } = require("./getPullReqID");

const COL_NAME = "pullReqID";

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

//Define a function to get the maximum pull request ID from data source
async function getMaxPullReqID() {
    try {
        AWS.config.update({
            region: process.env.AWS_DEFAULT_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const tableName = "dev_pullreqs_update";

        const scanPullReqResults = await dynamodb.scan({
            TableName: tableName,
            ProjectionExpression: COL_NAME,
        }).promise();

        if (scanPullReqResults.Items && scanPullReqResults.Items.length > 0) {
            const maxPullReqVal = Math.max(
                ...scanPullReqResults.Items.map((item) => item[COL_NAME])
            );
            return maxPullReqVal;
        } else {
            return 0;
        }
    } catch (error) {
        console.error("Error in getting the maximum issue ID: ", error);
        throw error;
    }
}

app.use(express.json());

//Welcome pull request route
app.get("/", (req, res) => {
    res.send("Welcome pull request route handler")
});

// Get pull requests
app.get("/getPullRequests", async (req, res) => {
    try {
        const pullReqs = await getPullReq();
        res.json(pullReqs);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong",
        });
    }
});

//Get max pull request id
app.get("/getMaxPullReqID", async (req, res) => {
    try {
        const maxPRID = await getMaxPullReqID();

        console.log(`The maximum value for ${COL_NAME} is: ${maxPRID}`);
        res.json({ maxPullReqVal: maxPRID+1 });
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

// Route to fetch pull request data in DynamoDB
app.get('/fetchGitHubPullRequests/:username', async (req, res) => {
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

            // Initialize a DynamoDB table resource
            const dynamodb = new AWS.DynamoDB.DocumentClient();
            const tableName = "dev_pullreqs_update";

            // Step 1: Get the repositories where the user has contributed pull requests
            const repo_url = `https://api.github.com/users/${username}/repos?type=owner`;
            const repo_response = await axios.get(repo_url, {
                headers: { Authorization: `token ${githubToken}` },
            });


            if (repo_response.status === 200) {
                const repositories = repo_response.data;

                for (const repo of repositories) {
                    const repo_name = repo.name;
                    const owner = repo.owner.login;

                    // Step 2: Get the list of pull requests for each repository
                    const pr_url = `https://api.github.com/repos/${owner}/${repo_name}/pulls?state=all`;
                 
                    const pr_response = await axios.get(pr_url, {
                        headers: { Authorization: `token ${githubToken}` },
                    });
                    
                    const pull_requests = pr_response.data;
                    
                    let maxprsId = await getMaxPullReqID();

                    for (const pr of pull_requests) {
                        maxprsId++;

                        const pr_created_at = pr.created_at;
                        const pr_closed_at = pr.closed_at || pr.updated_at;

                        // Step 3: Calculate the resolution time for each pull request
                        const resolution_time = (new Date(pr_closed_at) - new Date(pr_created_at)) / (60 * 1000);
                        console.log(`Pull Request #${pr.number} in ${owner}/${repo_name} resolved in ${resolution_time.toFixed(3)} minutes.`);

                        await dynamodb
                            .put({
                                TableName: tableName,
                                Item: {
                                    pullReqID : maxprsId,
                                    username: username,
                                    'PR No': `Pull Request #${pr.number}`,
                                    repo_name: `${owner}/${repo_name}`,
                                    'resolving time': resolution_time.toFixed(3),
                                },
                            })
                            .promise();
                    }
                }

                res.json({ message: `Stored pull request data for ${username}` });
            } else {
                console.error(`Error: ${repo_response.status}`);
                res.status(repo_response.status).json({ error: 'Error fetching repositories' });
            }
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

const port = process.env.port || 3003;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});




