module.exports = {
  apps: [{
    name: 'cmms',
    script: 'dist/index.js',
    cwd: '/home/ubuntu/CMMS',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
      DATABASE_URL: 'mysql://4QLyZNrgTT18fMs.root:P4U13RrqYbofEO2y@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/cmms?ssl={"rejectUnauthorized":true}',
      JWT_SECRET: 'cmms-super-secret-jwt-key-2026',
      VITE_APP_ID: 'cmms-app',
      OAUTH_SERVER_URL: 'http://localhost:8080',
      OWNER_OPEN_ID: 'admin',
      BUILT_IN_FORGE_API_URL: 'https://api.openai.com/v1',
      BUILT_IN_FORGE_API_KEY: '',
      S3_ENDPOINT: 'https://s3.eu-central-1.idrivee2.com',
      S3_REGION: 'eu-central-1',
      S3_ACCESS_KEY: 'V1hMCeNkFgDPVm1e7n5s',
      S3_SECRET_KEY: 'sJn9ud8DiKNlAyVMxw8cOSA9G9gVj9Rq9C1Agbp5',
      S3_BUCKET: 'cmms-uploads'
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000
  }]
};
