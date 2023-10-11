# Use an official Node.js runtime as the base image
FROM node:14

# Install AWS CLI
RUN apt-get update && \
    apt-get install -y awscli && \
    apt-get clean

# Set AWS credentials as environment variables
ENV AWS_ACCESS_KEY_ID=AKIA4P5KXPG6LPDNAM6X
ENV AWS_SECRET_ACCESS_KEY=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
ENV AWS_DEFAULT_REGION=ap-south-1

# Copy the package.json and package-lock.json to the working directory
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code into the container
COPY . .

# Expose the port your application will run on
EXPOSE 3002

# Define the command to run your application
CMD ["node", "mainIssuesService.js"]