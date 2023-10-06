const express = require("express");
const app = express();
const axios = require("axios");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const { getPullReq } = require("./getPullReqID");

const COL_NAME = "pullReqID";
const TOKEN_FILE_PATH = path.resolve(__dirname, "../token.txt");
require("dotenv").config({ path: TOKEN_FILE_PATH });

//Define a function to get the GitHub token
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
        res.json({ maxPullReqVal: maxPRID });
    } catch (error) {
        console.error("Error in the scanning table: ", error);
        res.status(500).json({
            error: "Error in the scanning table"
        })
    }
})

//Get Github token
app.get("/getGitHubToken", (req, res) => {
    const token = getGitHubToken();

    if (token) {
        res.json({ github_token: token });
    } else {
        res.status(500).json({ error: "GitHub token is not available" });
    }
});

// Route to fetch pull request data in DynamoDB
app.get('/fetchGitHubPullRequests/:username', async (req, res) => {
    const username = req.params.username;
    const token = await getGitHubToken();

    if (!token) {
        return res.status(500).json({
            error: "GitHub token is not available"
        });
    } else {
        try {
            // Initialize a DynamoDB table resource
            const dynamodb = new AWS.DynamoDB.DocumentClient();
            const tableName = "dev_pullreqs_update";

            // Step 1: Get the repositories where the user has contributed pull requests
            const repo_url = `https://api.github.com/users/${username}/repos?type=owner`;
            const repo_response = await axios.get(repo_url, {
                headers: { Authorization: `token ${token}` },
            });

            if (repo_response.status === 200) {
                const repositories = repo_response.data;

                for (const repo of repositories) {
                    const repo_name = repo.name;
                    const owner = repo.owner.login;

                    // Step 2: Get the list of pull requests for each repository
                    const pr_url = `https://api.github.com/repos/${owner}/${repo_name}/pulls?state=all`;
                 
                    const pr_response = await axios.get(pr_url, {
                        headers: { Authorization: `token ${token}` },
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




